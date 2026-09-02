import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireMemberWriteContext,
  requireAuthContext,
} from "@/lib/auth";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  buildStorageKey,
  putObject,
} from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";

/**
 * Secure document upload.
 * - clientId derived from session membership (never from the request body)
 * - request ownership verified before associating the document
 * - MIME type + size validation
 * - tenant-scoped storage key
 */
export async function POST(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireMemberWriteContext(token);

    const form = await request.formData();
    const file = form.get("file");
    const requestId = typeof form.get("requestId") === "string" ? (form.get("requestId") as string) : "";
    const category = typeof form.get("category") === "string" ? (form.get("category") as string) : "OTHER";
    const documentRequestId = typeof form.get("documentRequestId") === "string" ? (form.get("documentRequestId") as string) : "";

    if (!(file instanceof File)) throw ApiError.badRequest("File is required");
    if (!requestId) throw ApiError.badRequest("requestId is required");

    // Verify the request belongs to THIS client's tenant
    const req = await prisma.verificationRequest.findUnique({
      where: { id: requestId },
      select: { clientId: true },
    });
    if (!req || req.clientId !== ctx.clientId) {
      throw ApiError.notFound("Request not found");
    }

    // Validations
    if (file.size <= 0) throw ApiError.badRequest("File is empty");
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw ApiError.badRequest("File exceeds the 25 MB limit");
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw ApiError.badRequest("File type not allowed");
    }
    if (!["IDENTITY", "INCOME", "EMPLOYMENT", "BUSINESS", "TAX", "BANKING", "OTHER"].includes(category)) {
      throw ApiError.badRequest("Invalid category");
    }

    // Optional: attach to a document request within the same tenant
    let documentRequestIdValue: string | null = null;
    if (documentRequestId) {
      const docReq = await prisma.documentRequest.findUnique({
        where: { id: documentRequestId },
        select: { requestId: true, status: true },
      });
      if (!docReq || docReq.requestId !== requestId) {
        throw ApiError.notFound("Document request not found");
      }
      documentRequestIdValue = docReq.requestId === requestId ? documentRequestId : null;
    }

    const storageKey = buildStorageKey(ctx.clientId, requestId, file.name);
    await putObject(storageKey, Buffer.from(await file.arrayBuffer()), file.type || undefined);

    const document = await prisma.document.create({
      data: {
        requestId,
        category: category as never,
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        storageKey,
        uploadStatus: "UPLOADED",
        reviewStatus: "PENDING",
        uploadedAt: new Date(),
        documentRequest: documentRequestIdValue
          ? { connect: { id: documentRequestIdValue } }
          : undefined,
      },
    });

    // If attached to a document request, mark it fulfilled
    if (documentRequestIdValue) {
      await prisma.documentRequest.update({
        where: { id: documentRequestIdValue },
        data: { status: "UPLOADED", documentId: document.id, reviewedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        clientId: ctx.clientId,
        action: "DOCUMENT_UPLOADED",
        resource: "document",
        resourceId: document.id,
        metadata: JSON.stringify({ requestId, fileName: file.name, size: file.size }),
      },
    });

    return NextResponse.json({
      id: document.id,
      fileName: document.fileName,
      status: document.uploadStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** List documents visible to the authenticated client (tenant-scoped). */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const documents = await prisma.document.findMany({
      where: { request: { clientId: ctx.clientId } },
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
