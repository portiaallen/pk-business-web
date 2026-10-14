// Seeds the company-wide agreements / refund-policy framework documents.
// Directive: Founder-authorized P0, 2026-10-14.
//  - ASSESSMENT_REFUND_POLICY v1.0: APPROVED (Founder-approved product policy v1.0,
//    effective 2026-10-06) and PUBLISHED (enforceable client-facing terms).
//  - TAX_DIVISION_REFUND_POLICY v1.0: DRAFT ONLY. Stored, linked, NEVER published.
//  - GENERAL_SERVICES_REFUND_POLICY v1.0: DRAFT ONLY. Stored, linked, NEVER published.
//  - Service agreement templates are seeded as DRAFT (unpublished) pending Founder
//    approval of the agreement text; intake flows run on published docs only.
// Idempotent: upserts by (kind, docKey, version); never flips a published doc back.
import { PrismaClient } from "../src/generated/prisma/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as typeof import("@prisma/adapter-better-sqlite3");

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("file:"))
  throw new Error("seed-agreements requires a file: DATABASE_URL");
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

const ASSESSMENT_POLICY_BODY = `PK Books, Business & Tax Season Readiness Assessment
Official Product & Credit Policy — v1.0
Effective: October 6, 2026

PRODUCT
Price: $99
The $99 Readiness Assessment is a paid professional diagnostic service. The customer is purchasing PK's assessment, analysis, and Readiness Report—not a predetermined result or a recommendation to purchase additional PK services.

$99 READINESS SERVICE CREDIT
The full $99 Assessment fee may be applied toward ONE qualifying PK Business Services service when that service relates to a need identified in the customer's Readiness Report.
The customer must express interest in a qualifying recommended PK service within 14 calendar days of delivery of the final Readiness Report to claim the credit.
Once timely claimed, the credit remains available for six months from the date the final Readiness Report was delivered and must be applied against a valid invoice for the qualifying service within that period.
The credit: is limited to $99 total; applies to one service only; cannot be divided among multiple services; is nontransferable; has no cash value; cannot exceed the qualifying invoice amount; cannot be applied to an unrelated service; is not automatically applied merely because the customer expresses interest; and requires PK approval based on the relationship between the Readiness Report recommendation and the selected service.
The system must retain an audit trail of the report-delivery date, 14-day claim deadline, customer expression of interest, PK approval, qualifying service, six-month expiration date, invoice, amount applied, and final credit status.

REFUND POLICY
The $99 Assessment fee becomes non-refundable once the customer submits the completed Assessment for PK review.
The fee compensates PK for performing the assessment, analyzing the information provided, and preparing the Readiness Report. Payment does not guarantee any particular readiness result, finding, recommendation, score, outcome, or recommendation for PK Business Services.
Disagreement with, dissatisfaction with, or dislike of the findings, results, conclusions, or recommendations in the Readiness Report is not grounds for a refund.
Customers may identify factual errors and request that PK review them. Correction of a verified factual error does not, by itself, create entitlement to a refund.
PK retains administrative discretion to correct legitimate payment errors or situations occurring before submission, such as duplicate charges, accidental duplicate purchases, or circumstances in which PK cannot provide the purchased Assessment.
The Readiness Service Credit is not a refund and cannot be redeemed for cash.

REQUIRED CUSTOMER ACKNOWLEDGMENT
Before final Assessment submission, the customer must affirmatively acknowledge:
"I understand that once I submit my Assessment for PK review, the $99 Assessment fee is non-refundable. I understand that disagreement with or dissatisfaction with my Readiness Report, findings, results, or recommendations does not qualify me for a refund."
The system must preserve the policy version, acceptance timestamp, customer/assessment identity, and acknowledgment event.

OFFICIAL TIMING RULE
Report delivered → 14 days to claim → 6 months from report delivery to redeem against one qualifying invoice. The purchase date does not start either credit clock.

STATUS: APPROVED PRODUCT POLICY — v1.0`;

