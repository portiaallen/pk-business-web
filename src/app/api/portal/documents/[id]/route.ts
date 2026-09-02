import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
  requireMemberWriteContext,
} from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";

/**
 * Secure document download.
 * Authorization happens BEFORE any byte is streamed:
 * 1. Session must be valid
 * 2. Document must belong to a request within the caller's tenant
 * Storage keys are never exposed; content is streamed via authorized endpoint.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const document = await prisma.document.findUnique({
      where: { id },
      include: { request: { select: { clientId: true } } },
    });

    // Cross-tenant or unknown IDs are indistinguishable — both 404
    if (!document || document.request.clientId !== ctx.clientId) {
      throw ApiError.notFound("Document not found");
    }

    if (document.uploadStatus !== "UPLOADED") {
      throw ApiError.notFound("Document not available");
    }

    const data = await getObject(document.storageKey);
    if (!data) throw ApiError.notFound("Document content missing");

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Delete a document. Requires write role + tenant ownership. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireMemberWriteContext(token);

    const document = await prisma.document.findUnique({
      where: { id },
      include: { request: { select: { clientId: true } } },
    });

    if (!document || document.request.clientId !== ctx.clientId) {
      throw ApiError.notFound("Document not found");
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { retentionStatus: "DELETED", uploadStatus: "FAILED" },
    });

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        clientId: ctx.clientId,
        action: "DOCUMENT_DELETED",
        resource: "document",
        resourceId: document.id,
        metadata: JSON.stringify({ fileName: document.fileName }),
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
