// ONE-OFF (owner-directed, 2026-10-12): Portia asked that nothing stay in the
// consultations queue that did not make money. Every remaining submission is
// tied to a purchased readiness assessment that was started but never paid.
// This script deletes the full unpaid chain (assessment + children, unpaid
// invoice, empty engagement, client shell, analytics events) and the intake
// submission itself. Anything with a PAID payment is kept and reported.
// Idempotent: once the queue holds only paid assessments it is a no-op.
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";

const liveUrl = (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
if (!liveUrl) { console.error("purge: no DATABASE_URL"); process.exit(0); }
const opts = { url: liveUrl.startsWith("file:") || liveUrl.includes(":") ? liveUrl : "file:" + liveUrl };
if (liveUrl.startsWith("libsql:")) {
  const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim();
  if (token) opts.authToken = token;
}
const db = createClient(opts);
const rows = (sql, args = []) => db.execute({ sql, args }).then((r) => r.rows);
const run = (sql, args = []) => db.execute({ sql, args });
const del = async (sql, args) => (await run(sql, args)).rowsAffected;
const EVENTS = ["readiness_page_view","gut_check_interaction","readiness_cta_click","preliminary_intake_started","preliminary_intake_completed","checkout_started","purchase_success","intake_started","assessment_submitted","report_delivered","credit_claimed","credit_applied"];
const h = (event, key) => createHash("sha256").update(`readiness:${event}:${key}`).digest("hex");

try {
  const subs = await rows(
    `SELECT s.id AS sid, s.email, s.fullName, a.id AS aid, a.requestId, a.invoiceId, a.clientId, a.paymentStatus
     FROM IntakeSubmission s JOIN ReadinessAssessment a ON a.intakeSubmissionId = s.id`);
  const kept = [], purged = [];
  for (const s of subs) {
    const pay = await rows(
      `SELECT status FROM Payment WHERE invoiceId = ? AND status = 'PAID' LIMIT 1`, [s.invoiceId]);
    if (s.paymentStatus === "PAID" || pay.length > 0) { kept.push(s.email); continue; }

    for (const t of ["ReadinessDocumentEvidence","ReadinessCredit","ReadinessReportVersion","AssessmentRecommendation","ReadinessFinding"])
      await del(`DELETE FROM ${t} WHERE assessmentId = ?`, [s.aid]);
    await del(`DELETE FROM ReadinessAssessment WHERE id = ?`, [s.aid]);
    for (const e of EVENTS) await del(`DELETE FROM ReadinessAnalyticsEvent WHERE dedupeKey = ?`, [h(e, s.aid)]);

    const invPays = await rows(`SELECT COUNT(*) AS n FROM Payment WHERE invoiceId = ?`, [s.invoiceId]);
    if (invPays[0].n === 0) {
      await del(`DELETE FROM InvoiceActivity WHERE invoiceId = ?`, [s.invoiceId]);
      await del(`DELETE FROM Invoice WHERE id = ?`, [s.invoiceId]);
    }

    if (s.requestId) {
      const blockers = await rows(
        `SELECT
          (SELECT COUNT(*) FROM VaultDocument WHERE requestId = ?) AS vd,
          (SELECT COUNT(*) FROM CapabilityGrant WHERE requestId != '' AND requestId = ?) AS cg,
          (SELECT COUNT(*) FROM Document WHERE requestId = ?) AS doc,
          (SELECT COUNT(*) FROM Deliverable WHERE requestId = ?) AS dl`, [s.requestId, s.requestId, s.requestId, s.requestId]);
      const b = blockers[0];
      if (b.vd === 0 && b.cg === 0 && b.doc === 0 && b.dl === 0) {
        for (const t of ["InternalNote","VerificationFinding","VerificationResult","FormSubmission","DocumentRequest","ClientMessage","AiReview","TimeEntry","QbCleanupReview","OrdinaryTransferIntent"])
          await del(`DELETE FROM ${t} WHERE requestId = ?`, [s.requestId]);
        await del(`DELETE FROM VerificationRequest WHERE id = ?`, [s.requestId]);
      }
    }

    const stillUsed = await rows(
      `SELECT
        (SELECT COUNT(*) FROM Invoice WHERE clientId = ?) AS inv,
        (SELECT COUNT(*) FROM Payment WHERE clientId = ?) AS pay,
        (SELECT COUNT(*) FROM VerificationRequest WHERE clientId = ?) AS req,
        (SELECT COUNT(*) FROM ClientMember WHERE clientId = ?) AS mem`, [s.clientId, s.clientId, s.clientId, s.clientId]);
    const u = stillUsed[0];
    if (u.inv === 0 && u.pay === 0 && u.req === 0 && u.mem === 0)
      await del(`DELETE FROM Client WHERE id = ?`, [s.clientId]);

    await del(`DELETE FROM IntakeSubmission WHERE id = ?`, [s.sid]);
    purged.push(s.email);
  }
  const left = await rows(`SELECT s.email, a.paymentStatus FROM IntakeSubmission s LEFT JOIN ReadinessAssessment a ON a.intakeSubmissionId = s.id`);
  console.log("PURGE-UNPAID-SUBMISSIONS kept(paied):", JSON.stringify(kept));
  console.log("PURGE-UNPAID-SUBMISSIONS purged:", JSON.stringify(purged));
  console.log("PURGE-UNPAID-SUBMISSIONS remaining in queue:", JSON.stringify(left));
} catch (e) {
  console.error("purge error:", e.message);
  console.error("purge exit (non-fatal, diagnostic mode)");
}
