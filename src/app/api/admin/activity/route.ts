import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

    const entries = await prisma.auditLog.findMany({
      include: {
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      entries.map((e) => ({
        id: e.id,
        action: e.action,
        resource: e.resource,
        resourceId: e.resourceId,
        actorName: e.actor?.name || null,
        clientName: null,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
