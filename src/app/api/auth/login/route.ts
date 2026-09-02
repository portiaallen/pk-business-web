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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const returnTo = typeof body.returnTo === "string" ? body.returnTo : undefined;

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
          metadata: JSON.stringify({ email, reason: "user_not_found" }),
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
          metadata: JSON.stringify({ reason: "invalid_password" }),
        },
      });
      throw genericLoginError();
    }

    // Successful authentication — clear failed-attempt state
    await clearFailedLogins(email);

    const token = await createSession(user.id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: AuditAction.LOGIN,
        resource: "auth",
        metadata: JSON.stringify({ email: user.email }),
      },
    });

    // Determine redirect destination
    let redirectUrl = "/portal/dashboard";
    if (returnTo && returnTo.startsWith("/")) {
      redirectUrl = returnTo;
    }
    if (hasRole(user, "ADMIN") && !returnTo) {
      redirectUrl = "/admin/dashboard";
    }

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
