import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
  hasClientMemberRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { hashPassword } from "@/lib/auth";

const VALID_ROLES = ["OWNER", "MANAGER", "STAFF", "VIEWER"] as const;

/** GET — list members of the authenticated business (all roles may view). */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const members = await prisma.clientMember.findMany({
      where: { clientId: ctx.clientId },
      include: { user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        status: m.user.status,
        lastLoginAt: m.user.lastLoginAt?.toISOString() || null,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — invite a new member. Requires MANAGER+; cannot create OWNER unless OWNER. */
export async function POST(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);
    if (!hasClientMemberRole(ctx.memberRole, "MANAGER")) {
      throw ApiError.forbidden("Only managers and owners can invite members");
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !name || !password) {
      throw ApiError.badRequest("Name, email, and temporary password are required");
    }
    if (password.length < 10) {
      throw ApiError.badRequest("Temporary password must be at least 10 characters");
    }
    if (!VALID_ROLES.includes(role as never)) {
      throw ApiError.badRequest("Invalid role");
    }
    // Privilege escalation guard: only OWNER may grant OWNER/MANAGER
    if ((role === "OWNER" || role === "MANAGER") && ctx.memberRole !== "OWNER") {
      throw ApiError.forbidden("Only owners can grant owner or manager roles");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.clientMember.findFirst({
        where: { userId: existingUser.id, clientId: ctx.clientId },
      });
      if (existingMember) throw ApiError.conflict("User is already a member of this business");
    }

    const passwordHash = await hashPassword(password);
    const user = existingUser
      ? existingUser
      : await prisma.user.create({
          data: { email, name, passwordHash, role: "CLIENT", status: "ACTIVE" },
        });

    const member = await prisma.clientMember.create({
      data: { clientId: ctx.clientId, userId: user.id, role: role as never },
    });

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        clientId: ctx.clientId,
        action: "CLIENT_MEMBER_ADDED",
        resource: "client_member",
        resourceId: member.id,
        metadata: JSON.stringify({ email, role }),
      },
    });

    return NextResponse.json({ id: member.id, email: user.email, role: member.role });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — change a member's role. Escalation-safe. */
export async function PATCH(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);
    if (!hasClientMemberRole(ctx.memberRole, "MANAGER")) {
      throw ApiError.forbidden("Only managers and owners can change roles");
    }

    const body = await request.json();
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const role = typeof body.role === "string" ? body.role : "";
    if (!memberId || !VALID_ROLES.includes(role as never)) {
      throw ApiError.badRequest("memberId and valid role are required");
    }

    const member = await prisma.clientMember.findFirst({
      where: { id: memberId, clientId: ctx.clientId },
    });
    if (!member) throw ApiError.notFound("Member not found");

    // No self role changes — prevents privilege escalation
    if (member.userId === ctx.user.id) {
      throw ApiError.forbidden("You cannot change your own role");
    }
    // Only OWNER may grant OWNER/MANAGER, or modify an OWNER/MANAGER
    if (
      ((role === "OWNER" || role === "MANAGER") ||
        (member.role === "OWNER" || member.role === "MANAGER")) &&
      ctx.memberRole !== "OWNER"
    ) {
      throw ApiError.forbidden("Only owners can manage owner or manager roles");
    }

    await prisma.clientMember.update({ where: { id: memberId }, data: { role: role as never } });

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        clientId: ctx.clientId,
        action: "ADMIN_ACTION",
        resource: "client_member",
        resourceId: memberId,
        metadata: JSON.stringify({ roleChange: role }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — remove a member. OWNER required; cannot remove self or other owners unless owner. */
export async function DELETE(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId") || "";
    if (!memberId) throw ApiError.badRequest("memberId is required");

    const member = await prisma.clientMember.findFirst({
      where: { id: memberId, clientId: ctx.clientId },
    });
    if (!member) throw ApiError.notFound("Member not found");

    // No self-removal (prevents locking out the last owner accidentally via self)
    if (member.userId === ctx.user.id) {
      throw ApiError.forbidden("You cannot remove yourself");
    }
    if (member.role === "OWNER" && ctx.memberRole !== "OWNER") {
      throw ApiError.forbidden("Only owners can remove owners");
    }

    await prisma.clientMember.delete({ where: { id: memberId } });

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        clientId: ctx.clientId,
        action: "CLIENT_MEMBER_REMOVED",
        resource: "client_member",
        resourceId: memberId,
        metadata: JSON.stringify({ removedUserId: member.userId }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
