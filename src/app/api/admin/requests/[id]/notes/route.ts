import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

/** POST — add an internal note. NEVER exposed to clients. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

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
        metadata: JSON.stringify({ requestId: id }),
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
