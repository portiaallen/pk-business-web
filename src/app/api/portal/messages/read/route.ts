import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

/** POST — mark messages as read (tenant-scoped, per-user receipts). */
export async function POST(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const body = await request.json();
    const messageIds: unknown = body.messageIds;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw ApiError.badRequest("messageIds array is required");
    }
    if (messageIds.length > 200) throw ApiError.badRequest("Too many message IDs");

    // Only messages within this tenant may be marked read
    const count = await prisma.clientMessage.count({
      where: {
        id: { in: messageIds as string[] },
        request: { clientId: ctx.clientId },
      },
    });
    if (count !== messageIds.length) {
      // Some IDs are foreign or unknown — reject entirely (no partial leak signals)
      throw ApiError.notFound("One or more messages not found");
    }

    // Deduplicate — createMany has no skipDuplicates support on this adapter
    const existing = await prisma.clientMessageRead.findMany({
      where: { userId: ctx.user.id, messageId: { in: messageIds as string[] } },
      select: { messageId: true },
    });
    const existingSet = new Set(existing.map((r) => r.messageId));
    const toCreate = [...new Set(messageIds as string[])]
      .filter((messageId) => !existingSet.has(messageId))
      .map((messageId) => ({ messageId, userId: ctx.user.id }));
    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.map((item) => prisma.clientMessageRead.create({ data: item }))
      );
    }

    return NextResponse.json({ success: true, marked: messageIds.length });
  } catch (error) {
    return handleApiError(error);
  }
}
