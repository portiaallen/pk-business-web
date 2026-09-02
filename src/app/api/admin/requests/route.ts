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

    const requests = await prisma.verificationRequest.findMany({
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
        assignedStaff: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(
      requests.map((r) => ({
        id: r.id,
        clientName: r.client.name,
        service: r.service.name,
        status: r.status,
        assignedStaff: r.assignedStaff?.name || null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
