import { z } from "zod";

export const PRICE_CENTS = 9900;
export const POLICY_VERSION = "PK_READINESS_OFFICIAL_POLICY_V1_2026_10_06";
export const ACKNOWLEDGMENT =
  "I understand that once I submit my Assessment for PK review, the $99 Assessment fee is non-refundable. I understand that disagreement with or dissatisfaction with my Readiness Report, findings, results, or recommendations does not qualify me for a refund.";
export const PRODUCT_NAME =
  "PK Books, Business & Tax Season Readiness Assessment";
export const DISPOSITIONS = [
  "NO_ACTION_NEEDED",
  "YOU_CAN_HANDLE_THIS",
  "PK_CAN_HELP",
  "OUTSIDE_HELP_RECOMMENDED",
] as const;
export const AREAS = [
  "BOOKS",
  "RECONCILIATION",
  "INCOME_EXPENSE",
  "RECORDS",
  "TAX_SEASON",
  "MISSING_INFORMATION",
] as const;
export const AREA_LABELS = {
  BOOKS: "Books",
  RECONCILIATION: "Reconciliation / Status",
  INCOME_EXPENSE: "Income & Expense Organization",
  RECORDS: "Business Records / Documents",
  TAX_SEASON: "Tax Season",
  MISSING_INFORMATION: "Missing Information & Priorities",
};
export const AREA_STATUSES: Record<string, readonly string[]> = {
  BOOKS: [
    "READY",
    "NEEDS_ATTENTION",
    "CLEANUP_RECOMMENDED",
    "INSUFFICIENT_INFORMATION",
    "NOT_APPLICABLE",
  ],
  RECONCILIATION: [
    "READY",
    "NEEDS_ATTENTION",
    "RECONCILIATION_WORK_RECOMMENDED",
    "INSUFFICIENT_INFORMATION",
    "NOT_APPLICABLE",
  ],
  INCOME_EXPENSE: [
    "READY",
    "NEEDS_ATTENTION",
    "ORGANIZATION_WORK_RECOMMENDED",
    "INSUFFICIENT_INFORMATION",
    "NOT_APPLICABLE",
  ],
  RECORDS: [
    "READY",
    "NEEDS_ATTENTION",
    "ACTION_NEEDED",
    "INSUFFICIENT_INFORMATION",
    "NOT_APPLICABLE",
  ],
  TAX_SEASON: [
    "READY",
    "PREPARATION_NEEDED",
    "PROFESSIONAL_REVIEW_RECOMMENDED",
    "INSUFFICIENT_INFORMATION",
    "NOT_APPLICABLE",
  ],
  MISSING_INFORMATION: [
    "READY",
    "NEEDS_ATTENTION",
    "ACTION_NEEDED",
    "INSUFFICIENT_INFORMATION",
    "NOT_APPLICABLE",
  ],
};
export const FULFILLMENT_STATES = [
  "PURCHASE_STARTED",
  "PAYMENT_PENDING",
  "PAID",
  "INTAKE_IN_PROGRESS",
  "READY_TO_SUBMIT",
  "SUBMITTED_FOR_REVIEW",
  "AWAITING_INFORMATION",
  "IN_REVIEW",
  "REPORT_DRAFT",
  "QA_REVIEW",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
  "REFUNDED",
] as const;
export const CREDIT_STATES = [
  "NOT_ELIGIBLE",
  "ELIGIBLE_UNCLAIMED",
  "CLAIMED_PENDING_REVIEW",
  "APPROVED_AVAILABLE",
  "APPLIED",
  "EXPIRED",
  "REJECTED",
  "VOIDED",
] as const;
export const RELATIONSHIPS = [
  "INFORMATIONAL",
  "PERSONALLY_RECOMMENDED",
  "VETTED",
  "REFERRAL_RELATIONSHIP",
  "PAID_OR_COMPENSATED_RELATIONSHIP",
] as const;
export const ANALYTICS_EVENTS = [
  "readiness_page_view",
  "gut_check_interaction",
  "readiness_cta_click",
  "preliminary_intake_started",
  "preliminary_intake_completed",
  "checkout_started",
  "purchase_success",
  "intake_started",
  "assessment_submitted",
  "report_delivered",
  "credit_claimed",
  "credit_applied",
] as const;
export const BUSINESS_TYPES = [
  "FREELANCER",
  "GIG_WORKER",
  "CONTRACTOR",
  "SMALL_BUSINESS",
  "ONLINE_SELLER",
  "CREATOR",
  "ADULT_INDUSTRY",
  "OTHER_SELF_EMPLOYED",
] as const;
export const BOOKKEEPING_OPTIONS = [
  "CURRENT",
  "BEHIND",
  "NOT_STARTED",
  "UNSURE",
] as const;
export const CONCERNS = [
  "BOOKS",
  "RECONCILIATION",
  "RECORDS",
  "TAX_SEASON",
  "UNSURE",
] as const;
export const DOCUMENT_KINDS = [
  "BOOKKEEPING_SUMMARY",
  "RECONCILIATION_STATUS",
  "INCOME_EXPENSE_SUMMARY",
  "BUSINESS_RECORDS",
  "TAX_SOURCE_INFORMATION",
] as const;
// Public questions are controlled choices, never unrestricted taxpayer narratives.
const safeName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (s) => !/\d{3}[- ]?\d{2}[- ]?\d{4}|\d{12,}|https?:|[<>]/i.test(s),
    "Use a name only; do not include sensitive information",
  );
