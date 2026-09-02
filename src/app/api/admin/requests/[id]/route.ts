import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

const VALID_STATUSES = [
  "DRAFT", "SUBMITTED", "DOCUMENTS_REQUIRED", "UNDER_REVIEW",
  "VERIFICATION_IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED",
] as const;

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();
  return user;
}

/** GET — full admin request detail: internal notes, documents, messages, everything. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin(request);

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, status: true } },
        service: { select: { name: true } },
        assignedStaff: { select: { id: true, name: true, email: true } },
        documents: { orderBy: { createdAt: "desc" } },
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
      documents: req.documents.map((d) => ({
        id: d.id, fileName: d.fileName, category: d.category,
        uploadStatus: d.uploadStatus, reviewStatus: d.reviewStatus,
        createdAt: d.createdAt.toISOString(),
      })),
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
        id: d.id, title: d.title, fileName: d.fileName,
        createdAt: d.createdAt.toISOString(),
      })),
    });
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
          metadata: JSON.stringify({ from: existing.status, to: body.status }),
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
          metadata: JSON.stringify({ assignedStaffId: body.assignedStaffId }),
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