const TAX_REFUND_DRAFT_BODY = `PK TAX DIVISION — REFUND & CANCELLATION POLICY
DRAFT v1.0 — October 14, 2026 — FOUNDER REVIEW REQUIRED; NOT YET EFFECTIVE

1. POLICY SCOPE: Applies to PK Tax Division tax return preparation engagements. Separate from the existing $99 Readiness Assessment policy and the general PK Business Services policy. The signed Tax Preparation Service Agreement must link to this policy. TaxSmart Pro and third-party bank-product terms, if used, must be separately disclosed where applicable.

2. BEFORE PREPARATION BEGINS — PROPOSED: Clients may request cancellation before substantive preparation begins. PK reviews whether any disclosed, authorized work or nonrecoverable third-party charges have been incurred. PK refunds unearned fees, subject to valid agreed charges and applicable law. Paying a deposit does not alone make it automatically nonrefundable.

3. AFTER PREPARATION BEGINS — PROPOSED: PK calculates charges for authorized work actually performed, with a documented breakdown, and returns unearned prepaid amounts, subject to lawful, clearly disclosed engagement terms. Completed return, review, and filing stages are documented to support the calculation.

4. BEFORE FILING VS. AFTER FILING: Tax return preparation and electronic filing are distinct milestones. No filing may occur without required taxpayer authorization. If a client declines to authorize filing, PK may charge for preparation work already performed as agreed, but must not represent an unfiled return as filed. After an authorized return is transmitted, preparation fees are not automatically refundable merely because the refund amount, tax liability, processing timeline, or IRS/state result differs from expectations. Legitimate errors or failure to perform agreed services must be reviewed and remedied as appropriate; statutory rights remain intact.

5. TAX REFUND VS. SERVICE FEE REFUND: PK's fee refund policy concerns amounts clients pay PK for services; it is not a guarantee of an IRS or state tax refund, a particular refund amount, a deduction, a credit, or a filing acceptance date.

6. LATE DOCUMENTS AND SCOPE CHANGES: Clients must provide all relevant tax documents, including later-arriving documents, for professional review. A discretionary $5 late-document processing fee may be assessed per additional document after preparation exceeds 75% completion, when extra processing/revision is required, only after advance notice and consistent with the signed agreement. PK may waive it. Newly disclosed K-1s, rental properties, entities, or other material changes may require a revised preparation quote and client approval. These are separate charges; neither is automatically a refund penalty.

7. THIRD-PARTY AND BANK PRODUCT FEES: Any software, transmitter, service bureau, bank-product, or other third-party charges must be disclosed and treated according to actual incurred obligations and the governing agreements.

8. PK ERROR OR INABILITY TO COMPLETE: PK reviews duplicate charges, inability to perform, and substantiated PK errors, and provides correction, appropriate refund, or another lawful remedy. Nothing limits professional preparer obligations or non-waivable customer rights.

9. CANCELLATION REQUESTS AND AUDIT TRAIL: Clients request cancellation/refunds through PK's designated secure channel. PK records identity, engagement, signed policy version, payment, preparation milestone, work performed, charges incurred, filing authorization status, and resolution. No sensitive taxpayer documents through general email or developer tools.

10. IMPLEMENTATION: At intake confirmation, link the tax service agreement and this policy, require an affirmative unchecked acknowledgment plus electronic signature, preserve version/timestamp, and provide a copy. At document upload completion, separately acknowledge document completeness, potential late-document fees, and scope changes. The private taxpayer vault remains inaccessible to Fo/Codex/AI.

11. OPEN DECISIONS BEFORE PUBLICATION: Founder to approve how to value partially prepared returns; cancellation/refund review window; treatment of filing-stage charges; third-party fee disclosure; contact channel; timing for responses; and whether specific tax product categories need additional exceptions. Obtain qualified legal/tax-practice review. Do not publish or apply this draft as final terms until approved.

REFERENCE: PK Tax Division canonical pricing (no amounts invented here): Drive doc 1LpF2LEnVgcXnyv40dMo76lRabI5kK4qBwVsL1MnKNw4`;

