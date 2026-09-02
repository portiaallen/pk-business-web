import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireMemberWriteContext,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireMemberWriteContext(token);

    // Verify request belongs to this client (tenant isolation)
    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      select: { clientId: true },
    });
    if (!req || req.clientId !== ctx.clientId) {
      throw ApiError.notFound("Request not found");
    }

    const body = await request.json();
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!messageBody) throw ApiError.badRequest("Message body is required");

    const message = await prisma.clientMessage.create({
      data: {
        requestId: id,
        authorId: ctx.user.id,
        body: messageBody,
        isFromStaff: false,
      },
    });

    // Update request timestamp
    await prisma.verificationRequest.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ id: message.id, success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
