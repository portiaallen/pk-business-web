import { requireAdminApiAccess } from "@/lib/admin-access";
import { safeAuditMetadata } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { readDeleteId, requireAdminForDelete } from "@/lib/admin-delete";

/** POST — admin requests a document from a client (audit logged). */
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

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      select: { clientId: true },
    });
    if (!req) throw ApiError.notFound("Request not found");

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw ApiError.badRequest("Title is required");
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const required = body.required !== false;

    const docRequest = await prisma.documentRequest.create({
      data: { requestId: id, title, description, required },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clientId: req.clientId,
        action: "ADMIN_ACTION",
        resource: "document_request",
        resourceId: docRequest.id,
        metadata: safeAuditMetadata({ requestId: id, title }),
      },
    });

    return NextResponse.json({ id: docRequest.id, title: docRequest.title });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — remove a document request (ADMIN only). Body: { id }. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireAdminForDelete(request);
    const docRequestId = await readDeleteId(request);

    const docRequest = await prisma.documentRequest.findUnique({
      where: { id: docRequestId },
      select: { id: true, requestId: true, title: true, request: { select: { clientId: true } } },
    });
    if (!docRequest || docRequest.requestId !== id) {
      throw ApiError.notFound("Document request not found");
    }

    await prisma.documentRequest.delete({ where: { id: docRequest.id } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: docRequest.request.clientId,
        action: "ADMIN_ACTION",
        resource: "document_request",
        resourceId: docRequest.id,
        metadata: safeAuditMetadata({
          action: "DOCUMENT_REQUEST_DELETED",
          requestId: id,
          title: docRequest.title,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
