import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const { deliverableId } = await params;
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const deliverable = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: {
        request: { select: { clientId: true } },
      },
    });

    if (!deliverable) throw ApiError.notFound("Deliverable not found");

    const data = await getObject(deliverable.storageKey);
    if (!data) throw ApiError.notFound("File not found");

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": deliverable.mimeType,
        "Content-Disposition": `attachment; filename=\"${encodeURIComponent(deliverable.fileName)}\"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
