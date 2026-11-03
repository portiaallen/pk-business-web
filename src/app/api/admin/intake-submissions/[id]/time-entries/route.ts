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
import {
  CLARITY_TIME_CATEGORIES,
  isClarityTimeCategory,
} from "@/lib/clarity-fulfillment";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function requireStaff(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();
  return user;
}

/** GET — list fulfillment time entries for an intake submission. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    await requireStaff(request);

    const submission = await prisma.intakeSubmission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!submission) throw ApiError.notFound("Submission not found");

    const entries = await prisma.timeEntry.findMany({
      where: { intakeSubmissionId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
    });

    const totalSeconds = entries
      .filter((e) => e.stoppedAt !== null)
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        userName: e.user.name,
        category: e.category,
        note: e.note,
        startedAt: e.startedAt.toISOString(),
        stoppedAt: e.stoppedAt?.toISOString() || null,
        durationSeconds: e.durationSeconds,
        durationDisplay: formatDuration(e.durationSeconds),
        isManual: e.isManual,
        isRunning: e.stoppedAt === null,
      })),
      totals: { totalSeconds, totalDisplay: formatDuration(totalSeconds) },
      categories: CLARITY_TIME_CATEGORIES,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — start a timer or create a manual entry against an intake submission. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireStaff(request);

    const submission = await prisma.intakeSubmission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!submission) throw ApiError.notFound("Submission not found");

    const body = (await request.json().catch(() => null)) as {
      category?: string;
      note?: string;
      isManual?: boolean;
      durationSeconds?: number;
    } | null;
    const category = typeof body?.category === "string" ? body.category.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    const isManual = body?.isManual === true;
    const durationSeconds =
      typeof body?.durationSeconds === "number" ? Math.round(body.durationSeconds) : 0;

    if (!isClarityTimeCategory(category)) {
      throw ApiError.badRequest(`Invalid category. Valid: ${CLARITY_TIME_CATEGORIES.join(", ")}`);
    }

    if (!isManual) {
      const running = await prisma.timeEntry.findFirst({
        where: { intakeSubmissionId: id, stoppedAt: null },
      });
      if (running) {
        throw ApiError.conflict(
          "A timer is already running on this submission. Stop it first."
        );
      }
    }

    let entry;
    if (isManual) {
      if (durationSeconds <= 0) {
        throw ApiError.badRequest("Manual entries require positive durationSeconds");
      }
      const startedAt = new Date();
      entry = await prisma.timeEntry.create({
        data: {
          intakeSubmissionId: id,
          userId: admin.id,
          category,
          note: note || null,
          startedAt,
          stoppedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
          durationSeconds,
          isManual: true,
        },
        include: { user: { select: { name: true } } },
      });
    } else {
      entry = await prisma.timeEntry.create({
        data: {
          intakeSubmissionId: id,
          userId: admin.id,
          category,
          note: note || null,
          startedAt: new Date(),
        },
        include: { user: { select: { name: true } } },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_ACTION",
        resource: "time_entry",
        resourceId: entry.id,
        metadata: safeAuditMetadata({
          action: isManual ? "clarity_manual_entry_created" : "clarity_timer_started",
          intakeSubmissionId: id,
          category,
          isManual,
        }),
      },
    });

    return NextResponse.json(
      {
        id: entry.id,
        category: entry.category,
        note: entry.note,
        startedAt: entry.startedAt.toISOString(),
        stoppedAt: entry.stoppedAt?.toISOString() || null,
        durationSeconds: entry.durationSeconds,
        durationDisplay: formatDuration(entry.durationSeconds || 0),
        isManual: entry.isManual,
        isRunning: entry.stoppedAt === null,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — stop a running timer or edit a stopped entry. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireStaff(request);

    const body = (await request.json().catch(() => null)) as {
      id?: string;
      category?: string;
      note?: string;
      durationSeconds?: number;
      isManual?: boolean;
    } | null;
    const entryId = body?.id;
    if (!entryId) throw ApiError.badRequest("id is required");

    const existing = await prisma.timeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.intakeSubmissionId !== id) {
      throw ApiError.notFound("Time entry not found");
    }

    if (existing.stoppedAt === null) {
      const now = new Date();
      const durationSeconds = Math.round(
        (now.getTime() - existing.startedAt.getTime()) / 1000
      );
      const updated = await prisma.timeEntry.update({
        where: { id: entryId },
        data: { stoppedAt: now, durationSeconds },
        include: { user: { select: { name: true } } },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "ADMIN_ACTION",
          resource: "time_entry",
          resourceId: entryId,
          metadata: safeAuditMetadata({
            action: "clarity_timer_stopped",
            category: existing.category,
            durationSeconds,
          }),
        },
      });

      return NextResponse.json({
        id: updated.id,
        durationSeconds: updated.durationSeconds,
        durationDisplay: formatDuration(updated.durationSeconds),
        isRunning: false,
      });
    }

    if (body.category !== undefined && !isClarityTimeCategory(body.category)) {
      throw ApiError.badRequest("Invalid category");
    }

    const updated = await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        category: body.category ?? existing.category,
        note: body.note !== undefined ? body.note || null : existing.note,
        durationSeconds:
          body.durationSeconds !== undefined
            ? Math.round(body.durationSeconds)
            : existing.durationSeconds,
      },
      include: { user: { select: { name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_ACTION",
        resource: "time_entry",
        resourceId: entryId,
        metadata: safeAuditMetadata({
          action: "clarity_time_entry_edited",
          category: updated.category,
          durationSeconds: updated.durationSeconds,
        }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      durationSeconds: updated.durationSeconds,
      durationDisplay: formatDuration(updated.durationSeconds),
      isRunning: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — remove a fulfillment time entry (audit logged). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const admin = await requireStaff(request);

    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    const entryId = body?.id;
    if (!entryId) throw ApiError.badRequest("id is required");

    const existing = await prisma.timeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.intakeSubmissionId !== id) {
      throw ApiError.notFound("Time entry not found");
    }

    await prisma.timeEntry.delete({ where: { id: entryId } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_ACTION",
        resource: "time_entry",
        resourceId: entryId,
        metadata: safeAuditMetadata({
          action: "clarity_time_entry_deleted",
          category: existing.category,
          durationSeconds: existing.durationSeconds,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
