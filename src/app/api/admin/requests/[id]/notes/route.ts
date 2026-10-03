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

/** POST — add an internal note. NEVER exposed to clients. */
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
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) throw ApiError.badRequest("Note content is required");

    const note = await prisma.internalNote.create({
      data: { requestId: id, authorId: user.id, content },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clientId: req.clientId,
        action: "INTERNAL_NOTE_ADDED",
        resource: "internal_note",
        resourceId: note.id,
        metadata: safeAuditMetadata({ requestId: id }),
      },
    });

    return NextResponse.json({
      id: note.id,
      content: note.content,
      authorName: user.name,
      createdAt: note.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — permanently remove an internal note (ADMIN only). Body: { id }. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireAdminForDelete(request);
    const noteId = await readDeleteId(request);

    const note = await prisma.internalNote.findUnique({
      where: { id: noteId },
      select: { id: true, requestId: true, request: { select: { clientId: true } } },
    });
    if (!note || note.requestId !== id) throw ApiError.notFound("Note not found");

    await prisma.internalNote.delete({ where: { id: note.id } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: note.request.clientId,
        action: "ADMIN_ACTION",
        resource: "internal_note",
        resourceId: note.id,
        metadata: safeAuditMetadata({ action: "INTERNAL_NOTE_DELETED", requestId: id }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
