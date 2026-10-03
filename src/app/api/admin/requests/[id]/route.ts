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
import {
  deleteRequestCascade,
  deleteStorageObjects,
  requireAdminForDelete,
} from "@/lib/admin-delete";

const VALID_STATUSES = [
  "DRAFT", "SUBMITTED", "DOCUMENTS_REQUIRED", "UNDER_REVIEW",
  "VERIFICATION_IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED",
] as const;

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();
  return user;
}

/** GET — full admin request detail: internal notes, documents, messages, everything. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    await requireAdmin(request);

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, status: true } },
        service: { select: { name: true } },
        assignedStaff: { select: { id: true, name: true, email: true } },
        documents: {
          where: { retentionStatus: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        },
        documentRequests: { orderBy: { createdAt: "desc" } },
        clientMessages: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
        internalNotes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        deliverables: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!req) throw ApiError.notFound("Request not found");

    const uploadEvents = req.documents.length
      ? await prisma.auditLog.findMany({
          where: {
            action: "DOCUMENT_UPLOADED",
            resource: "document",
            resourceId: { in: req.documents.map((document) => document.id) },
          },
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const uploadInfo = new Map<string, { uploadedAt: Date; uploadedBy: string | null }>();
    for (const event of uploadEvents) {
      if (event.resourceId && !uploadInfo.has(event.resourceId)) {
        uploadInfo.set(event.resourceId, {
          uploadedAt: event.createdAt,
          uploadedBy: event.actor?.name ?? null,
        });
      }
    }

    return NextResponse.json({
      id: req.id,
      client: req.client,
      service: req.service.name,
      requestType: req.requestType,
      status: req.status,
      clientNotes: req.clientNotes,
      requesterName: req.requesterName,
      requesterEmail: req.requesterEmail,
      assignedStaff: req.assignedStaff,
      submittedAt: req.submittedAt?.toISOString() || null,
      completedAt: req.completedAt?.toISOString() || null,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
      documents: req.documents.map((d) => {
        const upload = uploadInfo.get(d.id);
        return {
          id: d.id, fileName: d.fileName, category: d.category,
          uploadStatus: d.uploadStatus, reviewStatus: d.reviewStatus,
          createdAt: d.createdAt.toISOString(),
          uploadedAt: (upload?.uploadedAt ?? d.uploadedAt)?.toISOString() ?? null,
          uploadedBy: upload?.uploadedBy ?? null,
        };
      }),
      documentRequests: req.documentRequests.map((dr) => ({
        id: dr.id, title: dr.title, description: dr.description,
        required: dr.required, status: dr.status,
      })),
      messages: req.clientMessages.map((m) => ({
        id: m.id, body: m.body, isFromStaff: m.isFromStaff,
        authorName: m.author.name, createdAt: m.createdAt.toISOString(),
      })),
      // Internal notes: ADMIN ONLY — this route is admin-gated
      internalNotes: req.internalNotes.map((n) => ({
        id: n.id, content: n.content, authorName: n.author?.name || "System",
        createdAt: n.createdAt.toISOString(),
      })),
      deliverables: req.deliverables.map((d) => ({
        id: d.id, title: d.title, fileName: d.fileName, visibility: d.visibility,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE — hard-delete a request (engagement) and its children (ADMIN only).
 * Removes documents/deliverables (incl. stored files), notes, messages, form
 * submissions, document requests, time entries, QB review, and AI review.
 * Invoices/payments are detached (SetNull), not deleted.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireAdminForDelete(request);

    const existing = await prisma.verificationRequest.findUnique({
      where: { id },
      select: { id: true, clientId: true, requestType: true },
    });
    if (!existing) throw ApiError.notFound("Request not found");

    const storageKeys = await deleteRequestCascade(id);
    await deleteStorageObjects(storageKeys);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: existing.clientId,
        action: "ADMIN_ACTION",
        resource: "verification_request",
        resourceId: id,
        metadata: safeAuditMetadata({
          action: "REQUEST_HARD_DELETED",
          requestType: existing.requestType,
          filesRemoved: storageKeys.length,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — assign staff and/or change status (audit logged). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireAdmin(request);

    const existing = await prisma.verificationRequest.findUnique({
      where: { id }, select: { id: true, status: true, clientId: true },
    });
    if (!existing) throw ApiError.notFound("Request not found");

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.assignedStaffId === "string" || body.assignedStaffId === null) {
      if (body.assignedStaffId) {
        const staff = await prisma.user.findUnique({
          where: { id: body.assignedStaffId },
          select: { role: true },
        });
        if (!staff || !["ADMIN", "STAFF"].includes(staff.role)) {
          throw ApiError.badRequest("Invalid staff assignment");
        }
      }
      data.assignedStaffId = body.assignedStaffId;
    }

    if (typeof body.status === "string") {
      if (!VALID_STATUSES.includes(body.status)) {
        throw ApiError.badRequest("Invalid status");
      }
      data.status = body.status;
      if (body.status === "COMPLETED") data.completedAt = new Date();
    }

    const updated = await prisma.verificationRequest.update({
      where: { id },
      data,
      include: { assignedStaff: { select: { name: true } } },
    });

    // Audit: status change and/or assignment
    if (body.status && body.status !== existing.status) {
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          clientId: existing.clientId,
          action: "REQUEST_STATUS_CHANGED",
          resource: "verification_request",
          resourceId: id,
          metadata: safeAuditMetadata({ from: existing.status, to: body.status }),
        },
      });
    }
    if ("assignedStaffId" in body) {
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          clientId: existing.clientId,
          action: "REQUEST_ASSIGNED",
          resource: "verification_request",
          resourceId: id,
          metadata: safeAuditMetadata({ assignedStaffId: body.assignedStaffId }),
        },
      });
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      assignedStaff: updated.assignedStaff?.name || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
