import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
} from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const messages = await prisma.clientMessage.findMany({
      where: {
        request: { clientId: ctx.clientId },
      },
      include: {
        author: { select: { name: true } },
        reads: { where: { userId: ctx.user.id }, select: { readAt: true } },
        request: {
          select: {
            id: true,
            requestType: true,
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      messages.map((m) => ({
        id: m.id,
        body: m.body,
        isFromStaff: m.isFromStaff,
        authorName: m.author.name,
        requestTitle: m.request.requestType || m.request.service.name,
        requestId: m.request.id,
        read: m.reads.length > 0,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
