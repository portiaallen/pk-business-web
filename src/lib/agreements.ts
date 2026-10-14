// Company-wide service-agreement, refund-policy and acknowledgment framework.
// Directive: Founder-authorized P0, 2026-10-14.
// Rules encoded here:
//  - Only PUBLISHED documents are enforceable client-facing terms.
//  - DRAFT refund policies (Tax Division, general services) exist as
//    configuration/hooks only: they are never served as effective terms,
//    never required for client acceptance, and never replace live terms
//    until the Founder approves and publishes finalized versions.
//  - Every acceptance stores the agreement/policy version, the exact
//    acknowledgment text, a typed electronic signature, and a timestamp,
//    and writes an audit entry.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";

export const AGREEMENT_DOC_KINDS = {
  SERVICE_AGREEMENT: "SERVICE_AGREEMENT",
  REFUND_POLICY: "REFUND_POLICY",
} as const;

export const DOC_KEYS = {
  ASSESSMENT_AGREEMENT: "ASSESSMENT_SERVICE_AGREEMENT",
  ASSESSMENT_REFUND_POLICY: "ASSESSMENT_REFUND_POLICY",
  TAX_DIVISION_REFUND_POLICY: "TAX_DIVISION_REFUND_POLICY",
  GENERAL_SERVICES_REFUND_POLICY: "GENERAL_SERVICES_REFUND_POLICY",
} as const;

export const SERVICE_KEYS = {
  READINESS_ASSESSMENT: "READINESS_ASSESSMENT",
  TAX_PREPARATION: "TAX_PREPARATION",
  GENERAL_SERVICES: "GENERAL_SERVICES",
} as const;

export const SUBJECT_TYPES = {
  READINESS_ASSESSMENT: "READINESS_ASSESSMENT",
  TAX_ENGAGEMENT: "TAX_ENGAGEMENT",
  SERVICE_ENGAGEMENT: "SERVICE_ENGAGEMENT",
} as const;

export const ACKNOWLEDGMENT_EVENTS = {
  AGREEMENT_ACCEPTED: "AGREEMENT_ACCEPTED",
  DOCUMENT_COMPLETION_ACK: "DOCUMENT_COMPLETION_ACK",
  UPLOAD_FINISHED: "UPLOAD_FINISHED",
  SCOPE_CHANGE_ACK: "SCOPE_CHANGE_ACK",
  LATE_DOCUMENT_FEE_NOTICE: "LATE_DOCUMENT_FEE_NOTICE",
  UPLOAD_ACCESS_REQUESTED: "UPLOAD_ACCESS_REQUESTED",
  UPLOAD_ACCESS_GRANTED: "UPLOAD_ACCESS_GRANTED",
  UPLOAD_ACCESS_REVOKED: "UPLOAD_ACCESS_REVOKED",
} as const;

// The exact text a client must affirmatively acknowledge before the $99
// Assessment becomes non-refundable (approved policy v1.0, required-acknowledgment section).
export const ASSESSMENT_ACKNOWLEDGMENT_TEXT =
  "I understand that once I submit my Assessment for PK review, the $99 Assessment fee is non-refundable. I understand that disagreement with or dissatisfaction with my Readiness Report, findings, results, or recommendations does not qualify me for a refund.";

export const ASSESSMENT_POLICY_VERSION = "PK_READINESS_OFFICIAL_POLICY_V1_2026_10_06";

export const LATE_DOCUMENT_FEE = {
  CENTS: 500,
  THRESHOLD_LABEL: "after preparation exceeds 75% completion",
  DISCRETIONARY: true,
  REQUIRES_ADVANCE_NOTICE: true,
  CONFIGURABLE: true, // hook only; never auto-charged until Founder configures
} as const;

const docSelection = {
  id: true,
  kind: true,
  docKey: true,
  version: true,
  serviceKey: true,
  title: true,
  body: true,
  status: true,
  published: true,
  publishedAt: true,
  effectiveAt: true,
  sourceUrl: true,
} as const;

export type AgreementDocumentRow = Prisma.AgreementDocumentGetPayload<{
  select: typeof docSelection;
}>;

export function isPublished(doc: Pick<AgreementDocumentRow, "published" | "status">) {
  return doc.published === true && doc.status === "APPROVED";
}

export async function getPublishedBundle(
  db: PrismaClient | Prisma.TransactionClient,
  serviceKey: string,
): Promise<{
  agreement: AgreementDocumentRow | null;
  policies: AgreementDocumentRow[];
}> {
  const docs = await db.agreementDocument.findMany({
    where: { OR: [{ serviceKey }, { serviceKey: null }], published: true },
    orderBy: { publishedAt: "desc" },
  });
  // Most recent published document per stable docKey wins.
  const latest = new Map<string, AgreementDocumentRow>();
  for (const d of docs) if (!latest.has(d.docKey)) latest.set(d.docKey, d);
  const all = [...latest.values()];
  return {
    agreement:
      all.find((d) => d.kind === AGREEMENT_DOC_KINDS.SERVICE_AGREEMENT) ?? null,
    policies: all
      .filter((d) => d.kind === AGREEMENT_DOC_KINDS.REFUND_POLICY)
      .sort((a, b) => a.docKey.localeCompare(b.docKey)),
  };
}

