// Admin/staff API for the Groupon voucher verification queue (pilot).
// Staff verify each claim's live voucher status in Groupon Merchant Center,
// then approve or reject here. Groupon's own voucher is marked redeemed only
// after an approval, per the pilot design. Every decision writes an audit row.
import { requireAdminApiAccess } from "@/lib/admin-access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTokenFromRequest, getSessionUser, hasRole } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
import { safeAuditMetadata } from "@/lib/security-log";

const ACTIONS = ["APPROVE", "REJECT", "MARK_REDEEMED", "REOPEN"] as const;
type Action = (typeof ACTIONS)[number];

const STATUS_FOR_ACTION: Record<Action, "APPROVED" | "REJECTED" | "REDEEMED" | "PENDING_REVIEW"> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  MARK_REDEEMED: "REDEEMED",
  REOPEN: "PENDING_REVIEW",
};

function auditEntry(action: string, by: string, notes: string | null) {
  const entry: Record<string, unknown> = {
    at: new Date().toISOString(),
    action,
    by,
  };
  if (notes) entry.notes = notes.slice(0, 500);
  return entry;
}

export async function GET(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const redemptions = await prisma.grouponRedemption.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      redemptions.map((r) => ({
        id: r.id,
        redemptionCode: r.redemptionCode,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        status: r.status,
        reviewedByStaffId: r.reviewedByStaffId,
        reviewNotes: r.reviewNotes,
        auditTrail: JSON.parse(r.auditTrail) as unknown[],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
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
      action?: unknown;
      notes?: unknown;
    };
    const id = typeof body.id === "string" ? body.id : "";
    const action = typeof body.action === "string" ? (body.action as Action) : ("" as Action);
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : "";
    if (!id || !(ACTIONS as readonly string[]).includes(action)) {
      throw ApiError.badRequest("Invalid verification update.");
    }

    const existing = await prisma.grouponRedemption.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound();

    const updated = await prisma.grouponRedemption.update({
      where: { id },
      data: {
        status: STATUS_FOR_ACTION[action],
        reviewedByStaffId: action === "REOPEN" ? null : user.id,
        reviewNotes: notes || (action === "REOPEN" ? null : existing.reviewNotes),
        auditTrail: JSON.stringify([
          ...JSON.parse(existing.auditTrail),
          auditEntry(action.toLowerCase(), user.id, notes || null),
        ]),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "ADMIN_ACTION",
        resource: "groupon_redemption",
        resourceId: id,
        metadata: safeAuditMetadata({
          action: `groupon_${action.toLowerCase()}`,
        }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      reviewedByStaffId: updated.reviewedByStaffId,
      reviewNotes: updated.reviewNotes,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal();
  }
}
