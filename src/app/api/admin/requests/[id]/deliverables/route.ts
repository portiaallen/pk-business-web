import { requireAdminApiAccess } from "@/lib/admin-access";
import { requireDocumentRequestAccess } from "@/lib/document-access";
import { logSecurityEvent, safeAuditMetadata } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  buildStorageKey,
  putObject,
} from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";

/** POST — admin uploads a deliverable (report, workpaper) for a client request */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    await requireDocumentRequestAccess(user, id);
    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      select: { clientId: true },
    });
    if (!req) throw ApiError.notFound("Request not found");

    const form = await request.formData();
    const file = form.get("file");
    const titleRaw = form.get("title");
    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";

    if (!(file instanceof File)) throw ApiError.badRequest("File is required");
    if (!title) throw ApiError.badRequest("Title is required");
    if (file.size <= 0) throw ApiError.badRequest("File is empty");
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw ApiError.badRequest("File exceeds the 25 MB limit");
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw ApiError.badRequest("File type not allowed");
    }

    const storageKey = buildStorageKey(req.clientId, id, file.name);
    try {
      await putObject(storageKey, Buffer.from(await file.arrayBuffer()), file.type || undefined);
    } catch {
      logSecurityEvent("DELIVERABLE_STORAGE_FAILURE");
      throw new ApiError(
        503,
        "File storage is unavailable. The deliverable was not saved. Please retry."
      );
    }

    const deliverable = await prisma.deliverable.create({
      data: {
        requestId: id,
        title,
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        storageKey,
        uploadedById: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clientId: req.clientId,
        action: "DELIVERABLE_UPLOADED",
        resource: "deliverable",
        resourceId: deliverable.id,
        metadata: safeAuditMetadata({ requestId: id }),
      },
    });

    return NextResponse.json({
      id: deliverable.id,
      title: deliverable.title,
      fileName: deliverable.fileName,
      visibility: "DRAFT",
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
