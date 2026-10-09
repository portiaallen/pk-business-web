import {
  assertNotRateLimited,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/rate-limit";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  requireRecentAuthentication,
  clearSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { recoveryHash } from "@/lib/webauthn";
import { ApiError, handleApiError } from "@/lib/api-error";
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user) throw ApiError.unauthorized();
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        label: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    const adminGrants = await prisma.capabilityGrant.count({
      where: {
        userId: user.id,
        scope: "GLOBAL",
        clientId: "",
        capability: { in: ["security", "permissions"] },
      },
    });
    return NextResponse.json({
      canAdminister: user.role !== "CLIENT" && adminGrants > 0,
      role: user.role,
      credentials,
      assurance: user.assurance,
      securityVersion: user.securityVersion,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user) throw ApiError.unauthorized();
    const body = await request.json();
    if (user.role === "CLIENT") {
      if (!["revoke-all", "client-step-up"].includes(body.action))
        throw ApiError.forbidden();
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
      if (body.action === "client-step-up") {
        await prisma.$transaction(async (tx) => {
          const changed = await tx.session.updateMany({
            where: {
              id: user.sessionId,
              securityVersion: user.securityVersion,
              user: {
                status: "ACTIVE",
                securityVersion: user.securityVersion,
                role: "CLIENT",
              },
            },
            data: { passwordVerifiedAt: new Date() },
          });
          if (changed.count !== 1) throw ApiError.unauthorized();
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "ADMIN_ACTION",
              resource: "security",
              metadata: JSON.stringify({
                action: "CLIENT_PASSWORD_REVERIFIED",
                assurance: "PASSWORD",
              }),
            },
          });
        });
        return NextResponse.json({ success: true });
      }
    } else requireRecentAuthentication(user);
    if (
      !["recovery-codes", "revoke-all", "remove-credential"].includes(
        body.action,
      )
    )
      throw ApiError.badRequest();
    const codes =
      body.action === "recovery-codes"
        ? Array.from({ length: 10 }, () => randomBytes(24).toString("hex"))
        : [];
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          securityVersion: user.securityVersion,
          status: "ACTIVE",
        },
        data: { securityVersion: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw ApiError.conflict("Security state changed; sign in again");
      if (body.action === "recovery-codes") {
        await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
        await tx.recoveryCode.createMany({
          data: codes.map((code) => ({
            userId: user.id,
            codeHash: recoveryHash(code),
          })),
        });
      }
      if (body.action === "remove-credential") {
        const count = await tx.webAuthnCredential.count({
          where: { userId: user.id },
        });
        if (count <= 1 || typeof body.credentialId !== "string")
          throw ApiError.conflict("Keep at least one authenticator");
        const removed = await tx.webAuthnCredential.deleteMany({
          where: { userId: user.id, id: body.credentialId },
        });
        if (removed.count !== 1) throw ApiError.notFound();
      }
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.securityChallenge.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ADMIN_ACTION",
          resource: "security",
          metadata: JSON.stringify({
            action: body.action.replaceAll("-", "_").toUpperCase(),
            assurance: user.assurance,
          }),
        },
      });
    });
    const response = NextResponse.json({ success: true, codes });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
