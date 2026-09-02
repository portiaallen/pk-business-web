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

    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: {
            members: true,
            verificationRequests: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        memberCount: c._count.members,
        requestCount: c._count.verificationRequests,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
