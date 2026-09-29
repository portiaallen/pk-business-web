import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";
import { deleteStorageObjects, requireAdminForDelete } from "@/lib/admin-delete";
import { checkReleaseReadiness } from "@/lib/deliverables";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const { id, deliverableId } = await params;
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const deliverable = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: {
        request: { select: { clientId: true } },
      },
    });

    // Mismatched request/deliverable pair and unknown IDs are indistinguishable
    if (!deliverable || deliverable.requestId !== id) {
      throw ApiError.notFound("Deliverable not found");
    }

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

/**
 * DELETE — permanently remove a deliverable and its stored file (ADMIN only).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const { id, deliverableId } = await params;
    const admin = await requireAdminForDelete(request);

    const deliverable = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        requestId: true,
        storageKey: true,
        title: true,
        request: { select: { clientId: true } },
      },
    });
    if (!deliverable || deliverable.requestId !== id) {
      throw ApiError.notFound("Deliverable not found");
    }

    await prisma.deliverable.delete({ where: { id: deliverable.id } });
    await deleteStorageObjects([deliverable.storageKey]);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: deliverable.request.clientId,
        action: "ADMIN_ACTION",
        resource: "deliverable",
        resourceId: deliverable.id,
        metadata: JSON.stringify({
          action: "DELIVERABLE_DELETED",
          requestId: id,
          title: deliverable.title,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH — release (or retract) a deliverable.
 * Release fails closed unless QA is COMPLETED and every linked invoice is
 * fully PAID with recorded payments (see checkReleaseReadiness).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const { id, deliverableId } = await params;
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    // Release is a material client-facing action — ADMIN only.
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

    const body = (await request.json().catch(() => null)) as { visibility?: string } | null;
    if (!body || (body.visibility !== "RELEASED" && body.visibility !== "DRAFT")) {
      throw ApiError.badRequest("visibility must be \"RELEASED\" or \"DRAFT\"");
    }

    const deliverable = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: { id: true, requestId: true, visibility: true, title: true },
    });
    if (!deliverable || deliverable.requestId !== id) {
      throw ApiError.notFound("Deliverable not found");
    }

    if (body.visibility === "DRAFT") {
      // Retract is always allowed — it only narrows client access.
      await prisma.deliverable.update({
        where: { id: deliverable.id },
        data: { visibility: "DRAFT", releasedAt: null, releasedById: null },
      });
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          clientId: (await prisma.verificationRequest.findUnique({ where: { id }, select: { clientId: true } }))?.clientId ?? null,
          action: "ADMIN_ACTION",
          resource: "deliverable",
          resourceId: deliverable.id,
          metadata: JSON.stringify({ action: "DELIVERABLE_RETRACTED", requestId: id }),
        },
      });
      return NextResponse.json({ id: deliverable.id, visibility: "DRAFT" });
    }

    // ── Release gate: fail closed ──
    const readiness = await checkReleaseReadiness(id);
    if (!readiness.ok) {
      return NextResponse.json(
        { error: "Deliverable cannot be released yet", reasons: readiness.reasons },
        { status: 409 }
      );
    }

    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: { visibility: "RELEASED", releasedAt: new Date(), releasedById: user.id },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clientId: (await prisma.verificationRequest.findUnique({ where: { id }, select: { clientId: true } }))?.clientId ?? null,
        action: "ADMIN_ACTION",
        resource: "deliverable",
        resourceId: deliverable.id,
        metadata: JSON.stringify({ action: "DELIVERABLE_RELEASED", requestId: id, title: deliverable.title }),
      },
    });

    return NextResponse.json({ id: deliverable.id, visibility: "RELEASED" });
  } catch (error) {
    return handleApiError(error);
  }
}
