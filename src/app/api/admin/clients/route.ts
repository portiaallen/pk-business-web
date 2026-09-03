import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
  hashPassword,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { AuditAction } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: {
            members: true,
            verificationRequests: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        memberCount: c._count.members,
        requestCount: c._count.verificationRequests,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST — create a B2B client tenant with its OWNER account.
 * Admin-only. The generated password is returned exactly once in the response
 * (never logged, never stored in plaintext) so the admin can relay it to the
 * owner over their secure channel of choice.
 */
export async function POST(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const admin = await getSessionUser(token);
    if (!admin || !hasRole(admin, "ADMIN")) throw ApiError.forbidden();

    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    if (!email || !name) {
      throw ApiError.badRequest("Business name and owner email are required");
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw ApiError.badRequest("Invalid email address");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw ApiError.conflict("An account with this email already exists");
    }

    // One-time credential: ~144 bits of entropy, never logged or stored in plaintext.
    const password = randomBytes(18).toString("base64url");
    const passwordHash = await hashPassword(password);

    const [newUser, client] = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          name: ownerName || name,
          passwordHash,
          role: "CLIENT",
          status: "ACTIVE",
        },
      });
      const c = await tx.client.create({
        data: { name, status: "ACTIVE", notes: notes || null },
      });
      await tx.clientMember.create({
        data: { clientId: c.id, userId: u.id, role: "OWNER" },
      });
      return [u, c] as const;
    });

    await prisma.auditLog.createMany({
      data: [
        {
          actorId: admin.id,
          clientId: client.id,
          action: AuditAction.CLIENT_CREATED,
          resource: "client",
          resourceId: client.id,
          metadata: JSON.stringify({ email }),
        },
        {
          actorId: admin.id,
          action: AuditAction.USER_CREATED,
          resource: "user",
          resourceId: newUser.id,
          metadata: JSON.stringify({ email, role: "CLIENT" }),
        },
      ],
    });

    return NextResponse.json(
      {
        id: client.id,
        name: client.name,
        email: newUser.email,
        ownerName: newUser.name,
        // Shown once — the caller must relay it to the owner securely.
        oneTimePassword: password,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
