import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

const TIME_CATEGORIES = [
  "Initial QuickBooks File Review",
  "Account/Reconciliation Review",
  "Personal Credit Card Transaction Review",
  "Transaction Classification/Reclassification",
  "Bank & Credit Card Reconciliation",
  "Cleanup/Adjustments",
  "Financial Statement Review",
  "Supporting Documentation/Workpapers",
  "Final Quality Review",
  "Final Report Preparation",
  "Client Communication",
  "Administrative/Engagement Management",
];

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();
  return user;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** GET — list time entries for a request, or single entry by query param */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin(request);

    const url = new URL(request.url);
    const entryId = url.searchParams.get("entryId");
    const category = url.searchParams.get("category");

    if (entryId) {
      const entry = await prisma.timeEntry.findUnique({
        where: { id: entryId },
        include: { user: { select: { name: true } } },
      });
      if (!entry || entry.requestId !== id) throw ApiError.notFound("Time entry not found");
      return NextResponse.json({
        id: entry.id,
        category: entry.category,
        note: entry.note,
        startedAt: entry.startedAt.toISOString(),
        stoppedAt: entry.stoppedAt?.toISOString() || null,
        durationSeconds: entry.durationSeconds,
        durationDisplay: formatDuration(entry.durationSeconds),
        isManual: entry.isManual,
        isRunning: entry.stoppedAt === null,
      });
    }

    const where: Record<string, unknown> = { requestId: id };
    if (category) where.category = category;

    const entries = await prisma.timeEntry.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
    });

    const totalSeconds = entries
      .filter((e) => e.stoppedAt !== null)
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        category: e.category,
        note: e.note,
        startedAt: e.startedAt.toISOString(),
        stoppedAt: e.stoppedAt?.toISOString() || null,
        durationSeconds: e.durationSeconds,
        durationDisplay: formatDuration(e.durationSeconds),
        isManual: e.isManual,
        isRunning: e.stoppedAt === null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      totals: {
        totalSeconds,
        totalDisplay: formatDuration(totalSeconds),
        totalHours: totalSeconds / 3600,
        totalBillable: (totalSeconds / 3600) * 75,
      },
      categories: TIME_CATEGORIES,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — start a timer or create a manual entry */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin(request);

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      select: { id: true, clientId: true },
    });
    if (!req) throw ApiError.notFound("Request not found");

    const body = await request.json();
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const isManual = body.isManual === true;
    const durationSeconds = typeof body.durationSeconds === "number" ? Math.round(body.durationSeconds) : 0;

    if (!TIME_CATEGORIES.includes(category)) {
      throw ApiError.badRequest(`Invalid category. Valid: ${TIME_CATEGORIES.join(", ")}`);
    }

    // Prevent multiple running timers
    if (!isManual) {
      const runningTimer = await prisma.timeEntry.findFirst({
        where: { requestId: id, stoppedAt: null },
      });
      if (runningTimer) {
        throw ApiError.conflict(
          `A timer is already running (started ${runningTimer.startedAt.toISOString()}). Stop it first.`
        );
      }
    }

    let entry;
    if (isManual) {
      if (durationSeconds <= 0) {
        throw ApiError.badRequest("Manual entries require positive durationSeconds");
      }
      const manualStartedAt = new Date();
      const manualStoppedAt = new Date(manualStartedAt.getTime() + durationSeconds * 1000);
      entry = await prisma.timeEntry.create({
        data: {
          requestId: id,
          userId: admin.id,
          category,
          note: note || null,
          startedAt: manualStartedAt,
          stoppedAt: manualStoppedAt,
          durationSeconds,
          isManual: true,
        },
        include: { user: { select: { name: true } } },
      });
    } else {
      entry = await prisma.timeEntry.create({
        data: {
          requestId: id,
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
        clientId: req.clientId,
        action: "ADMIN_ACTION",
        resource: "time_entry",
        resourceId: entry.id,
        metadata: JSON.stringify({
          action: isManual ? "manual_entry_created" : "timer_started",
          requestId: id,
          category,
          isManual,
          durationSeconds: isManual ? durationSeconds : null,
        }),
      },
    });

    return NextResponse.json({
      id: entry.id,
      category: entry.category,
      note: entry.note,
      startedAt: entry.startedAt.toISOString(),
      stoppedAt: entry.stoppedAt?.toISOString() || null,
      durationSeconds: entry.durationSeconds,
      durationDisplay: formatDuration(entry.durationSeconds || 0),
      isManual: entry.isManual,
      isRunning: entry.stoppedAt === null,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — stop a running timer or edit a stopped entry */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin(request);

    const body = await request.json();
    const entryId = typeof body.id === "string" ? body.id : id;

    const existing = await prisma.timeEntry.findUnique({
      where: { id: entryId },
      include: { request: { select: { clientId: true } } },
    });
    if (!existing) throw ApiError.notFound("Time entry not found");

    // Stop a running timer
    if (existing.stoppedAt === null && body.stop !== false) {
      const now = new Date();
      const durationSeconds = Math.round((now.getTime() - existing.startedAt.getTime()) / 1000);

      const updated = await prisma.timeEntry.update({
        where: { id: entryId },
        data: { stoppedAt: now, durationSeconds },
        include: { user: { select: { name: true } } },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          clientId: existing.request.clientId,
          action: "ADMIN_ACTION",
          resource: "time_entry",
          resourceId: entryId,
          metadata: JSON.stringify({
            action: "timer_stopped",
            category: existing.category,
            durationSeconds,
          }),
        },
      });

      return NextResponse.json({
        id: updated.id,
        category: updated.category,
        note: updated.note,
        startedAt: updated.startedAt.toISOString(),
        stoppedAt: updated.stoppedAt ? updated.stoppedAt.toISOString() : null,
        durationSeconds: updated.durationSeconds,
        durationDisplay: formatDuration(updated.durationSeconds),
        isManual: updated.isManual,
        isRunning: false,
      });
    }

      // Edit a stopped/manual entry
      const newIsManual = body.isManual !== undefined ? body.isManual : existing.isManual;
      const newCategory = body.category || existing.category;
      const newNote = body.note !== undefined ? body.note : existing.note;
      const newDurationSeconds = body.durationSeconds !== undefined ? Math.round(body.durationSeconds) : existing.durationSeconds;

      if (body.category && !TIME_CATEGORIES.includes(body.category)) {
        throw ApiError.badRequest("Invalid category");
      }

      const updated2 = await prisma.timeEntry.update({
        where: { id: entryId },
        data: { category: newCategory, note: newNote || null, durationSeconds: newDurationSeconds, isManual: newIsManual },
        include: { user: { select: { name: true } } },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          clientId: existing.request.clientId,
          action: "ADMIN_ACTION",
          resource: "time_entry",
          resourceId: entryId,
          metadata: JSON.stringify({
            action: "time_entry_edited",
            previousCategory: existing.category,
            newCategory: newCategory,
            previousDurationSeconds: existing.durationSeconds,
            newDurationSeconds: newDurationSeconds,
          }),
        },
      });

      return NextResponse.json({
        id: updated2.id,
        category: updated2.category,
        note: updated2.note,
        startedAt: updated2.startedAt.toISOString(),
        stoppedAt: updated2.stoppedAt ? updated2.stoppedAt.toISOString() : null,
        durationSeconds: updated2.durationSeconds,
        durationDisplay: formatDuration(updated2.durationSeconds),
        isManual: updated2.isManual,
        isRunning: false,
      });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — remove a time entry (audit logged) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin(request);

    const existing = await prisma.timeEntry.findUnique({
      where: { id },
      include: { request: { select: { clientId: true } } },
    });
    if (!existing) throw ApiError.notFound("Time entry not found");

    await prisma.timeEntry.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        clientId: existing.request.clientId,
        action: "ADMIN_ACTION",
        resource: "time_entry",
        resourceId: id,
        metadata: JSON.stringify({
          action: "time_entry_deleted",
          category: existing.category,
          durationSeconds: existing.durationSeconds,
          startedAt: existing.startedAt.toISOString(),
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