export async function getDraftSummaries(
  db: PrismaClient | Prisma.TransactionClient,
) {
  // Drafts are surfaced ONLY as metadata (no body) so admin/ops can see what
  // is parked pending Founder approval. They are never client-facing.
  return db.agreementDocument.findMany({
    where: { published: false },
    select: {
      id: true,
      kind: true,
      docKey: true,
      version: true,
      title: true,
      status: true,
      serviceKey: true,
      sourceUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export const acceptanceInput = z
  .object({
    subjectType: z.enum([
      SUBJECT_TYPES.READINESS_ASSESSMENT,
      SUBJECT_TYPES.TAX_ENGAGEMENT,
      SUBJECT_TYPES.SERVICE_ENGAGEMENT,
    ]),
    subjectId: z.string().min(1).max(64),
    clientName: z.string().trim().min(1).max(200),
    clientEmail: z.string().trim().email().max(200),
    signatureName: z.string().trim().min(1).max(200),
    agreementDocKey: z.string().max(80).optional(),
    agreementDocVersion: z.string().max(40).optional(),
    policyDocKey: z.string().min(1).max(80),
    policyDocVersion: z.string().min(1).max(60),
    acknowledgmentText: z.string().trim().min(1).max(2000),
    ipAddress: z.string().max(64).optional(),
    userAgent: z.string().max(512).optional(),
    readinessAssessmentId: z.string().max(64).optional(),
  })
  .strict();

export type AcceptanceInput = z.infer<typeof acceptanceInput>;

/**
 * Records an executed agreement acceptance. Refuses when the referenced
 * policy is not published (drafts can never be accepted as effective terms)
 * or when the acknowledgment text does not match the published document's
 * required acknowledgment for that subject type.
 */
export async function recordAcceptance(
  db: PrismaClient | Prisma.TransactionClient,
  input: AcceptanceInput,
  opts: { actorId?: string | null; sendClientCopy?: boolean } = {},
) {
  const policy = await db.agreementDocument.findUnique({
    where: {
      kind_docKey_version: {
        kind: AGREEMENT_DOC_KINDS.REFUND_POLICY,
        docKey: input.policyDocKey,
        version: input.policyDocVersion,
      },
    },
  });
  if (!policy || !isPublished(policy))
    throw new Error(
      `REFUND_POLICY_NOT_EFFECTIVE:${input.policyDocKey}@${input.policyDocVersion}`,
    );
  if (input.agreementDocKey && input.agreementDocVersion) {
    const agreement = await db.agreementDocument.findUnique({
      where: {
        kind_docKey_version: {
          kind: AGREEMENT_DOC_KINDS.SERVICE_AGREEMENT,
          docKey: input.agreementDocKey,
          version: input.agreementDocVersion,
        },
      },
    });
    if (!agreement || !isPublished(agreement))
      throw new Error(
        `SERVICE_AGREEMENT_NOT_EFFECTIVE:${input.agreementDocKey}@${input.agreementDocVersion}`,
      );
  }
  const acceptance = await db.agreementAcceptance.create({
    data: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      signatureName: input.signatureName,
      agreementDocKey: input.agreementDocKey ?? null,
      agreementDocVersion: input.agreementDocVersion ?? null,
      policyDocKey: input.policyDocKey,
      policyDocVersion: input.policyDocVersion,
      acknowledgmentText: input.acknowledgmentText,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      readinessAssessmentId: input.readinessAssessmentId ?? null,
    },
  });
  await recordEvent(db, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    eventType: ACKNOWLEDGMENT_EVENTS.AGREEMENT_ACCEPTED,
    payload: {
      acceptanceId: acceptance.id,
      agreementDocKey: input.agreementDocKey ?? null,
      agreementDocVersion: input.agreementDocVersion ?? null,
      policyDocKey: input.policyDocKey,
      policyDocVersion: input.policyDocVersion,
      signatureName: input.signatureName,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: opts.actorId ?? null,
      action: "AGREEMENT_ACCEPTED",
      resource: input.subjectType,
      resourceId: input.subjectId,
      metadata: JSON.stringify({
        policyDocKey: input.policyDocKey,
        policyDocVersion: input.policyDocVersion,
        agreementDocKey: input.agreementDocKey ?? null,
        agreementDocVersion: input.agreementDocVersion ?? null,
        signatureName: input.signatureName,
      }),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  return acceptance;
}

export async function recordEvent(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    subjectType: string;
    subjectId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  },
) {
  return db.acknowledgmentEvent.create({
    data: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      eventType: input.eventType,
      payload: JSON.stringify(input.payload ?? {}),
    },
  });
}

export async function eventHistory(
  db: PrismaClient | Prisma.TransactionClient,
  subjectType: string,
  subjectId: string,
) {
  return db.acknowledgmentEvent.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
  });
}
