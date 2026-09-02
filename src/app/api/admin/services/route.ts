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

    const services = await prisma.service.findMany({
      include: {
        _count: { select: { verificationRequests: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(
      services.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        shortDescription: s.shortDescription,
        priceDisplay: s.priceDisplay,
        status: s.status,
        requestCount: s._count.verificationRequests,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
