import { confidentialRequestFilter } from "@/lib/capabilities";
import { requireAdminApiAccess } from "@/lib/admin-access";
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
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const scopedRequests = await confidentialRequestFilter(user);
    const [totalClients, activeClients, totalRequests, openRequests, pendingDocuments] =
      await Promise.all([
        prisma.client.count({ where: { id: user.activeClientId! } }),
        prisma.client.count({ where: { id: user.activeClientId!, status: "ACTIVE" } }),
        prisma.verificationRequest.count({ where: scopedRequests }),
        prisma.verificationRequest.count({
          where: { ...scopedRequests, status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } },
        }),
        prisma.documentRequest.count({
          where: { request: scopedRequests, status: { in: ["REQUESTED", "CHANGES_REQUESTED"] } },
        }),
      ]);

    const recentRequests = await prisma.verificationRequest.findMany({
      where: scopedRequests,
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
