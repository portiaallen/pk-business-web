import { NextResponse } from "next/server";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  getAuthContext,
  hasRole,
} from "@/lib/auth";

export async function GET(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // For client users, include client context
  if (hasRole(user, "CLIENT")) {
    const authCtx = await getAuthContext(token);
    return NextResponse.json({
      user,
      client: authCtx
        ? {
            id: authCtx.clientId,
            name: authCtx.clientName,
            role: authCtx.memberRole,
          }
        : null,
    });
  }

  // Admin/staff users
  return NextResponse.json({ user, client: null });
}
