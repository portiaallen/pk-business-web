import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { paidCentsOf } from "@/lib/invoices";

/**
 * Build the AI-readable engagement context from existing PK data.
 * Reuses VerificationRequest, Service, Client, QbCleanupReview, TimeEntry,
 * Document, InternalNote, and Invoice — no duplicate systems.
 */

export type EngagementContext = {
  engagement: {
    requestId: string;
    clientName: string;
    engagementName: string;
    serviceType: string;
    period: string | null;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  scope: {
    included: string[];
    exclusions: string[];
    specialInstructions: string[];
  };
  financialExpectations: {
    quotedHours: number | null;
    hourlyRateCents: number | null;
    estimatedTotalCents: number | null;
    invoiceStatus: string | null;
    invoiceTotalCents: number | null;
    paidCents: number | null;
  };
  workTracking: {
    hoursWorked: number;
    activeTimer: boolean;
    hoursRemaining: number | null;
    projectedTotalHours: number | null;
  };
  reviewState: {
    manualReviewStatus: string | null;
    manualItemsTotal: number;
    manualItemsCompleted: number;
    manualFindingsOpen: number;
    clientQuestionsOpen: number;
    documentsLogged: number;
    documentsReceived: number;
  };
  priorDecisions: Array<{
    decision: string;
    notes: string | null;
    at: string;
  }>;
  advisorNotes: string[];
};

/** Extract scope info from the request's stored notes (engagement framework note). */
function extractScope(notes: string | null): {
  included: string[];
  exclusions: string[];
  specialInstructions: string[];
} {
  const included: string[] = [];
  const exclusions: string[] = [];
  const special: string[] = [];
  if (!notes) return { included, exclusions, specialInstructions: special };

  const lower = notes.toLowerCase();
  // Known scope facts for cleanup engagements (extend as engagements grow).
  if (lower.includes("amex") || lower.includes("american express")) {
    included.push("American Express account (per signed engagement)");
  }
  if (lower.includes("personal credit card") || lower.includes("personal card")) {
    included.push("Business expenses paid via personal credit card — reclassification review");
  }
  if (lower.includes("reconcil")) {
    included.push("Full-year reconciliation of included accounts");
  }
  if (lower.includes("exclude") || lower.includes("out of scope") || lower.includes("out-of-scope")) {
    special.push(notes.slice(0, 500));
  }
  if (lower.includes("preliminary") || lower.includes("estimate only")) {
    special.push("Scope is preliminary and subject to review of the actual QuickBooks file.");
  }
  return { included, exclusions, specialInstructions: special };
}

export async function getEngagementContext(requestId: string): Promise<EngagementContext> {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: {
      client: { select: { id: true, name: true, notes: true } },
      service: { select: { name: true, slug: true } },
      timeEntries: { orderBy: { startedAt: "desc" } },
      qbCleanupReview: {
        include: {
          checklistItems: true,
          findings: true,
          questions: true,
          docLogs: true,
        },
      },
      invoices: { include: { payments: true } },
      internalNotes: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!request) throw ApiError.notFound("Engagement not found.");

  const scope = extractScope(request.clientNotes ?? request.client.notes);
  const timeEntries = request.timeEntries;
  const secondsWorked = timeEntries.reduce((s, t) => s + (t.durationSeconds ?? 0), 0);
  const hoursWorked = Math.round((secondsWorked / 3600) * 100) / 100;
  const activeTimer = timeEntries.some((t) => t.stoppedAt === null);

  // Quoted hours / rate: derive from the invoice line items when available.
  let quotedHours: number | null = null;
  let hourlyRateCents: number | null = null;
  let estimatedTotalCents: number | null = null;
  const invoice = request.invoices[0];
  if (invoice) {
    estimatedTotalCents = invoice.amountCents;
    try {
      const items = JSON.parse(invoice.lineItems || "[]") as Array<{
        quantity: number;
        rateCents: number;
      }>;
      if (items.length === 1 && items[0].rateCents > 0) {
        hourlyRateCents = items[0].rateCents;
        quotedHours = items[0].quantity;
      }
    } catch {
      // ignore malformed line items
    }
  }

  const manualReview = request.qbCleanupReview;
  const hoursRemaining =
    quotedHours !== null ? Math.max(0, Math.round((quotedHours - hoursWorked) * 100) / 100) : null;
  const projectedTotalHours = hoursWorked; // refine as AI estimates mature

  return {
    engagement: {
      requestId: request.id,
      clientName: request.client.name,
      engagementName: request.requestType,
      serviceType: request.service.name,
      period: scope.included.find((s) => s.includes("2025")) ?? "TY2025",
      status: request.status,
      startedAt: request.submittedAt?.toISOString() ?? null,
      completedAt: request.completedAt?.toISOString() ?? null,
    },
    scope,
    financialExpectations: {
      quotedHours,
      hourlyRateCents,
      estimatedTotalCents,
      invoiceStatus: invoice ? invoice.status : null,
      invoiceTotalCents: invoice ? invoice.amountCents : null,
      paidCents: invoice ? paidCentsOf(invoice.payments) : null,
    },
    workTracking: {
      hoursWorked,
      activeTimer,
      hoursRemaining,
      projectedTotalHours,
    },
    reviewState: {
      manualReviewStatus: manualReview?.status ?? null,
      manualItemsTotal: manualReview?.checklistItems.length ?? 0,
      manualItemsCompleted:
        manualReview?.checklistItems.filter((i) => i.isCompleted || i.notApplicable).length ?? 0,
      manualFindingsOpen:
        manualReview?.findings.filter(
          (f) =>
            f.status === "NEEDS_INVESTIGATION" ||
            f.status === "CLEANUP" ||
            f.status === "CRITICAL"
        ).length ?? 0,
      clientQuestionsOpen:
        manualReview?.questions.filter((q) => q.status === "OPEN").length ?? 0,
      documentsLogged: manualReview?.docLogs.length ?? 0,
      documentsReceived: manualReview?.docLogs.filter((d) => d.docType !== "OTHER").length ?? 0,
    },
    priorDecisions: (manualReview?.findings ?? [])
      .filter((f) => f.notes)
      .slice(0, 5)
      .map((f) => ({ decision: f.finding, notes: f.notes, at: f.updatedAt.toISOString() })),
    advisorNotes: (request.internalNotes ?? []).map((n) => n.content ?? "").filter(Boolean).slice(0, 5),
  };
}

/** Compact text rendering of the context — used for the Claude system prompt. */
export function renderContextForPrompt(ctx: EngagementContext): string {
  const fe = ctx.financialExpectations;
  const wt = ctx.workTracking;
  const rs = ctx.reviewState;
  const fmt = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);
  return [
    `Client: ${ctx.engagement.clientName}`,
    `Engagement: ${ctx.engagement.engagementName} (${ctx.engagement.serviceType})`,
    `Period: ${ctx.engagement.period}`,
    `Status: ${ctx.engagement.status}`,
    `Scope included: ${ctx.scope.included.join("; ") || "not yet documented"}`,
    `Scope exclusions: ${ctx.scope.exclusions.join("; ") || "none documented"}`,
    `Special instructions: ${ctx.scope.specialInstructions.join(" ") || "none"}`,
    `Quoted hours: ${fe.quotedHours ?? "—"}; rate: ${fe.hourlyRateCents ? `$${(fe.hourlyRateCents / 100).toFixed(2)}/hr` : "—"}; estimated total: ${fmt(fe.estimatedTotalCents)}`,
    `Payment: invoice ${fe.invoiceStatus ?? "none"} — ${fmt(fe.paidCents)} paid of ${fmt(fe.invoiceTotalCents)}`,
    `Hours worked: ${wt.hoursWorked}${fe.quotedHours ? ` of ${fe.quotedHours} quoted (${wt.hoursRemaining} remaining)` : ""}${wt.activeTimer ? " — TIMER RUNNING" : ""}`,
    `Manual review: ${rs.manualItemsCompleted}/${rs.manualItemsTotal} checklist items done, ${rs.manualFindingsOpen} open findings, ${rs.clientQuestionsOpen} open client questions, ${rs.documentsLogged} documents logged`,
  ].join("\n");
}
