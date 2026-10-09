import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuthContext,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const documents = await prisma.document.findMany({
      where: {
        request: { clientId: ctx.clientId },
        retentionStatus: "ACTIVE",
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
