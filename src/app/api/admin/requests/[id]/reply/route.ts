import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { readDeleteId, requireAdminForDelete } from "@/lib/admin-delete";

/** POST — admin/staff replies to a client on a request thread. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!messageBody) throw ApiError.badRequest("Message body is required");

    const message = await prisma.clientMessage.create({
      data: { requestId: id, authorId: user.id, body: messageBody, isFromStaff: true },
    });

    await prisma.verificationRequest.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ id: message.id, success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — permanently remove a message from the thread (ADMIN only). Body: { id }. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdminForDelete(request);
    const messageId = await readDeleteId(request);

    const message = await prisma.clientMessage.findUnique({
      where: { id: messageId },
      select: { id: true, requestId: true, body: true, request: { select: { clientId: true } } },
    });
    if (!message || message.requestId !== id) throw ApiError.notFound("Message not found");

    await prisma.clientMessage.delete({ where: { id: message.id } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: message.request.clientId,
        action: "ADMIN_ACTION",
        resource: "client_message",
        resourceId: message.id,
        metadata: JSON.stringify({
          action: "CLIENT_MESSAGE_DELETED",
          requestId: id,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
