import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user) throw ApiError.unauthorized();

    const membership = await prisma.clientMember.findFirst({
      where: { userId: user.id },
    });
    if (!membership) throw ApiError.forbidden();

    const documents = await prisma.document.findMany({
      where: {
        request: { clientId: membership.clientId },
      },
      include: {
        request: { select: { requestType: true, service: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        category: d.category,
        uploadStatus: d.uploadStatus,
        reviewStatus: d.reviewStatus,
        requestTitle: d.request.requestType || d.request.service.name,
        createdAt: d.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