const GENERAL_REFUND_DRAFT_BODY = `PK BUSINESS SERVICES — COMPANY-WIDE REFUND & CANCELLATION POLICY
DRAFT v1.0 — October 14, 2026 — FOUNDER REVIEW REQUIRED; NOT YET EFFECTIVE

1. POLICY STRUCTURE AND PRECEDENCE: PK maintains three distinct policies: (A) the existing approved $99 Readiness Assessment refund policy; (B) a Tax Division-specific refund and cancellation policy; and (C) this general policy for all other PK Business Services. The service-specific policy and signed service agreement control the relevant engagement, subject to applicable law.

2. SCOPE: Proposed for bookkeeping, QuickBooks cleanup/reconciliation, inventory support, consulting, and other PK services without a separately approved refund policy. Each service agreement must identify the applicable policy, fee schedule, scope, and payment milestones.

3. CANCELLATION BEFORE WORK STARTS — PROPOSED: A client may request cancellation in writing before substantive work begins. PK identifies any authorized nonrecoverable third-party charges and any already-performed work, and provides an itemized refund determination. No automatic blanket forfeiture of deposits is assumed.

4. CANCELLATION AFTER WORK STARTS — PROPOSED: PK may retain payment for services actually performed and disclosed, authorized nonrecoverable expenses, and other lawful amounts specifically agreed in advance. Unearned prepaid amounts will be refunded, unless a valid, clearly disclosed service-specific term lawfully provides otherwise. PK provides an accounting of work performed and amounts retained/refunded.

5. DEPOSITS AND PAYMENTS: Existing PK payment practice: 50% deposit for eligible engagements; engagements under $500 paid in full. These are payment timing rules, not automatically nonrefundable charges.

6. PK CANCELLATION OR INABILITY TO PERFORM: PK communicates promptly and offers an appropriate refund of unearned fees or another mutually agreed resolution. Billing errors are investigated and corrected.

7. CLIENT DELAYS, MISSING DOCUMENTS, AND SCOPE CHANGES: PK may pause work pending documents or approval of a revised scope. Added services require an updated quote and client approval before additional charges.

8. REQUEST AND REVIEW PROCESS — TO BE FINALIZED: Clients submit refund/cancellation requests through the designated PK support contact or secure portal. PK documents the request, agreement/policy version, payment records, work completed, decision, and communication.

9. CUSTOMER RIGHTS: Nothing in this policy limits non-waivable rights under applicable consumer, contract, payment-network, or professional rules.

10. DIGITAL ACCEPTANCE AND IMPLEMENTATION: Link the applicable policy at purchase and intake, display it alongside the service agreement, require affirmative acceptance and electronic signature, retain the policy version and timestamp, and ensure the client receives a copy. No policy should be silently retroactively applied to existing signed engagements.

11. OPEN FOUNDER DECISIONS BEFORE APPROVAL: Cancellation windows, valuation of partially completed work, treatment of disclosed setup fees, client refund request channel, response target, and service-specific exceptions. Obtain legal review before public deployment. This draft is not an approved live refund policy.

RELATED CANONICAL ASSESSMENT POLICY: Drive doc 1TwIpVpTnsr0aEb2lePFRtJAYugyR0Kv1Yk23DdaqDeg`;

const ASSESSMENT_AGREEMENT_BODY = `PK BUSINESS SERVICES — READINESS ASSESSMENT SERVICE AGREEMENT
DRAFT v1.0 — 2026-10-14 — PENDING FOUNDER APPROVAL OF AGREEMENT TEXT

1. SCOPE. PK Business Services ("PK") will perform the Books, Business & Tax Season Readiness Assessment: a professional diagnostic review of the client's books, records, income/expense organization, and tax-season readiness, delivered as a Readiness Report through the PK client portal.

2. WHAT THE CLIENT RECEIVES. One Readiness Report covering the assessment areas, findings, and recommended actions. The Assessment may recommend a PK service, an outside professional or service, customer self-service actions, no immediate paid service, or a combination.

3. WHAT THE ASSESSMENT IS NOT. It is not a predetermined result, not a guarantee of any readiness score, finding, outcome, or recommendation, and not tax return preparation, bookkeeping, or advice on any specific transaction.

4. PRICE AND PAYMENT. $99, payable in full before intake review. The fee is non-refundable once the completed Assessment is submitted for PK review (see the Refund & Credit Policy, v1.0, effective October 6, 2026).

5. READINESS SERVICE CREDIT. Governed by the official Product & Credit Policy v1.0: 14 days to claim, six months from report delivery to redeem against one qualifying invoice, one service, PK approval required.

6. CLIENT RESPONSIBILITIES. Accurate answers on the intake; timely response to PK's secure information requests; confidential documents only through PK's approved secure channels, never general email.

7. DELIVERY. The Readiness Report is delivered through the client's PK portal account.

8. GOVERNING TERMS. This agreement incorporates the approved Assessment Refund & Credit Policy v1.0. Disagreement with report findings is not grounds for a refund.

9. ELECTRONIC ACCEPTANCE. Typing your full legal name below and affirmatively accepting constitutes your electronic signature on this agreement and the incorporated policy.`;

