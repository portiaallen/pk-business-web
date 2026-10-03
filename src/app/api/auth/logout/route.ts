import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  destroySession,
  getSessionUser,
  clearSessionCookie,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { AuditAction } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const token = getSessionTokenFromRequest(request);

  if (token) {
    // Find user for audit log before destroying session
    const user = await getSessionUser(token);

    await destroySession(token);

    if (user) {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
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