export const preliminaryInput = z
  .object({
    name: safeName,
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    businessType: z.enum(BUSINESS_TYPES),
    bookkeeping: z.enum(BOOKKEEPING_OPTIONS),
    concern: z.enum(CONCERNS),
    consent: z.literal(true),
  })
  .strict();
export const intakeInput = z
  .object({
    businessName: safeName,
    reviewPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    bookkeepingSystem: z.enum([
      "QUICKBOOKS",
      "OTHER_SOFTWARE",
      "SPREADSHEET",
      "PAPER",
      "NONE",
      "UNSURE",
    ]),
    bookkeepingStatus: z.enum(BOOKKEEPING_OPTIONS),
    reconciliationStatus: z.enum([
      "CURRENT",
      "PARTIAL",
      "NOT_RECONCILED",
      "UNSURE",
      "NOT_APPLICABLE",
    ]),
    incomeStreams: z
      .array(
        z.enum([
          "CLIENTS",
          "PLATFORMS",
          "ONLINE_SALES",
          "CASH",
          "OTHER_BUSINESS",
        ]),
      )
      .min(1)
      .max(5),
    incomeExpenseOrganization: z.enum([
      "ORGANIZED",
      "PARTIAL",
      "UNORGANIZED",
      "UNSURE",
    ]),
    recordsStatus: z.enum(["ORGANIZED", "SCATTERED", "MISSING", "UNSURE"]),
    taxPreparationStatus: z.enum([
      "PREPARER_SELECTED",
      "NOT_STARTED",
      "NEED_PROFESSIONAL",
      "UNSURE",
    ]),
    priority: z.enum(CONCERNS),
  })
  .strict();
const prose = z.string().trim().min(1).max(4000);
const optionalProse = z.string().trim().max(4000).default("");
export const findingInput = z
  .object({
    id: z.string().max(64).optional(),
    area: z.enum(AREAS),
    status: z.string().max(64),
    finding: prose,
    evidenceBasis: prose,
    whyItMatters: prose,
    recommendedAction: prose,
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    disposition: z.enum(DISPOSITIONS),
    qualifyingServiceId: z.string().min(1).max(64).nullable().default(null),
    internalNotes: optionalProse,
    ordering: z.number().int().min(0).max(1000).default(0),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!AREA_STATUSES[v.area].includes(v.status))
      ctx.addIssue({
        code: "custom",
        message: "Condition status does not match the review area",
      });
    if (v.disposition === "PK_CAN_HELP" && !v.qualifyingServiceId)
      ctx.addIssue({
        code: "custom",
        message: "A specific qualifying PK service is required",
      });
    if (v.disposition !== "PK_CAN_HELP" && v.qualifyingServiceId)
      ctx.addIssue({
        code: "custom",
        message:
          "Outside or self-service recommendations cannot carry a PK credit service",
      });
  });
