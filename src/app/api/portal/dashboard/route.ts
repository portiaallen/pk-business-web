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

    if (!user) throw ApiError.unauthorized();

    // Resolve client membership
    const membership = await prisma.clientMember.findFirst({
      where: { userId: user.id },
      include: { client: true },
    });

    if (!membership || membership.client.status !== "ACTIVE") {
      throw ApiError.forbidden("No active client account");
    }

    const clientId = membership.clientId;

    // Active services count
    const activeServices = await prisma.service.count({
      where: { status: "ACTIVE" },
    });

    // Open requests for this client
    const openRequests = await prisma.verificationRequest.count({
      where: {
        clientId,
        status: {
          notIn: ["COMPLETED", "CANCELLED", "REJECTED"],
        },
      },
    });

    // Pending document requests
    const pendingDocuments = await prisma.documentRequest.count({
      where: {
        request: { clientId },
        status: { in: ["REQUESTED", "CHANGES_REQUESTED"] },
      },
    });

    // Unread messages (messages not from this user)
    const unreadMessages = await prisma.clientMessage.count({
      where: {
        request: { clientId },
        authorId: { not: user.id },
      },
    });

    // Recent requests
    const requests = await prisma.verificationRequest.findMany({
      where: { clientId },
      include: { service: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    // Recent activity from audit log
    const recentActivity = await prisma.auditLog.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      activeServices,
      openRequests,
      pendingDocuments,
      unreadMessages,
      requests: requests.map((r) => ({
        id: r.id,
        title: r.requestType || r.service.name,
        service: r.service.name,
        status: r.status,
        updatedAt: r.updatedAt.toISOString(),
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        description: `${a.action.replace(/_/g, " ").toLowerCase()} on ${a.resource}`,
        timestamp: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
