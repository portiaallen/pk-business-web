import { requireAdminApiAccess } from "@/lib/admin-access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

/** GET — list ADMIN/STAFF users for assignment UIs. */
export async function GET(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, status: "ACTIVE" },
      select: { id: true, name: true, email: true, role: true, securityVersion: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(staff);
  } catch (error) {
    return handleApiError(error);
  }
}
