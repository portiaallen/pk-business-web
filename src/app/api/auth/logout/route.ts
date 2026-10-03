import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  hashToken,
} from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
export async function POST(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    if (token)
      await prisma.$transaction(async (tx) => {
        const session = await tx.session.findUnique({
          where: { tokenHash: hashToken(token) },
        });
        await tx.session.deleteMany({ where: { tokenHash: hashToken(token) } });
        if (session)
          await tx.auditLog.create({
            data: {
              actorId: session.userId,
              action: "LOGOUT",
              resource: "auth",
            },
          });
      });
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    // Never claim server revocation succeeded if persistence/auditing failed.
    const response = handleApiError(error);
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  }
}
