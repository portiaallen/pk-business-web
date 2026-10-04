import {
  assertResourceEnvironment,
  securityEnvironment,
} from "@/lib/security-environment";
import { randomBytes, createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import type {
  User,
  UserRole,
  ClientMemberRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

function ApiErrorForbidden() {
  return ApiError.forbidden("Your role does not permit this action");
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "pk_business_session";
export const SESSION_TTL_DAYS = 7;
const BCRYPT_ROUNDS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "status"
> & {
  sessionId: string;
  securityVersion: number;
  activeClientId: string | null;
  passwordVerifiedAt: Date;
  mfaVerifiedAt: Date | null;
  assurance: string;
};
export const CLIENT_IDLE_MS = 24 * 60 * 60 * 1000;
export const STAFF_IDLE_MS = 30 * 60 * 1000;
export const STAFF_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const STEP_UP_MS = 5 * 60 * 1000;
export function sessionValid(
  session: {
    expiresAt: Date;
    lastSeenAt: Date;
    securityVersion: number;
    assurance: string;
    user: { status: string; role: string; securityVersion: number };
  },
  now = new Date(),
): boolean {
  if (
    session.user.status !== "ACTIVE" ||
    session.expiresAt <= now ||
    session.securityVersion !== session.user.securityVersion
  )
    return false;
  return (
    now.getTime() - session.lastSeenAt.getTime() <
      (session.user.role === "CLIENT" ? CLIENT_IDLE_MS : STAFF_IDLE_MS) &&
    (session.user.role === "CLIENT"
      ? ["PASSWORD", "WEBAUTHN"].includes(session.assurance)
      : session.assurance === "WEBAUTHN")
  );
}
/** Bind unscoped mutations to the client the screen actually displayed (including other-tab switches). */
export function requireExpectedClient(
  request: Request,
  ctx: AuthContext,
): void {
  if (request.headers.get("x-pk-client-context") !== ctx.clientId)
    throw ApiError.conflict(
      "Client context changed; reload and confirm the client before continuing",
    );
}
export function requireRecentPassword(user: SessionUser): void {
  if (Date.now() - user.passwordVerifiedAt.getTime() > STEP_UP_MS)
    throw ApiError.forbidden(
      "Recent password verification required; open Account security",
    );
}
export function requireRecentAuthentication(user: SessionUser): void {
  const now = Date.now();
  if (
    user.assurance !== "WEBAUTHN" ||
    !user.mfaVerifiedAt ||
    now - user.mfaVerifiedAt.getTime() > STEP_UP_MS ||
    now - user.passwordVerifiedAt.getTime() > STEP_UP_MS
  ) {
    throw ApiError.forbidden(
      "Recent password and passkey verification required",
    );
  }
}

export type AuthContext = {
  user: SessionUser;
  clientId: string;
  clientName: string;
  memberRole: ClientMemberRole;
};

// ─── Password utilities ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// ─── Token utilities ──────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  const environment = securityEnvironment();
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) assertResourceEnvironment("AUTH");
  if (secret) {
    return createHmac("sha256", secret)
      .update(`pk-business:${token}`)
      .digest("hex");
  }
  // Fail-safe: never silently weaken token hashing in production.
  // In development, plain SHA-256 is acceptable for local testing.
  if (environment === "production" || environment === "preview") {
    throw new Error(
      "AUTH_SECRET is required in production. Set it via environment configuration before serving requests.",
    );
  }
  return createHash("sha256").update(`pk-business:${token}`).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── Session management ───────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  assurance = "PASSWORD",
  expectedVersion?: number,
  passwordVerifiedAt = new Date(),
): Promise<string> {
  const token = generateSessionToken();
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (
      user.status !== "ACTIVE" ||
      (expectedVersion !== undefined &&
        user.securityVersion !== expectedVersion) ||
      (user.role !== "CLIENT" && assurance !== "WEBAUTHN")
    )
      throw ApiError.unauthorized();
    const now = new Date();
    await tx.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        securityVersion: user.securityVersion,
        assurance,
        passwordVerifiedAt,
        mfaVerifiedAt: assurance === "WEBAUTHN" ? now : null,
        lastSeenAt: now,
        expiresAt: new Date(
          now.getTime() +
            (user.role === "CLIENT"
              ? SESSION_TTL_DAYS * 86400000
              : STAFF_ABSOLUTE_MS),
        ),
      },
    });
    await tx.user.update({ where: { id: userId }, data: { lastLoginAt: now } });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "LOGIN",
        resource: "auth",
        metadata: JSON.stringify({ assurance }),
      },
    });
  });
  return token;
}
export async function getSessionUser(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  return hydrateSession(session);
}
/** Internal transfer service lookup: caller must possess a scoped intent, never a public session ID. */
export async function getTransferSessionUser(id: string): Promise<SessionUser | null> {
  return hydrateSession(await prisma.session.findUnique({ where: { id }, include: { user: true } }));
}
async function hydrateSession(session: Awaited<ReturnType<typeof prisma.session.findUnique>> & { user?: User } | null): Promise<SessionUser | null> {
  if (!session || !session.user || !sessionValid({ ...session, user: session.user })) return null;
  const touched = await prisma.session.updateMany({
    where: {
      id: session.id,
      securityVersion: session.user.securityVersion,
      user: { securityVersion: session.user.securityVersion, status: "ACTIVE" },
    },
    data: { lastSeenAt: new Date() },
  });
  if (touched.count !== 1) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
    sessionId: session.id,
    securityVersion: session.securityVersion,
    activeClientId: session.activeClientId,
    passwordVerifiedAt: session.passwordVerifiedAt,
    mfaVerifiedAt: session.mfaVerifiedAt,
    assurance: session.assurance,
  };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}

