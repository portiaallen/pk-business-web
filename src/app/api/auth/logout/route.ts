import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  destroySession,
  clearSessionCookie,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { AuditAction } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const token = getSessionTokenFromRequest(request);

  if (token) {
    // Find user for audit log before destroying session
    const session = await prisma.session.findUnique({
      where: { tokenHash: token },
      select: { userId: true },
    });

    await destroySession(token);

    if (session) {
      await prisma.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.LOGOUT,
          resource: "auth",
        },
      });
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