const link = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash
      );
    } catch {
      return false;
    }
  }, "Use an HTTPS address without credentials or tracking parameters")
  .nullable()
  .default(null);
export const libraryInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(100),
    recommendationType: z.enum([
      "PROFESSIONAL_TYPE",
      "SERVICE_TYPE",
      "NAMED_PROVIDER",
      "RESOURCE",
    ]),
    providerOrResourceName: z.string().trim().max(160).nullable().default(null),
    clientFacingDescription: prose,
    whyOrWhenToUse: prose,
    clientNextStep: prose,
    websiteUrl: link,
    phone: z.string().trim().max(40).nullable().default(null),
    email: z
      .union([z.email().max(254), z.literal("")])
      .nullable()
      .default(null),
    locationOrServiceArea: z.string().trim().max(200).nullable().default(null),
    internalNotes: optionalProse,
    relationshipClassification: z.enum(RELATIONSHIPS).default("INFORMATIONAL"),
    disclosureText: optionalProse,
    active: z.boolean().default(true),
    archived: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.recommendationType === "NAMED_PROVIDER" && !v.providerOrResourceName)
      ctx.addIssue({
        code: "custom",
        message: "Named providers require an intentionally selected name",
      });
    if (
      v.relationshipClassification !== "INFORMATIONAL" &&
      !v.disclosureText.trim()
    )
      ctx.addIssue({
        code: "custom",
        message: "Explicit relationship disclosure is required",
      });
    if (v.archived && v.active)
      ctx.addIssue({
        code: "custom",
        message: "Archived entries cannot remain active",
      });
  });
export type LibraryInput = z.infer<typeof libraryInput>;
export function clientRecommendation(v: LibraryInput) {
  return {
    title: v.title,
    category: v.category,
    recommendationType: v.recommendationType,
    providerOrResourceName: v.providerOrResourceName,
    clientFacingDescription: v.clientFacingDescription,
    whyOrWhenToUse: v.whyOrWhenToUse,
    clientNextStep: v.clientNextStep,
    websiteUrl: v.websiteUrl,
    phone: v.phone,
    email: v.email,
    locationOrServiceArea: v.locationOrServiceArea,
    relationshipClassification: v.relationshipClassification,
    disclosureText:
      v.disclosureText ||
      "Informational resource only. PK has not verified this resource. No outcome is guaranteed.",
  };
}
export function addCalendarMonths(date: Date, count: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + count);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export function creditDeadlines(delivered: Date) {
  return {
    claimDeadline: new Date(delivered.getTime() + 14 * 86400000),
    redeemDeadline: addCalendarMonths(delivered, 6),
  };
}
export function addBusinessDays(date: Date, days: number) {
  const d = new Date(date);
  while (days > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (![0, 6].includes(d.getUTCDay())) days--;
  }
  return d;
}
export function businessElapsed(from: Date, to: Date) {
  let cursor = from.getTime(),
    total = 0;
  while (cursor < to.getTime()) {
    const d = new Date(cursor);
    const next = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + 1,
    );
    const end = Math.min(next, to.getTime());
    if (![0, 6].includes(d.getUTCDay())) total += end - cursor;
    cursor = end;
  }
  return total;
}
export function resumeBusinessDeadline(due: Date, pause: Date, now: Date) {
  let remaining = businessElapsed(pause, now);
  let cursor = due.getTime();
  while (remaining > 0) {
    const d = new Date(cursor);
    const next = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + 1,
    );
    if ([0, 6].includes(d.getUTCDay())) {
      cursor = next;
      continue;
    }
    const step = Math.min(remaining, next - cursor);
    remaining -= step;
    cursor += step;
  }
  return new Date(cursor);
}
