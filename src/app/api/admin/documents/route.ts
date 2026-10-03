import { confidentialRequestFilter } from "@/lib/capabilities";
import { requireAdminApiAccess } from "@/lib/admin-access";
import { safeAuditMetadata } from "@/lib/security-log";
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
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const url = new URL(request.url);
    const clientId = user.activeClientId;
    if (url.searchParams.get("clientId") && url.searchParams.get("clientId") !== clientId) throw ApiError.forbidden();

    const where = {
      retentionStatus: "ACTIVE" as const,
      request: await confidentialRequestFilter(user),
    };

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

    const uploadEvents = documents.length
      ? await prisma.auditLog.findMany({
          where: {
            action: "DOCUMENT_UPLOADED",
            resource: "document",
            resourceId: { in: documents.map((document) => document.id) },
          },
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const uploadInfo = new Map<string, { uploadedAt: Date; uploadedBy: string | null }>();
    for (const event of uploadEvents) {
      if (event.resourceId && !uploadInfo.has(event.resourceId)) {
        uploadInfo.set(event.resourceId, {
          uploadedAt: event.createdAt,
          uploadedBy: event.actor?.name ?? null,
        });
      }
    }

    return NextResponse.json(
      documents.map((d) => {
        const upload = uploadInfo.get(d.id);
        return {
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
          uploadedAt: (upload?.uploadedAt ?? d.uploadedAt)?.toISOString() ?? null,
          uploadedBy: upload?.uploadedBy ?? null,
        };
      })
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
    await requireAdminApiAccess(request);
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
        metadata: safeAuditMetadata({ action: "DOCUMENT_HARD_DELETED" }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
