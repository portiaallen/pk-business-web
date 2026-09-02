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

    const [totalClients, activeClients, totalRequests, openRequests, pendingDocuments] =
      await Promise.all([
        prisma.client.count(),
        prisma.client.count({ where: { status: "ACTIVE" } }),
        prisma.verificationRequest.count(),
        prisma.verificationRequest.count({
          where: { status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } },
        }),
        prisma.documentRequest.count({
          where: { status: { in: ["REQUESTED", "CHANGES_REQUESTED"] } },
        }),
      ]);

    const recentRequests = await prisma.verificationRequest.findMany({
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      totalClients,
      activeClients,
      totalRequests,
      openRequests,
      pendingDocuments,
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        clientName: r.client.name,
        service: r.service.name,
        status: r.status,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
