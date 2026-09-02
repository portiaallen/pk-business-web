import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

/** POST — admin requests a document from a client (audit logged). */
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
        metadata: JSON.stringify({ requestId: id, title }),
      },
    });

    return NextResponse.json({ id: docRequest.id, title: docRequest.title });
  } catch (error) {
    return handleApiError(error);
  }
}
