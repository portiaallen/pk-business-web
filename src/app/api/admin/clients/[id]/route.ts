import { requireAdminApiAccess } from "@/lib/admin-access";
import { safeAuditMetadata } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  deleteClientCascade,
  deleteStorageObjects,
  requireAdminForDelete,
} from "@/lib/admin-delete";

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();
  return user;
}

/** GET — full client detail: members, requests, documents, messages, activity */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    await requireAdmin(request);

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        verificationRequests: {
          include: {
            service: { select: { name: true } },
            assignedStaff: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            members: true,
            verificationRequests: true,
          },
        },
      },
    });

    if (!client) throw ApiError.notFound("Client not found");

    // Documents for this client's requests
    const documents = await prisma.document.findMany({
      where: { request: { clientId: id } },
      include: {
        request: { select: { id: true, requestType: true, service: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Messages for this client's requests
    const messages = await prisma.clientMessage.findMany({
      where: { request: { clientId: id } },
      include: {
        author: { select: { id: true, name: true, role: true } },
        request: { select: { id: true, requestType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Recent activity for this client
    const activity = await prisma.auditLog.findMany({
      where: { clientId: id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      id: client.id,
      name: client.name,
      status: client.status,
      notes: client.notes,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      memberCount: client._count.members,
      requestCount: client._count.verificationRequests,
      members: client.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        status: m.user.status,
        lastLoginAt: m.user.lastLoginAt?.toISOString() || null,
      })),
      requests: client.verificationRequests.map((r) => ({
        id: r.id,
        service: r.service.name,
        requestType: r.requestType,
        status: r.status,
        assignedStaff: r.assignedStaff?.name || null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        category: d.category,
        uploadStatus: d.uploadStatus,
        reviewStatus: d.reviewStatus,
        requestTitle: d.request.requestType || d.request.service.name,
        requestId: d.request.id,
        createdAt: d.createdAt.toISOString(),
      })),
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        isFromStaff: m.isFromStaff,
        authorName: m.author.name,
        authorRole: m.author.role,
        requestTitle: m.request.requestType,
        requestId: m.request.id,
        createdAt: m.createdAt.toISOString(),
      })),
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        resource: a.resource,
        resourceId: a.resourceId,
        actorName: a.actor?.name || null,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const VALID_CLIENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

/**
 * DELETE — hard-delete a client tenant and everything in it (ADMIN only).
 * Irreversible: removes requests, documents/deliverables (incl. stored files),
 * messages, notes, time entries, invoices, memberships, and tenant-only user
 * accounts. Refused when payments have been recorded.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireAdminForDelete(request);

    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw ApiError.notFound("Client not found");

    const result = await deleteClientCascade(id);
    await deleteStorageObjects(result.storageKeys);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_ACTION",
        resource: "client",
        resourceId: id,
        metadata: safeAuditMetadata({
          action: "CLIENT_HARD_DELETED",
          clientName: existing.name,
          ...result.counts,
          removedUserEmails: result.removedUserEmails,
        }),
      },
    });

    return NextResponse.json({ success: true, deleted: result.counts });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — update client status and/or notes (audit logged) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireAdmin(request);

    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    });
    if (!existing) throw ApiError.notFound("Client not found");

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.status === "string") {
      if (!VALID_CLIENT_STATUSES.includes(body.status as never)) {
        throw ApiError.badRequest("Invalid status");
      }
      data.status = body.status;
    }

    if (typeof body.notes === "string") {
      data.notes = body.notes.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const updated = await prisma.client.update({
      where: { id },
      data,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: id,
        action: "ADMIN_ACTION",
        resource: "client",
        resourceId: id,
        metadata: safeAuditMetadata({ action: "CLIENT_UPDATED", from: existing.status, to: updated.status, fieldsChanged: Object.keys(data) }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      notes: updated.notes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
