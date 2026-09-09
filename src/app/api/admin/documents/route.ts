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

    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");

    const where = clientId ? { request: { clientId } } : {};

    const documents = await prisma.document.findMany({
      where,
      include: {
        request: {
          include: {
            client: { select: { id: true, name: true } },
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        category: d.category,
        uploadStatus: d.uploadStatus,
        reviewStatus: d.reviewStatus,
        fileSizeBytes: d.fileSizeBytes,
        clientId: d.request.clientId,
        clientName: d.request.client.name,
        requestId: d.request.id,
        requestTitle: d.request.requestType || d.request.service.name,
        createdAt: d.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