const TAX_AGREEMENT_BODY = `PK TAX DIVISION — TAX PREPARATION SERVICE AGREEMENT
DRAFT v1.0 — 2026-10-14 — PENDING FOUNDER APPROVAL; NOT FOR CLIENT USE YET

1. SCOPE: Preparation of the tax return(s) selected at engagement, per the approved PK Tax Division pricing V1 (frozen; any change requires owner approval and a version bump). "Starting at" means the stated minimum; complexity, additional forms, states, and business records may affect the final quoted cost. Bookkeeping and cleanup are separately quoted; never bundled into preparation pricing by implication.

2. PRICING DISCLOSURES: No PK e-file fees; no hidden markup fees. Upfront payment by default. Optional refund transfer only where eligible and available; any third-party bank-product fees (e.g., transmitter $60, service bureau $50, technology $18 per TaxSmart recorded charges) are disclosed separately before client authorization and are never presented as PK fees.

3. FILING AUTHORIZATION: No return is filed without the client's required taxpayer authorization (including Form 8879 where applicable). An unfiled return is never represented as filed.

4. DOCUMENTS AND VAULT: Client tax documents are handled exclusively through the Founder-administered secure intake route. Documents are never sent through general email or made accessible to AI tools or developer tooling. The client separately acknowledges document completeness at upload completion.

5. LATE DOCUMENTS AND SCOPE CHANGES: Governed by the Tax Division refund & cancellation policy once approved. Material scope changes (e.g., newly disclosed K-1s, rental properties, entities) require a revised quote and client approval before additional charges.

6. GOVERNING TERMS: This agreement incorporates the then-effective PK Tax Division refund & cancellation policy. Until the Founder approves and publishes that policy, this agreement is not offered to clients.`;

const GENERAL_AGREEMENT_BODY = `PK BUSINESS SERVICES — GENERAL SERVICES AGREEMENT
DRAFT v1.0 — 2026-10-14 — PENDING FOUNDER APPROVAL; NOT FOR CLIENT USE YET

1. SCOPE: The service(s) selected at engagement (bookkeeping, QuickBooks cleanup/reconciliation, inventory support, consulting, or other PK services), with the fee schedule, scope, and payment milestones identified in the service-specific engagement summary.

2. PAYMENT PRACTICE: 50% deposit for eligible engagements; engagements under $500 paid in full. These are payment timing rules, not automatically nonrefundable charges.

3. CLIENT RESPONSIBILITIES: Provide documents and approvals needed to perform the work; respond to requests; use PK's designated secure channels for sensitive financial or tax documents, never ordinary email.

4. SCOPE CHANGES: Added services require an updated quote and client approval before additional charges.

5. GOVERNING TERMS: This agreement incorporates the then-effective company-wide refund & cancellation policy. Until the Founder approves and publishes that policy, this agreement is not offered to clients.`;

