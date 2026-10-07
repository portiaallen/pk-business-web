import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { authorize as authorizeVault } from "@/lib/vault/authorization";
import { grantMatches } from "@/lib/capabilities";
import { requireRecentAuthentication } from "@/lib/auth";
import {
  assessmentAccess,
  audit,
  lockAssessment,
  requireDraft,
  requirePaid,
  session,
  type Tx,
} from "./access";
import {
  ACKNOWLEDGMENT,
  POLICY_VERSION,
  intakeInput,
  findingInput,
  libraryInput,
  clientRecommendation,
  addBusinessDays,
  resumeBusinessDeadline,
  DOCUMENT_KINDS,
  PRICE_CENTS,
  FULFILLMENT_STATES,
} from "./policy";
import { libraryAudit } from "./library";
import { notify } from "./notifications";
import { track } from "./analytics";
import {
  finalize,
  deliver,
  reportSnapshot,
  eligibleServices,
  snapshotDigest,
  renderReport,
  type ReportSnapshot,
} from "./reports";

const expected = z.number().int().min(0);
const id = z.string().min(1).max(64);
const text = z.string().trim().min(1).max(4000);
const adminInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("TRANSITION"),
      expectedVersion: expected,
      status: z.enum(FULFILLMENT_STATES),
      reason: z.enum([
        "REVIEW_READY",
        "MISSING_INFORMATION",
        "INFORMATION_RECEIVED",
        "DRAFT_STARTED",
        "QA_STARTED",
        "COMPLETED",
        "CUSTOMER_REQUEST",
        "DUPLICATE_PURCHASE",
        "SERVICE_UNAVAILABLE",
        "INCOMPLETE_INTAKE",
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal("SAVE_FINDING"),
      expectedVersion: expected,
      finding: findingInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("REMOVE_FINDING"),
      expectedVersion: expected,
      findingId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("SAVE_SUMMARY"),
      expectedVersion: expected,
      summary: text,
      strengths: text,
      priorityConcerns: text,
      limitations: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("ASSIGN_RECOMMENDATION"),
      expectedVersion: expected,
      findingId: id,
      replacementId: id.optional(),
      libraryEntryId: id.optional(),
      wording: libraryInput.optional(),
      saveToLibrary: z.boolean().default(false),
      ordering: z.number().int().min(0).max(1000).default(0),
    })
    .strict(),
  z
    .object({
      action: z.literal("REMOVE_RECOMMENDATION"),
      expectedVersion: expected,
      recommendationId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("REORDER_RECOMMENDATION"),
      expectedVersion: expected,
      recommendationId: id,
      ordering: z.number().int().min(0).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("QA_APPROVE"),
      expectedVersion: expected,
      previewReviewed: z.literal(true),
      evidenceReviewed: z.literal(true),
      recommendationsChecked: z.literal(true),
      clientSafe: z.literal(true),
    })
    .strict(),
  z
    .object({ action: z.literal("FINALIZE"), expectedVersion: expected })
    .strict(),
  z
    .object({
      action: z.literal("DELIVER"),
      expectedVersion: expected,
      reportId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("REOPEN_CORRECTION"),
      expectedVersion: expected,
      reason: z.literal("VERIFIED_FACTUAL_ERROR"),
    })
    .strict(),
  z
    .object({
      action: z.literal("REQUEST_DOCUMENT"),
      expectedVersion: expected,
      kind: z.enum(DOCUMENT_KINDS),
      required: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("LINK_VAULT_DOCUMENT"),
      expectedVersion: expected,
      evidenceId: id,
      vaultDocumentId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("RECORD_EXTERNAL_RECEIPT"),
      expectedVersion: expected,
      evidenceId: id,
      channel: z.enum(["TAXSMART_MYTAXOFFICE", "APPROVED_PK_SECURE_HANDOFF"]),
      externalReference: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
      verifiedReceived: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal("REMIND"), expectedVersion: expected }).strict(),
  z
    .object({
      action: z.literal("DECIDE_CREDIT"),
      expectedVersion: expected,
      approved: z.boolean(),
      qualifyingServiceId: id.optional(),
      reason: z.enum([
        "REPORT_RELATED_SERVICE",
        "UNRELATED_SERVICE",
        "OUTSIDE_PROVIDER",
        "INVOICE_NOT_QUALIFYING",
        "SERVICE_UNAVAILABLE",
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal("APPLY_CREDIT"),
      expectedVersion: expected,
      invoiceId: id,
    })
    .strict(),
]);
const portalInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("SAVE_INTAKE"),
      expectedVersion: expected,
      intake: intakeInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("SUBMIT"),
      expectedVersion: expected,
      acknowledgment: z.literal(ACKNOWLEDGMENT),
      accepted: z.literal(true),
      policyVersion: z.literal(POLICY_VERSION),
    })
    .strict(),
  z
    .object({
      action: z.literal("CLAIM_CREDIT"),
      expectedVersion: expected,
      serviceId: id,
    })
    .strict(),
]);
function invalidatesQa() {
  return {
    status: "REPORT_DRAFT",
    qaReviewedAt: null,
    qaReviewedById: null,
    qaDraftVersion: null,
  };
}
const transitions: Record<string, readonly string[]> = {
  PAID: ["CLOSED", "CANCELLED"],
  INTAKE_IN_PROGRESS: ["CLOSED", "CANCELLED"],
  READY_TO_SUBMIT: ["CLOSED", "CANCELLED"],
  SUBMITTED_FOR_REVIEW: [
    "IN_REVIEW",
    "AWAITING_INFORMATION",
    "CLOSED",
    "CANCELLED",
  ],
  AWAITING_INFORMATION: ["IN_REVIEW", "CLOSED", "CANCELLED"],
  IN_REVIEW: ["AWAITING_INFORMATION", "REPORT_DRAFT", "CLOSED"],
  REPORT_DRAFT: ["AWAITING_INFORMATION", "QA_REVIEW", "CLOSED"],
  QA_REVIEW: ["REPORT_DRAFT", "AWAITING_INFORMATION", "CLOSED"],
  DELIVERED: ["CLOSED"],
};
export async function expireCredit(
  tx: Tx,
  assessmentId: string,
  now = new Date(),
) {
  const c = await tx.readinessCredit.findUnique({ where: { assessmentId } });
  if (!c) return null;
  const expired =
    (c.status === "ELIGIBLE_UNCLAIMED" && now > c.claimDeadline) ||
    (["CLAIMED_PENDING_REVIEW", "APPROVED_AVAILABLE"].includes(c.status) &&
      now > c.redeemDeadline);
  if (expired) {
    const updated = await tx.readinessCredit.updateMany({
      where: { id: c.id, version: c.version, status: c.status },
      data: { status: "EXPIRED", version: { increment: 1 } },
    });
    if (updated.count) {
      const a = await tx.readinessAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
      });
      await audit(tx, null, a, "CREDIT_EXPIRED");
      return { ...c, status: "EXPIRED", version: c.version + 1 };
    }
  }
  return c;
}
export async function detail(
  request: Request,
  assessmentId: string,
  admin = false,
) {
  return prisma.$transaction(async (tx) => {
    const { user, assessment: a } = await assessmentAccess(
      tx,
      request,
      assessmentId,
      "read",
      admin,
    );
    const credit = await expireCredit(tx, a.id);
    const documents = await tx.readinessDocumentEvidence.findMany({
      where: { assessmentId: a.id },
      include: { request: true },
    });
    const common = {
      id: a.id,
      clientId: a.clientId,
      requestId: a.requestId,
      status: a.status,
      paymentStatus: a.paymentStatus,
      version: a.version,
      intake: JSON.parse(a.intakeData),
      submittedAt: a.submittedAt,
      reportDeliveredAt: a.reportDeliveredAt,
      policyVersion: POLICY_VERSION,
      acknowledgment: ACKNOWLEDGMENT,
      acknowledgmentAcceptedAt: a.acknowledgmentAcceptedAt,
      documents: documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        required: d.request.required,
        status: d.request.status,
        channel: d.channel,
        instruction:
          "Do not upload confidential documents here. PK will provide approved secure handoff instructions. TaxSmart/MyTaxOffice is used when appropriate; direct client Vault upload is not enabled.",
      })),
      credit: credit
        ? {
            status: credit.status,
            claimDeadline: credit.claimDeadline,
            redeemDeadline: credit.redeemDeadline,
            claimedAt: credit.claimedAt,
            requestedServiceId: credit.requestedServiceId,
            qualifyingServiceId: credit.qualifyingServiceId,
            decidedAt: credit.decidedAt,
            decisionReason: credit.decisionReason,
            amountAppliedCents: credit.amountAppliedCents,
            appliedAt: credit.appliedAt,
            invoiceId: credit.invoiceId,
          }
        : null,
      eligibleServices: await eligibleServices(tx, a.id),
      reports: await tx.readinessReportVersion.findMany({
        where: {
          assessmentId: a.id,
          ...(admin ? {} : { deliveryState: "DELIVERED" }),
        },
        select: {
          id: true,
          version: true,
          finalizedAt: true,
          deliveredAt: true,
          deliveryState: true,
        },
        orderBy: { version: "desc" },
      }),
    };
    await audit(tx, user.id, a, "ASSESSMENT_VIEWED");
    if (!admin) return common;
    const grants = await tx.capabilityGrant.findMany({
      where: { userId: user.id },
    });
    const permitted = (
      cap: "readiness_review" | "readiness_qa" | "readiness_credit",
    ) => grants.some((g) => grantMatches(g, cap, a.clientId, a.requestId));
    return {
      ...common,
      clientName: (
        await tx.client.findUniqueOrThrow({ where: { id: a.clientId } })
      ).name,
      permissions: {
        edit: permitted("readiness_review"),
        qa: permitted("readiness_qa"),
        credit: permitted("readiness_credit"),
      },
      summary: a.summary,
      strengths: a.strengths,
      priorityConcerns: a.priorityConcerns,
      limitations: a.limitations,
      qaReviewedAt: a.qaReviewedAt,
      qaReviewedById: a.qaReviewedById,
      slaDueAt: a.slaDueAt,
      slaPausedAt: a.slaPausedAt,
      findings: await tx.readinessFinding.findMany({
        where: { assessmentId: a.id, active: true },
        orderBy: { ordering: "asc" },
      }),
      recommendations: await tx.assessmentRecommendation.findMany({
        where: { assessmentId: a.id, active: true },
        orderBy: { ordering: "asc" },
      }),
      audit: await tx.auditLog.findMany({
        where: { resource: "readiness", resourceId: a.id },
        select: { id: true, actorId: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  });
}
export async function portalMutation(
  request: Request,
  assessmentId: string,
  raw: unknown,
) {
  const input = portalInput.parse(raw);
  // Persist automatic expiry even when a late claim is rejected.
  if (input.action === "CLAIM_CREDIT")
    await prisma.$transaction(async (tx) => {
      await assessmentAccess(tx, request, assessmentId, "write");
      await expireCredit(tx, assessmentId);
    });
  return prisma.$transaction(async (tx) => {
    const { user, assessment: a } = await assessmentAccess(
      tx,
      request,
      assessmentId,
      "write",
    );
    requirePaid(a);
    if (input.action === "SUBMIT" && a.submittedAt)
      return { submitted: true, duplicate: true };
    if (input.action === "SAVE_INTAKE") {
      if (!["PAID", "INTAKE_IN_PROGRESS", "READY_TO_SUBMIT"].includes(a.status))
        throw ApiError.conflict(
          "Intake is no longer editable; respond through PK’s secure workflow",
        );
      await lockAssessment(tx, a, input.expectedVersion, {
        intakeData: JSON.stringify(input.intake),
        status: "READY_TO_SUBMIT",
      });
      await tx.client.update({
        where: { id: a.clientId },
        data: { name: input.intake.businessName },
      });
      await audit(tx, user.id, a, "INTAKE_SAVED");
      return { saved: true };
    }
    if (input.action === "SUBMIT") {
      if (a.status !== "READY_TO_SUBMIT")
        throw ApiError.conflict(
          "Complete and save the assessment before final submission",
        );
      intakeInput.parse(JSON.parse(a.intakeData));
      if (
        await tx.readinessDocumentEvidence.count({
          where: {
            assessmentId: a.id,
            request: {
              required: true,
              status: { notIn: ["ACCEPTED", "COMPLETED"] },
            },
          },
        })
      )
        throw ApiError.conflict(
          "Required secure information is still missing; follow PK’s secure instructions before submitting",
        );
      const now = new Date();
      await lockAssessment(tx, a, input.expectedVersion, {
        status: "SUBMITTED_FOR_REVIEW",
        submittedAt: now,
        policyVersion: POLICY_VERSION,
        acknowledgmentText: ACKNOWLEDGMENT,
        acknowledgmentAcceptedAt: now,
        acknowledgmentById: user.id,
      });
      await tx.verificationRequest.update({
        where: { id: a.requestId },
        data: { status: "SUBMITTED", submittedAt: now },
      });
      await audit(tx, user.id, a, "NON_REFUND_ACKNOWLEDGED");
      await audit(tx, user.id, a, "ASSESSMENT_SUBMITTED");
      await notify(tx, a.id, a.ownerUserId, "SUBMISSION", `${a.id}:submitted`);
      await track(tx, "assessment_submitted", a.id);
      return { submitted: true, duplicate: false };
    }
    const c = await tx.readinessCredit.findUnique({
      where: { assessmentId: a.id },
    });
    if (
      !c ||
      !a.reportDeliveredAt ||
      !["DELIVERED", "CLOSED"].includes(a.status)
    )
      throw ApiError.conflict("A successfully delivered report is required");
    if (
      ["CLAIMED_PENDING_REVIEW", "APPROVED_AVAILABLE", "APPLIED"].includes(
        c.status,
      ) &&
      c.requestedServiceId === input.serviceId
    )
      return { claimed: true, duplicate: true };
    if (c.status !== "ELIGIBLE_UNCLAIMED" || new Date() > c.claimDeadline)
      throw ApiError.conflict(
        "The credit claim window is closed or the assessment is not eligible",
      );
    if (
      !(await eligibleServices(tx, a.id)).some((s) => s.id === input.serviceId)
    )
      throw ApiError.badRequest(
        "Select a PK service related to a need in the delivered report",
      );
    await lockAssessment(tx, a, input.expectedVersion);
    const claimed = await tx.readinessCredit.updateMany({
      where: { id: c.id, version: c.version, status: "ELIGIBLE_UNCLAIMED" },
      data: {
        status: "CLAIMED_PENDING_REVIEW",
        claimedAt: new Date(),
        claimedBy: user.id,
        requestedServiceId: input.serviceId,
        version: { increment: 1 },
      },
    });
    if (!claimed.count) throw ApiError.conflict("Credit changed; retry safely");
    await audit(tx, user.id, a, "CREDIT_CLAIMED");
    await track(tx, "credit_claimed", a.id);
    return { claimed: true, pendingReview: true };
  });
}
export async function adminMutation(
  request: Request,
  assessmentId: string,
  raw: unknown,
) {
  const input = adminInput.parse(raw);
  const mode = ["QA_APPROVE", "FINALIZE", "DELIVER"].includes(input.action)
    ? "qa"
    : ["DECIDE_CREDIT", "APPLY_CREDIT"].includes(input.action)
      ? "credit"
      : "write";
  if (mode === "credit")
    await prisma.$transaction(async (tx) => {
      await assessmentAccess(tx, request, assessmentId, mode, true);
      await expireCredit(tx, assessmentId);
    });
  return prisma.$transaction(async (tx) => {
    const { user, assessment: a } = await assessmentAccess(
      tx,
      request,
      assessmentId,
      mode,
      true,
    );
    requirePaid(a);
    if (input.action === "DELIVER") {
      const existing = await tx.readinessReportVersion.findFirst({
        where: {
          id: input.reportId,
          assessmentId: a.id,
          deliveryState: "DELIVERED",
        },
      });
      if (existing) return { delivered: true, duplicate: true };
    }
    if (input.action === "APPLY_CREDIT") {
      const c = await tx.readinessCredit.findUnique({
        where: { assessmentId: a.id },
      });
      if (c?.status === "APPLIED" && c.invoiceId === input.invoiceId)
        return { applied: true, duplicate: true };
    }
    if (a.version !== input.expectedVersion)
      throw ApiError.conflict("Assessment changed; reload before continuing");
    if (input.action === "TRANSITION") {
      if (!transitions[a.status]?.includes(input.status))
        throw ApiError.conflict("Invalid readiness lifecycle transition");
      const now = new Date();
      const data: Parameters<typeof lockAssessment>[3] = {
        status: input.status,
      };
      if (input.status === "IN_REVIEW") {
        if (
          await tx.readinessDocumentEvidence.count({
            where: {
              assessmentId: a.id,
              request: {
                required: true,
                status: { notIn: ["ACCEPTED", "COMPLETED"] },
              },
            },
          })
        )
          throw ApiError.conflict(
            "Required secure information is still missing",
          );
        data.reviewReadyAt = a.reviewReadyAt ?? now;
        data.reviewStartedAt = a.reviewStartedAt ?? now;
        data.slaDueAt =
          a.slaPausedAt && a.slaDueAt
            ? resumeBusinessDeadline(a.slaDueAt, a.slaPausedAt, now)
            : (a.slaDueAt ?? addBusinessDays(now, 3));
        data.slaPausedAt = null;
      }
      if (input.status === "AWAITING_INFORMATION") {
        data.slaPausedAt = a.slaPausedAt ?? now;
        await notify(
          tx,
          a.id,
          a.ownerUserId,
          "MISSING_INFORMATION",
          `${a.id}:awaiting:${a.version}`,
        );
      }
      if (["CLOSED", "CANCELLED"].includes(input.status)) data.closedAt = now;
      if (["REPORT_DRAFT", "AWAITING_INFORMATION"].includes(input.status))
        Object.assign(data, {
          qaReviewedById: null,
          qaReviewedAt: null,
          qaDraftVersion: null,
        });
      await lockAssessment(tx, a, input.expectedVersion, data);
      await audit(tx, user.id, a, "STATUS_CHANGED", {
        from: a.status,
        to: input.status,
        reason: input.reason,
      });
      return { updated: true };
    }
    if (input.action === "REOPEN_CORRECTION") {
      if (!["DELIVERED", "CLOSED"].includes(a.status) || !a.reportDeliveredAt)
        throw ApiError.conflict(
          "A delivered report is required for a factual correction",
        );
      await lockAssessment(tx, a, input.expectedVersion, {
        ...invalidatesQa(),
        closedAt: null,
      });
      await audit(tx, user.id, a, "FACTUAL_CORRECTION_OPENED", {
        reason: input.reason,
      });
      return { updated: true };
    }
    if (input.action === "REMIND") {
      await notify(
        tx,
        a.id,
        a.ownerUserId,
        "REMINDER",
        `${a.id}:reminder:${new Date().toISOString().slice(0, 10)}`,
      );
      await audit(tx, user.id, a, "REMINDER_QUEUED");
      return { queued: true };
    }
    if (input.action === "DECIDE_CREDIT") {
      const c = await tx.readinessCredit.findUniqueOrThrow({
        where: { assessmentId: a.id },
      });
      if (
        c.status !== "CLAIMED_PENDING_REVIEW" ||
        !c.claimedAt ||
        c.claimedAt > c.claimDeadline ||
        new Date() > c.redeemDeadline
      )
        throw ApiError.conflict(
          "A timely claim within the redemption period is required",
        );
      if (input.approved) {
        if (
          !input.qualifyingServiceId ||
          input.reason !== "REPORT_RELATED_SERVICE" ||
          input.qualifyingServiceId !== c.requestedServiceId ||
          !(await eligibleServices(tx, a.id)).some(
            (s) => s.id === input.qualifyingServiceId,
          ) ||
          !(await tx.service.findFirst({
            where: { id: input.qualifyingServiceId, status: "ACTIVE" },
          }))
        )
          throw ApiError.badRequest(
            "Approve only a qualifying PK service from the delivered report",
          );
      } else if (input.reason === "REPORT_RELATED_SERVICE")
        throw ApiError.badRequest("A rejection reason is required");
      await lockAssessment(tx, a, input.expectedVersion);
      await tx.readinessCredit.update({
        where: { id: c.id },
        data: {
          status: input.approved ? "APPROVED_AVAILABLE" : "REJECTED",
          decidedAt: new Date(),
          decidedBy: user.id,
          decisionReason: input.reason,
          qualifyingServiceId: input.approved
            ? input.qualifyingServiceId
            : null,
          version: { increment: 1 },
        },
      });
      await audit(
        tx,
        user.id,
        a,
        input.approved ? "CREDIT_APPROVED" : "CREDIT_REJECTED",
        { reason: input.reason },
      );
      await notify(
        tx,
        a.id,
        a.ownerUserId,
        input.approved ? "CREDIT_APPROVED" : "CREDIT_REJECTED",
        `${a.id}:credit-decision`,
      );
      return { decided: true };
    }
    if (input.action === "APPLY_CREDIT") {
      const c = await tx.readinessCredit.findUniqueOrThrow({
        where: { assessmentId: a.id },
      });
      if (c.status === "APPLIED" && c.invoiceId === input.invoiceId)
        return { applied: true, duplicate: true };
      if (
        c.status !== "APPROVED_AVAILABLE" ||
        new Date() > c.redeemDeadline ||
        !c.qualifyingServiceId
      )
        throw ApiError.conflict("An approved unexpired credit is required");
      const grants = await tx.capabilityGrant.findMany({
        where: { userId: user.id },
      });
      if (!grants.some((g) => grantMatches(g, "payments", a.clientId)))
        throw ApiError.forbidden("Invoice payment capability is required");
      if (
        !(await tx.service.findFirst({
          where: { id: c.qualifyingServiceId, status: "ACTIVE" },
        }))
      )
        throw ApiError.conflict("Qualifying PK service is unavailable");
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { payments: true },
      });
      if (
        !invoice ||
        invoice.clientId !== a.clientId ||
        invoice.serviceId !== c.qualifyingServiceId ||
        invoice.currency !== "USD" ||
        invoice.id === a.invoiceId ||
        !["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID"].includes(
          invoice.status,
        )
      )
        throw ApiError.badRequest(
          "Select a valid qualifying invoice for this client and PK service",
        );
      const paidBefore = invoice.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amountCents, 0);
      const amount = Math.min(PRICE_CENTS, invoice.amountCents - paidBefore);
      if (amount <= 0)
        throw ApiError.badRequest(
          "Invoice has no qualifying outstanding balance",
        );
      await lockAssessment(tx, a, input.expectedVersion);
      const claimed = await tx.readinessCredit.updateMany({
        where: { id: c.id, status: "APPROVED_AVAILABLE", version: c.version },
        data: {
          status: "APPLIED",
          amountAppliedCents: amount,
          invoiceId: invoice.id,
          appliedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (!claimed.count)
        throw ApiError.conflict("Credit changed; retry safely");
      const payment = await tx.payment.create({
        data: {
          clientId: a.clientId,
          invoiceId: invoice.id,
          requestId: invoice.requestId,
          amountCents: amount,
          currency: "USD",
          status: "PAID",
          method: "READINESS_CREDIT",
          transactionReference: `readiness-credit:${c.id}`,
          paidAt: new Date(),
          notes: "One-time PK readiness service credit. No cash payment.",
        },
      });
      await tx.readinessCredit.update({
        where: { id: c.id },
        data: { paymentId: payment.id },
      });
      const invoiceUpdated = await tx.invoice.updateMany({
        where: { id: invoice.id, updatedAt: invoice.updatedAt },
        data: {
          status:
            paidBefore + amount >= invoice.amountCents
              ? "PAID"
              : "PARTIALLY_PAID",
          paidAt:
            paidBefore + amount >= invoice.amountCents ? new Date() : null,
          updatedAt: new Date(
            Math.max(Date.now(), invoice.updatedAt.getTime() + 1),
          ),
        },
      });
      if (!invoiceUpdated.count)
        throw ApiError.conflict("Invoice changed; retry safely");
      await tx.invoiceActivity.create({
        data: {
          invoiceId: invoice.id,
          event: "READINESS_CREDIT_APPLIED",
          actorId: user.id,
        },
      });
      await audit(tx, user.id, a, "CREDIT_APPLIED", { amountCents: amount });
      await track(tx, "credit_applied", a.id);
      return { applied: true, amountCents: amount };
    }
    if (input.action === "REQUEST_DOCUMENT") {
      if (
        ![
          "PAID",
          "INTAKE_IN_PROGRESS",
          "READY_TO_SUBMIT",
          "SUBMITTED_FOR_REVIEW",
          "AWAITING_INFORMATION",
          "IN_REVIEW",
          "REPORT_DRAFT",
        ].includes(a.status)
      )
        throw ApiError.conflict(
          "Document requests are unavailable in this state",
        );
      const doc = await tx.documentRequest.create({
        data: {
          requestId: a.requestId,
          title: input.kind.replaceAll("_", " "),
          required: input.required,
          clientInstruction:
            "PK will provide an approved secure handoff. Do not upload confidential records through ordinary document routes.",
        },
      });
      await tx.readinessDocumentEvidence.create({
        data: {
          assessmentId: a.id,
          documentRequestId: doc.id,
          kind: input.kind,
        },
      });
      await lockAssessment(
        tx,
        a,
        input.expectedVersion,
        a.submittedAt
          ? {
              status: "AWAITING_INFORMATION",
              slaPausedAt: a.slaPausedAt ?? new Date(),
              qaReviewedAt: null,
              qaReviewedById: null,
              qaDraftVersion: null,
            }
          : {},
      );
      await audit(tx, user.id, a, "SECURE_DOCUMENT_REQUESTED");
      await notify(
        tx,
        a.id,
        a.ownerUserId,
        "MISSING_INFORMATION",
        `${a.id}:document:${doc.id}`,
      );
      return { requested: true };
    }
    if (
      input.action === "LINK_VAULT_DOCUMENT" ||
      input.action === "RECORD_EXTERNAL_RECEIPT"
    ) {
      const evidence = await tx.readinessDocumentEvidence.findFirst({
        where: { id: input.evidenceId, assessmentId: a.id },
      });
      if (!evidence) throw ApiError.notFound();
      requireRecentAuthentication(user);
      if (input.action === "LINK_VAULT_DOCUMENT") {
        const doc = await tx.vaultDocument.findFirst({
          where: {
            id: input.vaultDocumentId,
            clientId: a.clientId,
            requestId: a.requestId,
            state: "RELEASED",
            disposalState: "NONE",
          },
        });
        if (!doc)
          throw ApiError.conflict(
            "A released authorized Vault document is required",
          );
        await authorizeVault(
          tx,
          request,
          {
            ...doc,
            taxInformation:
              doc.taxInformation || evidence.kind === "TAX_SOURCE_INFORMATION",
          },
          "vault_read",
          true,
        );
        await tx.readinessDocumentEvidence.update({
          where: { id: evidence.id },
          data: {
            channel: "VAULT",
            vaultDocumentId: doc.id,
            reviewedBy: user.id,
            reviewedAt: new Date(),
          },
        });
      } else {
        const grants = await tx.capabilityGrant.findMany({
          where: { userId: user.id },
        });
        if (
          evidence.kind === "TAX_SOURCE_INFORMATION" &&
          !grants.some((g) =>
            grantMatches(g, "tax_information_access", a.clientId, a.requestId),
          )
        )
          throw ApiError.forbidden();
        await tx.readinessDocumentEvidence.update({
          where: { id: evidence.id },
          data: {
            channel: input.channel,
            externalReference: input.externalReference,
            reviewedBy: user.id,
            reviewedAt: new Date(),
          },
        });
      }
      await tx.documentRequest.update({
        where: { id: evidence.documentRequestId },
        data: { status: "ACCEPTED", reviewedAt: new Date() },
      });
      await lockAssessment(tx, a, input.expectedVersion);
      await audit(tx, user.id, a, "SECURE_INFORMATION_RECEIPT_VERIFIED");
      return { linked: true };
    }
    requireDraft(a);
    if (input.action === "SAVE_FINDING") {
      const f = input.finding;
      if (
        f.qualifyingServiceId &&
        !(await tx.service.findFirst({
          where: {
            id: f.qualifyingServiceId,
            status: "ACTIVE",
            slug: { not: "readiness-assessment" },
          },
        }))
      )
        throw ApiError.badRequest(
          "An active qualifying PK service is required",
        );
      if (f.id) {
        const previous = await tx.readinessFinding.findFirst({
          where: { id: f.id, assessmentId: a.id, active: true },
        });
        if (!previous) throw ApiError.notFound();
        if (
          f.disposition !== "OUTSIDE_HELP_RECOMMENDED" &&
          (await tx.assessmentRecommendation.count({
            where: { findingId: f.id, active: true },
          }))
        )
          throw ApiError.conflict(
            "Remove outside recommendations before changing disposition",
          );
        await tx.readinessFinding.update({ where: { id: f.id }, data: f });
      } else
        await tx.readinessFinding.create({
          data: { ...f, assessmentId: a.id },
        });
      await lockAssessment(tx, a, input.expectedVersion, invalidatesQa());
      await audit(tx, user.id, a, "FINDING_SAVED");
      return { saved: true };
    }
    if (input.action === "REMOVE_FINDING") {
      const f = await tx.readinessFinding.findFirst({
        where: { id: input.findingId, assessmentId: a.id },
      });
      if (!f) throw ApiError.notFound();
      await tx.assessmentRecommendation.updateMany({
        where: { findingId: f.id, assessmentId: a.id },
        data: { active: false },
      });
      await tx.readinessFinding.update({
        where: { id: f.id },
        data: { active: false },
      });
      await lockAssessment(tx, a, input.expectedVersion, invalidatesQa());
      await audit(tx, user.id, a, "DRAFT_FINDING_REMOVED");
      return { removed: true };
    }
    if (input.action === "SAVE_SUMMARY") {
      await lockAssessment(tx, a, input.expectedVersion, {
        summary: input.summary,
        strengths: input.strengths,
        priorityConcerns: input.priorityConcerns,
        limitations: input.limitations,
        ...invalidatesQa(),
      });
      await audit(tx, user.id, a, "REPORT_DRAFT_SAVED");
      return { saved: true };
    }
    if (input.action === "ASSIGN_RECOMMENDATION") {
      const f = await tx.readinessFinding.findFirst({
        where: {
          id: input.findingId,
          assessmentId: a.id,
          active: true,
          disposition: "OUTSIDE_HELP_RECOMMENDED",
        },
      });
      if (!f) throw ApiError.badRequest("Choose an outside-help finding");
      let source = input.libraryEntryId
        ? await tx.recommendationLibraryEntry.findFirst({
            where: { id: input.libraryEntryId, active: true, archived: false },
          })
        : null;
      if (input.libraryEntryId && !source)
        throw ApiError.badRequest("Choose an active library entry");
      if (!source && !input.wording)
        throw ApiError.badRequest(
          "A library entry or one-off recommendation is required",
        );
      const fields = libraryInput.parse(
        input.wording ||
          (source
            ? {
                title: source.title,
                category: source.category,
                recommendationType: source.recommendationType,
                providerOrResourceName: source.providerOrResourceName,
                clientFacingDescription: source.clientFacingDescription,
                whyOrWhenToUse: source.whyOrWhenToUse,
                clientNextStep: source.clientNextStep,
                websiteUrl: source.websiteUrl,
                phone: source.phone,
                email: source.email,
                locationOrServiceArea: source.locationOrServiceArea,
                internalNotes: source.internalNotes,
                relationshipClassification: source.relationshipClassification,
                disclosureText: source.disclosureText,
                active: source.active,
                archived: source.archived,
              }
            : {}),
      );
      if (!fields.active || fields.archived)
        throw ApiError.badRequest("Recommendation must be active before use");
      if (input.saveToLibrary) {
        const grants = await tx.capabilityGrant.findMany({
          where: { userId: user.id },
        });
        if (!grants.some((g) => grantMatches(g, "readiness_library_write")))
          throw ApiError.forbidden();
        requireRecentAuthentication(user);
        source = await tx.recommendationLibraryEntry.create({
          data: { ...fields, createdBy: user.id, updatedBy: user.id },
        });
        await libraryAudit(
          tx,
          user.id,
          source.id,
          "LIBRARY_ENTRY_CREATED",
          source.version,
        );
      }
      if (input.replacementId) {
        const previous = await tx.assessmentRecommendation.findFirst({
          where: {
            id: input.replacementId,
            assessmentId: a.id,
            findingId: f.id,
            active: true,
          },
        });
        if (!previous) throw ApiError.notFound();
        await tx.assessmentRecommendation.update({
          where: { id: previous.id },
          data: { active: false },
        });
      }
      await tx.assessmentRecommendation.create({
        data: {
          assessmentId: a.id,
          findingId: f.id,
          libraryEntryId: source?.id,
          sourceVersion: source?.version,
          snapshot: JSON.stringify(clientRecommendation(fields)),
          ordering: input.ordering,
          createdBy: user.id,
        },
      });
      await lockAssessment(tx, a, input.expectedVersion, invalidatesQa());
      await audit(
        tx,
        user.id,
        a,
        input.replacementId
          ? "DRAFT_RECOMMENDATION_REPLACED"
          : "RECOMMENDATION_ASSIGNED",
      );
      return { assigned: true };
    }
    if (
      input.action === "REMOVE_RECOMMENDATION" ||
      input.action === "REORDER_RECOMMENDATION"
    ) {
      const r = await tx.assessmentRecommendation.findFirst({
        where: { id: input.recommendationId, assessmentId: a.id, active: true },
      });
      if (!r) throw ApiError.notFound();
      if (input.action === "REMOVE_RECOMMENDATION")
        await tx.assessmentRecommendation.update({
          where: { id: r.id },
          data: { active: false },
        });
      else
        await tx.assessmentRecommendation.update({
          where: { id: r.id },
          data: { ordering: input.ordering },
        });
      await lockAssessment(tx, a, input.expectedVersion, invalidatesQa());
      await audit(
        tx,
        user.id,
        a,
        input.action === "REMOVE_RECOMMENDATION"
          ? "DRAFT_RECOMMENDATION_REMOVED"
          : "DRAFT_RECOMMENDATION_REORDERED",
      );
      return { updated: true };
    }
    if (input.action === "QA_APPROVE") {
      if (a.status !== "QA_REVIEW")
        throw ApiError.conflict("Move the completed draft to QA review first");
      if (
        !(await tx.auditLog.findFirst({
          where: {
            actorId: user.id,
            resource: "readiness",
            resourceId: a.id,
            metadata: JSON.stringify({
              action: "REPORT_PREVIEWED",
              version: a.version,
            }),
          },
        }))
      )
        throw ApiError.conflict("Preview this exact draft before approving QA");
      await reportSnapshot(tx, a, 0);
      await lockAssessment(tx, a, input.expectedVersion, {
        qaReviewedById: user.id,
        qaReviewedAt: new Date(),
        qaDraftVersion: a.version + 1,
      });
      await audit(tx, user.id, a, "REPORT_QA_APPROVED", {
        version: a.version + 1,
      });
      return { approved: true };
    }
    if (input.action === "FINALIZE") {
      const report = await finalize(tx, a, user.id);
      await lockAssessment(tx, a, input.expectedVersion, {
        qaDraftVersion: a.version + 1,
      });
      return { finalized: true, reportId: report.id };
    }
    if (input.action === "DELIVER") {
      const report = await deliver(tx, a, user.id, input.reportId);
      return { delivered: true, reportId: report.id };
    }
    throw ApiError.badRequest();
  });
}
export async function queue(request: Request, admin = false) {
  return prisma.$transaction(async (tx) => {
    const user = await session(tx, request);
    const active =
      user.activeClientId || request.headers.get("x-pk-client-context");
    if (!admin && user.role !== "CLIENT") throw ApiError.forbidden();
    if (!active || request.headers.get("x-pk-client-context") !== active)
      throw ApiError.forbidden("Select an authorized client context");
    const client = await tx.client.findUnique({ where: { id: active } });
    if (client?.status !== "ACTIVE") throw ApiError.forbidden();
    let requestIds: string[] | undefined;
    if (!admin && user.role === "CLIENT") {
      if (
        !(await tx.clientMember.findUnique({
          where: { clientId_userId: { clientId: active, userId: user.id } },
        }))
      )
        throw ApiError.forbidden();
    } else {
      if (
        user.role === "CLIENT" ||
        user.assurance !== "WEBAUTHN" ||
        user.activeClientId !== active
      )
        throw ApiError.forbidden();
      const grants = await tx.capabilityGrant.findMany({
        where: { userId: user.id },
      });
      const all =
        grants.some(
          (g) =>
            g.capability === "confidential_access" &&
            g.scope === "CLIENT" &&
            g.clientId === active,
        ) &&
        grants.some(
          (g) =>
            g.capability === "readiness_read" &&
            g.scope === "CLIENT" &&
            g.clientId === active,
        );
      if (!all) {
        const engagements = await tx.verificationRequest.findMany({
          where: { clientId: active },
          select: { id: true },
        });
        requestIds = engagements
          .filter((r) =>
            ["confidential_access", "readiness_read"].every((cap) =>
              grants.some((g) =>
                grantMatches(
                  g,
                  cap as "readiness_read" | "confidential_access",
                  active,
                  r.id,
                ),
              ),
            ),
          )
          .map((r) => r.id);
        if (!requestIds.length) throw ApiError.forbidden();
      }
    }
    const rows = await tx.readinessAssessment.findMany({
      where: {
        clientId: active,
        ...(requestIds ? { requestId: { in: requestIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const result = [];
    for (const a of rows) {
      const credit = await expireCredit(tx, a.id);
      const outsideCount = admin
        ? await tx.assessmentRecommendation.count({
            where: { assessmentId: a.id },
          })
        : 0;
      result.push({
        id: a.id,
        clientId: a.clientId,
        status: a.status,
        paymentStatus: a.paymentStatus,
        version: a.version,
        createdAt: a.createdAt,
        submittedAt: a.submittedAt,
        reportDeliveredAt: a.reportDeliveredAt,
        ...(admin
          ? {
              slaDueAt: a.slaDueAt,
              slaPausedAt: a.slaPausedAt,
              overdue:
                !!a.slaDueAt &&
                !a.slaPausedAt &&
                new Date() > a.slaDueAt &&
                !["DELIVERED", "CLOSED", "CANCELLED", "REFUNDED"].includes(
                  a.status,
                ),
              outsideCount,
            }
          : {}),
        creditStatus: credit?.status ?? null,
        redeemDeadline: credit?.redeemDeadline ?? null,
      });
    }
    await audit(tx, user.id, null, "READINESS_QUEUE_VIEWED", {
      count: result.length,
    });
    return { assessments: result, clientId: active, count: result.length };
  });
}
export async function reportResponse(
  request: Request,
  assessmentId: string,
  admin = false,
  preview = false,
  reportId?: string,
) {
  const html = await prisma.$transaction(async (tx) => {
    const { user, assessment: a } = await assessmentAccess(
      tx,
      request,
      assessmentId,
      "read",
      admin,
    );
    let snapshot: ReportSnapshot;
    if (preview) {
      if (!admin) throw ApiError.forbidden();
      snapshot = await reportSnapshot(tx, a, 0);
    } else {
      const report = await tx.readinessReportVersion.findFirst({
        where: {
          assessmentId: a.id,
          ...(reportId ? { id: reportId } : {}),
          ...(admin ? {} : { deliveryState: "DELIVERED" }),
        },
        orderBy: { version: "desc" },
      });
      if (!report || snapshotDigest(report.snapshot) !== report.digest)
        throw ApiError.notFound("Report is not available");
      snapshot = JSON.parse(report.snapshot) as ReportSnapshot;
    }
    const rendered = renderReport(snapshot);
    await audit(
      tx,
      user.id,
      a,
      preview ? "REPORT_PREVIEWED" : "REPORT_VIEWED",
      { version: preview ? a.version : snapshot.version },
    );
    return rendered;
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox allow-popups; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
