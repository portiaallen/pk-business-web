// Admin API for the internal Catch-Up 1040 intake pipeline. Staff-only.
// Statuses follow the founder-approved pipeline: new lead, needs review,
// quote sent, accepted, documents requested, in progress, completed.
import { requireAdminApiAccess } from "@/lib/admin-access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError } from "@/lib/api-error";

const STATUS_VALUES = [
  "NEW_LEAD",
  "NEEDS_REVIEW",
  "QUOTE_SENT",
  "ACCEPTED",
  "DOCUMENTS_REQUESTED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export async function GET(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const intakes = await prisma.taxCatchupIntake.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      intakes.map((i) => ({
        id: i.id,
        fullName: i.fullName,
        email: i.email,
        phone: i.phone,
        contactMethod: i.contactMethod,
        contactTime: i.contactTime,
        taxYears: JSON.parse(i.taxYears) as string[],
        filingStatuses: JSON.parse(i.filingStatuses) as Record<string, string>,
        alreadyFiled: JSON.parse(i.alreadyFiled) as Record<string, string>,
        complexity: JSON.parse(i.complexity) as string[],
        notes: i.notes,
        states: JSON.parse(i.states) as string[],
        hasNotices: i.hasNotices,
        recordsStatus: i.recordsStatus,
        simpleEligible: i.simpleEligible,
        status: i.status,
        emailSent: i.emailSent,
        createdAt: i.createdAt,
      })),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal();
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      status?: unknown;
    };
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!id || !(STATUS_VALUES as readonly string[]).includes(status)) {
      throw ApiError.badRequest("Invalid intake update.");
    }

    const updated = await prisma.taxCatchupIntake.update({
      where: { id },
      data: { status: status as (typeof STATUS_VALUES)[number] },
    });

    return NextResponse.json({ success: true, id: updated.id, status: updated.status });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal();
  }
}
