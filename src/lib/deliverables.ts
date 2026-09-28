import { prisma } from "@/lib/prisma";

/**
 * Deliverable release gate — fail closed.
 *
 * A deliverable may only be RELEASED to a client when ALL hold, using
 * actual recorded data (no assumptions):
 *   0. The request's service is QuickBooks Cleanup (matched on the stable
 *      `Service.slug`, never on display names). Any other service is
 *      rejected BEFORE QA/payment evaluation — not supported yet.
 *   1. Documented QA completion on the request:
 *      - QuickBooks Cleanup: QbCleanupReview.status === COMPLETED
 *   2. Every non-draft, non-void invoice linked to this request is fully
 *      PAID, computed from recorded Payment totals, not display status.
 */

/** Stable identifier of the only service with a supported QA record today. */
const QB_CLEANUP_SERVICE_SLUG = "quickbooks-cleanup";

export type ReleaseReadiness =
  | { ok: true }
  | { ok: false; reasons: string[] };

export async function checkReleaseReadiness(requestId: string): Promise<ReleaseReadiness> {
  const reasons: string[] = [];

  // ── 1. QA evidence (fail closed when absent) ────────────────────────────────
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      service: { select: { slug: true, name: true } },
      qbCleanupReview: { select: { status: true, completedAt: true } },
    },
  });

  if (!request) return { ok: false, reasons: ["Request not found"] };

  const { qbCleanupReview, service } = request;

  // ── 0. Service check — explicit early rejection before QA/payment eval ────
  if (service.slug !== QB_CLEANUP_SERVICE_SLUG) {
    return {
      ok: false,
      reasons: [
        `Service "${service.name}" does not have a supported QA record yet — deliverable release is only available for QuickBooks Cleanup engagements.`,
      ],
    };
  }

  if (!qbCleanupReview || qbCleanupReview.status !== "COMPLETED" || !qbCleanupReview.completedAt) {
    reasons.push(
      `QA not completed: QuickBooks Cleanup review is ${qbCleanupReview ? qbCleanupReview.status : "NOT_STARTED"} — mark the review COMPLETED before releasing deliverables.`
    );
  }

  // ── 2. Payment evidence: all linked invoices fully PAID ────────────────────
  const invoices = await prisma.invoice.findMany({
    where: { requestId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amountCents: true,
      payments: { select: { status: true, amountCents: true } },
    },
  });

  for (const inv of invoices) {
    if (inv.status === "DRAFT") {
      reasons.push(`Invoice ${inv.invoiceNumber} is still a draft — send it before releasing deliverables.`);
      continue;
    }
    if (inv.status === "VOID" || inv.status === "CANCELLED") continue; // no money owed on voided invoices

    const paidCents = inv.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amountCents, 0);

    // Only recorded PAID payments count — PENDING payments are not evidence.
    if (paidCents < inv.amountCents) {
      const remaining = ((inv.amountCents - paidCents) / 100).toFixed(2);
      reasons.push(`Invoice ${inv.invoiceNumber} has $${remaining} outstanding — record final payment before releasing deliverables.`);
    }
  }

  if (invoices.length === 0) {
    reasons.push("No invoice is linked to this request — link the engagement's final invoice before releasing deliverables.");
  }

  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true };
}

/** True when this request's service has a supported QA record (slug-stable). */
export async function hasSupportedQaRecord(requestId: string): Promise<boolean> {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      service: { select: { slug: true } },
      qbCleanupReview: { select: { status: true, completedAt: true } },
    },
  });
  return Boolean(
    request &&
      request.service.slug === QB_CLEANUP_SERVICE_SLUG &&
      request.qbCleanupReview &&
      request.qbCleanupReview.status === "COMPLETED" &&
      request.qbCleanupReview.completedAt
  );
}
