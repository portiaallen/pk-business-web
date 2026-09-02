import { randomBytes, createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import type { User, UserRole, ClientMemberRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

function ApiErrorForbidden() {
  return ApiError.forbidden("Your role does not permit this action");
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "pk_session";
export const SESSION_TTL_DAYS = 7;
const BCRYPT_ROUNDS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "status">;

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
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// ─── Token utilities ──────────────────────────────────────────────────────────

function hashToken(token: string): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) {
    return createHmac("sha256", secret).update(token).digest("hex");
  }
  // Fail-safe: never silently weaken token hashing in production.
  // In development, plain SHA-256 is acceptable for local testing.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production. Set it via environment configuration before serving requests."
    );
  }
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── Session management ───────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return token;
}

export async function getSessionUser(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  if (session.user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
  };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}

// ─── Role checks ──────────────────────────────────────────────────────────────

export function hasRole(user: SessionUser, ...roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

export function requireRole(user: SessionUser, ...roles: UserRole[]): void {
  if (!hasRole(user, ...roles)) {
    throw new Error("FORBIDDEN");
  }
}

export function hasClientMemberRole(
  role: ClientMemberRole,
  minimum: ClientMemberRole
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
  token: string | undefined
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
  token: string | undefined
): Promise<AuthContext | null> {
  const user = await getSessionUser(token);
  if (!user || user.status !== "ACTIVE") return null;

  // Admin users don't have a client membership — they access everything
  if (user.role === "ADMIN") return null;

  const membership = await prisma.clientMember.findFirst({
    where: { userId: user.id },
    include: { client: true },
  });

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
  token: string | undefined
): Promise<AuthContext> {
  const ctx = await getAuthContext(token);
  if (!ctx) {
    throw ApiError.unauthorized();
  }
  return ctx;
}

// ─── Cookie utilities ─────────────────────────────────────────────────────────

export function getSessionTokenFromRequest(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (!match) return undefined;
  return decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
}

export function buildSessionCookie(token: string): string {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const domain = process.env.COOKIE_DOMAIN?.trim();
  const domainAttr = domain ? `; Domain=${domain}` : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}${domainAttr}`;
}

export function clearSessionCookie(): string {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  const domainAttr = domain ? `; Domain=${domain}` : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${domainAttr}`;
}
