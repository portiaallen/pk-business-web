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
import { readDeleteId, requireAdminForDelete } from "@/lib/admin-delete";

export async function GET(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        clientMemberships: {
          include: { client: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
        clientMemberships: u.clientMemberships.map((m) => ({
          id: m.id,
          clientId: m.clientId,
          clientName: m.client.name,
          role: m.role,
        })),
        requestCount: u.clientMemberships.reduce((acc, m) => acc, 0),
        sessionCount: 0,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE — permanently remove a user account (ADMIN only). Body: { id }.
 * Refuses self-delete, deleting the last remaining admin, and deleting users
 * who authored content (notes/messages/time/QB reviews cascade on user
 * delete, so deleting them would destroy engagement records).
 */
export async function DELETE(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const admin = await requireAdminForDelete(request);
    const id = await readDeleteId(request);

    if (id === admin.id) {
      throw ApiError.badRequest("You cannot delete your own account while signed in.");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw ApiError.notFound("User not found");

    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw ApiError.conflict("Cannot delete the last remaining admin account.");
      }
    }

    const [authoredNotes, authoredMessages, timeEntries, qbReviews] = await Promise.all([
      prisma.internalNote.count({ where: { authorId: id } }),
      prisma.clientMessage.count({ where: { authorId: id } }),
      prisma.timeEntry.count({ where: { userId: id } }),
      prisma.qbCleanupReview.count({ where: { reviewerId: id } }),
    ]);
    const authored = authoredNotes + authoredMessages + timeEntries + qbReviews;
    if (authored > 0) {
      throw ApiError.conflict(
        `${user.name} has ${authored} note(s)/message(s)/time entry(ies)/review(s) on record. Deleting this account would also delete that history — set the user INACTIVE instead.`
      );
    }

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_ACTION",
        resource: "user",
        resourceId: id,
        metadata: safeAuditMetadata({
          action: "USER_HARD_DELETED",
          email: user.email,
          role: user.role,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
