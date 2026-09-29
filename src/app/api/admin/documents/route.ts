import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { deleteStorageObjects, readDeleteId, requireAdminForDelete } from "@/lib/admin-delete";

/** GET — list documents across clients */
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

/**
 * DELETE — permanently remove a client document and its stored file
 * (ADMIN only). Body: { id }.
 */
export async function DELETE(request: Request) {
  try {
    const admin = await requireAdminForDelete(request);
    const id = await readDeleteId(request);

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, fileName: true, storageKey: true, request: { select: { clientId: true } } },
    });
    if (!doc) throw ApiError.notFound("Document not found");

    await prisma.document.delete({ where: { id } });
    await deleteStorageObjects([doc.storageKey]);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: doc.request.clientId,
        action: "DOCUMENT_DELETED",
        resource: "document",
        resourceId: id,
        metadata: JSON.stringify({ action: "DOCUMENT_HARD_DELETED", fileName: doc.fileName }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
