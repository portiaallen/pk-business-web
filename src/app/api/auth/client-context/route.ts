import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getSessionTokenFromRequest } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
async function choices(userId: string, role: string) {
  const ids =
    role === "CLIENT"
      ? (
          await prisma.clientMember.findMany({
            where: { userId },
            select: { clientId: true },
          })
        ).map((m) => m.clientId)
      : (
          await prisma.capabilityGrant.findMany({
            where: { userId, scope: { in: ["CLIENT", "REQUEST"] } },
            select: { clientId: true },
          })
        ).map((g) => g.clientId);
  return prisma.client.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: { id: true, name: true },
  });
}
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user) throw ApiError.unauthorized();
    return NextResponse.json({
      clients: await choices(user.id, user.role),
      activeClientId: user.activeClientId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user) throw ApiError.unauthorized();
    const { clientId } = await request.json();
    const allowed = await choices(user.id, user.role);
    if (typeof clientId !== "string" || !allowed.some((c) => c.id === clientId))
      throw ApiError.forbidden();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.session.updateMany({
        where: {
          id: user.sessionId,
          securityVersion: user.securityVersion,
          user: { securityVersion: user.securityVersion, status: "ACTIVE" },
        },
        data: { activeClientId: clientId },
      });
      if (updated.count !== 1) throw ApiError.unauthorized();
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          clientId,
          action: "ADMIN_ACTION",
          resource: "security",
          metadata: JSON.stringify({ action: "CLIENT_CONTEXT_CHANGED" }),
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
