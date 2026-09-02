import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

/** List document requests (what PK is waiting on) for a tenant-scoped request. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      select: { clientId: true },
    });
    if (!req || req.clientId !== ctx.clientId) {
      throw ApiError.notFound("Request not found");
    }

    const docRequests = await prisma.documentRequest.findMany({
      where: { requestId: id },
      include: { document: { select: { id: true, fileName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      docRequests.map((dr) => ({
        id: dr.id,
        title: dr.title,
        description: dr.description,
        required: dr.required,
        status: dr.status,
        fulfilledBy: dr.document
          ? { id: dr.document.id, fileName: dr.document.fileName }
          : null,
        requestedAt: dr.requestedAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