// ─── Role checks ──────────────────────────────────────────────────────────────

export function hasRole(
  user: Pick<User, "role">,
  ...roles: UserRole[]
): boolean {
  return roles.includes(user.role);
}

export function requireRole(user: SessionUser, ...roles: UserRole[]): void {
  if (!hasRole(user, ...roles)) {
    throw new Error("FORBIDDEN");
  }
}

export function hasClientMemberRole(
  role: ClientMemberRole,
  minimum: ClientMemberRole,
): boolean {
  const rank: Record<ClientMemberRole, number> = {
    VIEWER: 1,
    STAFF: 2,
    MANAGER: 3,
    OWNER: 4,
  };
  return rank[role] >= rank[minimum];
}

/**
 * Resolve auth context and enforce a minimum ClientMember role for writes.
 * VIEWER is read-only; STAFF+ may create requests and messages.
 */
export async function requireMemberWriteContext(
  token: string | undefined,
): Promise<AuthContext> {
  const ctx = await requireAuthContext(token);
  if (!hasClientMemberRole(ctx.memberRole, "STAFF")) {
    throw ApiErrorForbidden();
  }
  return ctx;
}

// ─── Auth context resolution ──────────────────────────────────────────────────

/**
 * Resolve the full auth context from a session token.
 * Returns null if not authenticated or not a client member.
 */
export async function getAuthContext(
  token: string | undefined,
): Promise<AuthContext | null> {
  const user = await getSessionUser(token);
  if (!user || user.status !== "ACTIVE") return null;

  // Internal staff must use assignment-scoped APIs, never tenant membership as a bypass.
  if (user.role !== "CLIENT") return null;

  const memberships = await prisma.clientMember.findMany({
    where: { userId: user.id },
    include: { client: true },
    take: 2,
  });

  // Until explicit selection is implemented, never guess among multiple tenants.
  const membership = user.activeClientId
    ? await prisma.clientMember.findUnique({
        where: {
          clientId_userId: { clientId: user.activeClientId, userId: user.id },
        },
        include: { client: true },
      })
    : memberships.length === 1
      ? memberships[0]
      : null;
  if (!membership || membership.client.status !== "ACTIVE") return null;

  return {
    user,
    clientId: membership.clientId,
    clientName: membership.client.name,
    memberRole: membership.role,
  };
}

/**
 * Require a valid auth context. Throws if not authenticated.
 */
export async function requireAuthContext(
  token: string | undefined,
): Promise<AuthContext> {
  const ctx = await getAuthContext(token);
  if (!ctx) {
    throw ApiError.unauthorized();
  }
  return ctx;
}

// ─── Cookie utilities ─────────────────────────────────────────────────────────

export function getSessionTokenFromRequest(
  request: Request,
): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (matches.length !== 1) return undefined;
  const match = matches[0];
  try {
    const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
    return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
  } catch {
    return undefined;
  }
}

export function buildSessionCookie(token: string): string {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
