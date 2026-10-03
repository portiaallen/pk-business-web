import { startChallenge } from "@/lib/webauthn";
import { safeAuditMetadata } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSession,
  buildSessionCookie,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  assertNotRateLimited,
  recordFailedLogin,
  clearFailedLogins,
  genericLoginError,
} from "@/lib/rate-limit";
import { AuditAction } from "@/generated/prisma/client";

function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  try {
    const base = new URL("https://pk-business.invalid");
    const target = new URL(value, base);
    if (target.origin !== base.origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const adminMode = body.adminMode === true;
    const returnTo = safeReturnTo(body.returnTo);

    if (!email || !password) {
      throw ApiError.badRequest("Email and password are required");
    }

    // Rate limiting (persistent, per-email, generic responses)
    await assertNotRateLimited(email);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Log failed attempt (no user exists — still rate-limit the email)
      await recordFailedLogin(email);
      await prisma.auditLog.create({
        data: {
          action: AuditAction.LOGIN_FAILED,
          resource: "auth",
          metadata: safeAuditMetadata({ email, reason: "user_not_found" }),
        },
      });
      // Generic response — never reveals whether the account exists
      throw genericLoginError();
    }

    if (user.status !== "ACTIVE") {
      // Same generic message to avoid confirming account existence
      await recordFailedLogin(email);
      throw genericLoginError();
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordFailedLogin(email);
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          resource: "auth",
          metadata: safeAuditMetadata({ reason: "invalid_password" }),
        },
      });
      throw genericLoginError();
    }

    // Successful authentication — clear failed-attempt state
    await clearFailedLogins(email);

    if (adminMode && !hasRole(user, "ADMIN", "STAFF")) {
      throw ApiError.forbidden("PK staff access is required.");
    }

    if (user.role !== "CLIENT") {
      const count = await prisma.webAuthnCredential.count({ where: { userId: user.id } });
      return NextResponse.json({ mfaRequired: true, ...await startChallenge(user.id, count ? "LOGIN" : "ENROLL") });
    }
    const token = await createSession(user.id);

    // Determine redirect destination
    const isAdmin = hasRole(user, "ADMIN");
    const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");
    const redirectUrl = isAdmin
      ? adminMode
        ? returnTo && isAdminPath(returnTo)
          ? returnTo
          : "/admin/dashboard"
        : returnTo || "/admin/dashboard"
      : returnTo && !isAdminPath(returnTo)
        ? returnTo
        : "/portal/dashboard";

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      redirectUrl,
    });

    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
