import {
  assertNotRateLimited,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import {
  finishChallenge,
  redeemRecovery,
  startChallenge,
} from "@/lib/webauthn";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  buildSessionCookie,
  requireRecentAuthentication,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-error";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "verify") {
      const result = await finishChallenge(
        body.ticket,
        body.response,
        typeof body.label === "string" ? body.label : undefined,
      );
      const response = NextResponse.json({
        success: true,
        redirectUrl: "/security",
        ...("token" in result ? {} : result),
      });
      if ("token" in result && result.token)
        response.headers.set("Set-Cookie", buildSessionCookie(result.token));
      return response;
    }
    if (body.action === "recover")
      return NextResponse.json(await redeemRecovery(body.ticket, body.code));
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user || user.role === "CLIENT") throw ApiError.unauthorized();
    if (body.action === "enroll") {
      requireRecentAuthentication(user);
      return NextResponse.json(
        await startChallenge(user.id, "ENROLL", user.sessionId),
      );
    }
    if (body.action === "step-up") {
      const record = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      await assertNotRateLimited(record.email);
      if (
        typeof body.password !== "string" ||
        !(await verifyPassword(body.password, record.passwordHash))
      ) {
        await recordFailedLogin(record.email);
        throw ApiError.unauthorized();
      }
      await clearFailedLogins(record.email);
      return NextResponse.json(
        await startChallenge(user.id, "STEP_UP", user.sessionId),
      );
    }
    throw ApiError.badRequest();
  } catch (error) {
    return handleApiError(error);
  }
}
