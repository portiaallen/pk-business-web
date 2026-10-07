import { createHash } from "node:crypto";
import type { ReadinessAssessment } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import {
  AREAS,
  AREA_LABELS,
  findingInput,
  libraryInput,
  clientRecommendation,
  creditDeadlines,
  POLICY_VERSION,
} from "./policy";
import { audit, type Tx } from "./access";
import { notify } from "./notifications";
import { track } from "./analytics";

export async function reportSnapshot(
  tx: Tx,
  a: ReadinessAssessment,
  version: number,
  at = new Date(),
) {
  const findings = await tx.readinessFinding.findMany({
    where: { assessmentId: a.id, active: true },
    orderBy: [{ ordering: "asc" }, { id: "asc" }],
  });
  const recommendations = await tx.assessmentRecommendation.findMany({
    where: { assessmentId: a.id, active: true },
    orderBy: [{ ordering: "asc" }, { id: "asc" }],
  });
  if (
    !a.summary.trim() ||
    !a.strengths.trim() ||
    !a.priorityConcerns.trim() ||
    !a.limitations.trim()
  )
    throw ApiError.badRequest(
      "Complete summary, strengths, priority concerns and limitations before QA",
    );
  for (const area of AREAS)
    if (!findings.some((f) => f.area === area))
      throw ApiError.badRequest(
        "Review all six areas, including insufficient information or not applicable",
      );
  const client = await tx.client.findUniqueOrThrow({
    where: { id: a.clientId },
  });
  const preliminary = await tx.intakeSubmission.findUniqueOrThrow({
    where: { id: a.intakeSubmissionId },
  });
  const sections = [];
  for (const area of AREAS) {
    const entries = [];
    for (const raw of findings.filter((f) => f.area === area)) {
      const f = findingInput.parse({
        id: raw.id,
        area: raw.area,
        status: raw.status,
        finding: raw.finding,
        evidenceBasis: raw.evidenceBasis,
        whyItMatters: raw.whyItMatters,
        recommendedAction: raw.recommendedAction,
        priority: raw.priority,
        disposition: raw.disposition,
        qualifyingServiceId: raw.qualifyingServiceId,
        internalNotes: raw.internalNotes,
        ordering: raw.ordering,
      });
      let qualifyingService = null;
      if (f.qualifyingServiceId) {
        const service = await tx.service.findUnique({
          where: { id: f.qualifyingServiceId },
        });
        if (
          !service ||
          service.status !== "ACTIVE" ||
          service.slug === "readiness-assessment"
        )
          throw ApiError.badRequest(
            "Select a currently available qualifying PK service",
          );
        qualifyingService = { id: service.id, name: service.name };
      }
      const outside = recommendations
        .filter((r) => r.findingId === f.id)
        .map((r) => {
          // Snapshot fields are allowlisted. A source-library edit is never consulted here.
          const parsed = libraryInput.parse({
            ...JSON.parse(r.snapshot),
            internalNotes: "",
            active: true,
            archived: false,
          });
          return {
            id: r.id,
            libraryEntryId: r.libraryEntryId,
            sourceVersion: r.sourceVersion,
            ...clientRecommendation(parsed),
          };
        });
      if (f.disposition !== "OUTSIDE_HELP_RECOMMENDED" && outside.length)
        throw ApiError.badRequest(
          "Outside resources must belong to an outside-help finding",
        );
      entries.push({
        id: f.id,
        status: f.status,
        finding: f.finding,
        evidenceBasis: f.evidenceBasis,
        whyItMatters: f.whyItMatters,
        recommendedAction: f.recommendedAction,
        priority: f.priority,
        disposition: f.disposition,
        qualifyingService,
        outsideRecommendations: outside,
      });
    }
    sections.push({ area, title: AREA_LABELS[area], findings: entries });
  }
  return {
    assessmentId: a.id,
    clientName: client.name,
    customerName: preliminary.fullName,
    reportDate: at.toISOString(),
    version,
    summary: a.summary,
    strengths: a.strengths,
    priorityConcerns: a.priorityConcerns,
    limitations: a.limitations,
    sections,
    policyVersion: POLICY_VERSION,
    disclosure:
      "Sometimes the next step is PK. Sometimes it isn’t. Recommendations are needs-based. Outside resources are informational unless an explicit relationship is stated. No outcome is guaranteed.",
    scope:
      "Professional readiness review only. This does not include cleanup, completed reconciliations, tax-return preparation or filing, unlimited consulting, legal or investment advice, or guaranteed tax outcomes.",
    creditPolicy:
      "Express interest within 14 calendar days of final report delivery. Once timely claimed and PK-approved, redeem the credit against one qualifying PK invoice within six months of final report delivery. Up to $99 total; no split, transfer, cash value, unrelated service or outside-provider credit. It cannot exceed the qualifying invoice amount.",
  };
}
export type ReportSnapshot = Awaited<ReturnType<typeof reportSnapshot>>;
export function snapshotDigest(snapshot: string) {
  return createHash("sha256").update(snapshot).digest("hex");
}
export async function finalize(
  tx: Tx,
  a: ReadinessAssessment,
  actorId: string,
) {
  if (
    a.status !== "QA_REVIEW" ||
    a.qaDraftVersion !== a.version ||
    !a.qaReviewedAt ||
    !a.qaReviewedById
  )
    throw ApiError.conflict(
      "Authorized QA and preview review are required for the current draft",
    );
  const last = await tx.readinessReportVersion.findFirst({
    where: { assessmentId: a.id },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;
  const snapshot = JSON.stringify(await reportSnapshot(tx, a, version));
  const report = await tx.readinessReportVersion.create({
    data: {
      assessmentId: a.id,
      version,
      snapshot,
      digest: snapshotDigest(snapshot),
      artifactReference: `readiness-report:${a.id}:${version}`,
      finalizedBy: actorId,
      sourceDraftVersion: a.version,
    },
  });
  await audit(tx, actorId, a, "REPORT_FINALIZED", { version });
  return report;
}
export async function deliver(
  tx: Tx,
  a: ReadinessAssessment,
  actorId: string,
  reportId: string,
) {
  const report = await tx.readinessReportVersion.findFirst({
    where: { id: reportId, assessmentId: a.id, state: "FINAL" },
  });
  if (!report || snapshotDigest(report.snapshot) !== report.digest)
    throw ApiError.conflict("Final report integrity must be verified");
  if (report.deliveryState === "DELIVERED") return report;
  if (
    a.status !== "QA_REVIEW" ||
    a.qaDraftVersion !== a.version ||
    report.sourceDraftVersion !== a.version - 1
  )
    throw ApiError.conflict("Finalize and QA the report before delivery");
  const last = await tx.readinessReportVersion.findFirst({
    where: { assessmentId: a.id },
    orderBy: { version: "desc" },
  });
  if (last?.id !== report.id)
    throw ApiError.conflict("Only the latest final version may be delivered");
  if (!a.ownerUserId)
    throw ApiError.conflict("A secure client account is required for delivery");
  const owner = await tx.clientMember.findFirst({
    where: {
      userId: a.ownerUserId,
      clientId: a.clientId,
      user: { status: "ACTIVE" },
      client: { status: "ACTIVE" },
    },
  });
  if (!owner) throw ApiError.conflict("Secure portal delivery is unavailable");
  const now = new Date();
  // Atomic secure-portal publication is delivery. Email is a secondary content-free notice.
  await notify(
    tx,
    a.id,
    a.ownerUserId,
    "REPORT",
    `${a.id}:report:${report.version}`,
  );
  const updated = await tx.readinessReportVersion.updateMany({
    where: { id: report.id, deliveryState: "PENDING" },
    data: { deliveryState: "DELIVERED", deliveredAt: now },
  });
  if (!updated.count) throw ApiError.conflict("Delivery changed; retry safely");
  await tx.readinessAssessment.update({
    where: { id: a.id },
    data: {
      status: "DELIVERED",
      reportDeliveredAt: a.reportDeliveredAt ?? now,
      version: { increment: 1 },
    },
  });
  if (!a.reportDeliveredAt) {
    const snapshot = JSON.parse(report.snapshot) as ReportSnapshot;
    const eligible = snapshot.sections.some((s) =>
      s.findings.some(
        (f) => f.disposition === "PK_CAN_HELP" && f.qualifyingService,
      ),
    );
    await tx.readinessCredit.create({
      data: {
        assessmentId: a.id,
        status: eligible ? "ELIGIBLE_UNCLAIMED" : "NOT_ELIGIBLE",
        ...creditDeadlines(now),
      },
    });
  }
  await audit(tx, actorId, a, "REPORT_DELIVERED", { version: report.version });
  await track(tx, "report_delivered", a.id);
  return { ...report, deliveryState: "DELIVERED", deliveredAt: now };
}
export async function eligibleServices(tx: Tx, assessmentId: string) {
  // Credits retain the needs from the first successfully delivered report; factual corrections don't reset clocks.
  const report = await tx.readinessReportVersion.findFirst({
    where: { assessmentId, deliveryState: "DELIVERED" },
    orderBy: { version: "asc" },
  });
  if (!report || snapshotDigest(report.snapshot) !== report.digest) return [];
  const snapshot = JSON.parse(report.snapshot) as ReportSnapshot;
  return snapshot.sections.flatMap((s) =>
    s.findings
      .filter((f) => f.disposition === "PK_CAN_HELP" && f.qualifyingService)
      .map((f) => f.qualifyingService!),
  );
}
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        s
      ]!,
  );
}
export function renderReport(report: ReportSnapshot) {
  const e = escapeHtml;
  const label = (s: string) => e(s.replaceAll("_", " "));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PK Readiness Report</title><style>body{font:16px/1.65 system-ui;margin:auto;padding:24px;max-width:880px;color:#252020;background:#fff}h1,h2{color:#88204b}article{border:1px solid #aaa;padding:20px;margin:16px 0;overflow-wrap:anywhere}a{color:#88204b}dt{font-weight:bold}dd{margin:0 0 12px;white-space:pre-wrap}p{white-space:pre-wrap}@media print{body{padding:0}article{break-inside:avoid}}</style></head><body><h1>PK Readiness Report</h1><p>${e(report.clientName)} · ${e(report.customerName)}</p><p>Assessment ${e(report.assessmentId)} · Version ${report.version} · ${e(report.reportDate)}</p><h2>Where you stand</h2><p>${e(report.summary)}</p><h3>Strongest areas</h3><p>${e(report.strengths)}</p><h3>Priority concerns</h3><p>${e(report.priorityConcerns)}</p><h3>Limitations</h3><p>${e(report.limitations)}</p>${report.sections.map((s) => `<section><h2>${e(s.title)}</h2>${s.findings.map((f) => `<article><h3>${label(f.status)}</h3><dl><dt>What PK found</dt><dd>${e(f.finding)}</dd><dt>Basis reviewed</dt><dd>${e(f.evidenceBasis)}</dd><dt>Why it matters</dt><dd>${e(f.whyItMatters)}</dd><dt>What to do next</dt><dd>${e(f.recommendedAction)}</dd><dt>Priority</dt><dd>${label(f.priority)}</dd><dt>Recommendation</dt><dd>${label(f.disposition)}${f.qualifyingService ? ` — ${e(f.qualifyingService.name)}` : ""}</dd></dl>${f.outsideRecommendations.map((r) => `<aside><h4>${e(r.title)}${r.providerOrResourceName ? ` — ${e(r.providerOrResourceName)}` : ""}</h4><p>${e(r.clientFacingDescription)}</p><p>${e(r.whyOrWhenToUse)}</p><p>${e(r.clientNextStep)}</p>${r.websiteUrl ? `<a href="${e(r.websiteUrl)}" rel="noopener noreferrer">Resource website</a>` : ""}${r.phone ? `<p>Phone: ${e(r.phone)}</p>` : ""}${r.email ? `<p>Email: ${e(r.email)}</p>` : ""}${r.locationOrServiceArea ? `<p>Service area: ${e(r.locationOrServiceArea)}</p>` : ""}<p>${label(r.relationshipClassification)}: ${e(r.disclosureText)}</p></aside>`).join("")}</article>`).join("")}</section>`).join("")}<h2>Recommendations & credit</h2><p>${e(report.disclosure)}</p><p>${e(report.creditPolicy)}</p><h2>Scope</h2><p>${e(report.scope)}</p></body></html>`;
}