const DOCS = [
  {
    kind: "REFUND_POLICY",
    docKey: "ASSESSMENT_REFUND_POLICY",
    version: "v1.0",
    serviceKey: "READINESS_ASSESSMENT",
    title: "PK Readiness Assessment — Official Product & Credit Policy v1.0",
    body: ASSESSMENT_POLICY_BODY,
    status: "APPROVED" as const,
    published: true,
    publishedAt: new Date(),
    effectiveAt: new Date("2026-10-06T00:00:00Z"),
    sourceUrl:
      "https://docs.google.com/document/d/1TwIpVpTnsr0aEb2lePFRtJAYugyR0Kv1Yk23DdaqDeg/edit",
  },
  {
    kind: "REFUND_POLICY",
    docKey: "TAX_DIVISION_REFUND_POLICY",
    version: "v1.0",
    serviceKey: "TAX_PREPARATION",
    title: "PK Tax Division — Refund & Cancellation Policy — Draft v1.0 (2026-10-14)",
    body: TAX_REFUND_DRAFT_BODY,
    status: "DRAFT" as const,
    published: false,
    publishedAt: null,
    effectiveAt: null,
    sourceUrl:
      "https://docs.google.com/document/d/1qWrGAiaAll88EXmKy1kQFQvTJ1DhGAIWQSgggduI0No/edit",
  },
  {
    kind: "REFUND_POLICY",
    docKey: "GENERAL_SERVICES_REFUND_POLICY",
    version: "v1.0",
    serviceKey: null,
    title:
      "PK Business Services — Company-Wide Refund & Cancellation Policy — Draft v1.0 (2026-10-14)",
    body: GENERAL_REFUND_DRAFT_BODY,
    status: "DRAFT" as const,
    published: false,
    publishedAt: null,
    effectiveAt: null,
    sourceUrl:
      "https://docs.google.com/document/d/1Ej5tPNkuTeDalvLsmkuiTP2xrSSt1wTzHHRv7ROoTv0/edit",
  },
  {
    kind: "SERVICE_AGREEMENT",
    docKey: "ASSESSMENT_SERVICE_AGREEMENT",
    version: "v1.0",
    serviceKey: "READINESS_ASSESSMENT",
    title:
      "PK Readiness Assessment — Service Agreement (Draft v1.0, pending Founder approval)",
    body: ASSESSMENT_AGREEMENT_BODY,
    status: "DRAFT" as const,
    published: false,
    publishedAt: null,
    effectiveAt: null,
    sourceUrl: null,
  },
  {
    kind: "SERVICE_AGREEMENT",
    docKey: "TAX_SERVICE_AGREEMENT",
    version: "v1.0",
    serviceKey: "TAX_PREPARATION",
    title:
      "PK Tax Division — Tax Preparation Service Agreement (Draft v1.0, pending Founder approval)",
    body: TAX_AGREEMENT_BODY,
    status: "DRAFT" as const,
    published: false,
    publishedAt: null,
    effectiveAt: null,
    sourceUrl: null,
  },
  {
    kind: "SERVICE_AGREEMENT",
    docKey: "GENERAL_SERVICE_AGREEMENT",
    version: "v1.0",
    serviceKey: null,
    title:
      "PK Business Services — General Services Agreement (Draft v1.0, pending Founder approval)",
    body: GENERAL_AGREEMENT_BODY,
    status: "DRAFT" as const,
    published: false,
    publishedAt: null,
    effectiveAt: null,
    sourceUrl: null,
  },
];

async function main() {
  for (const d of DOCS) {
    const existing = await prisma.agreementDocument.findUnique({
      where: { kind_docKey_version: { kind: d.kind, docKey: d.docKey, version: d.version } },
    });
    if (existing) {
      if (!existing.published) {
        await prisma.agreementDocument.update({
          where: { id: existing.id },
          data: {
            title: d.title,
            body: d.body,
            status: d.status,
            sourceUrl: d.sourceUrl,
            effectiveAt: d.effectiveAt ?? undefined,
          },
        });
        console.log(`updated draft: ${d.kind}/${d.docKey}/${d.version}`);
      } else {
        console.log(`kept published: ${d.kind}/${d.docKey}/${d.version}`);
      }
      continue;
    }
    await prisma.agreementDocument.create({ data: d });
    console.log(`created: ${d.kind}/${d.docKey}/${d.version} (${d.status}, published=${d.published})`);
  }
  const drafts = await prisma.agreementDocument.count({ where: { published: false } });
  console.log(`done. unpublished (draft) documents on file: ${drafts}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
