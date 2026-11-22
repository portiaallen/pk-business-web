import Link from "next/link";
import { pennyOpening, pennyRoastFor } from "@/lib/auntpenny/penny-voice";
import { PrintReportButton } from "./PrintReportButton";
import { prisma } from "@/lib/prisma";
import { buildReport, nextThreeSteps, DISCLAIMER } from "@/lib/auntpenny/report";
import { requireSandbox, sandboxStripe } from "@/lib/auntpenny/paid";
import { emailAuntPennyReport, findActiveAuntPennyOrder, matchesCompletedCheckout, recordAuntPennyPayment } from "@/lib/auntpenny/fulfillment";
import type { IntakeAnswers } from "@/lib/auntpenny/roast-engine";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your purchased Aunt Penny report", robots: { index: false, follow: false } };
export default async function PaidReportPage({ searchParams }: { searchParams: Promise<{ session_id?: string; access_token?: string }> }) {
  const { session_id, access_token } = await searchParams;
  let answers: IntakeAnswers | null = null;
  try {
    requireSandbox();
    const hasToken = typeof access_token === "string" && /^[A-Za-z0-9_-]{43}$/.test(access_token);
    const hasSession = typeof session_id === "string" && /^cs_(test_|live_)[a-zA-Z0-9_]+$/.test(session_id) && session_id.length <= 255;
    if (!hasToken && !hasSession) throw new Error("Missing credential");
    const recoveredOrder = hasToken ? await findActiveAuntPennyOrder(access_token) : null;
    if (hasToken && !recoveredOrder) throw new Error("Expired recovery");
    const lookupSessionId = recoveredOrder?.stripeSessionId ?? session_id;
    if (!lookupSessionId) throw new Error("Missing session");
    const session = await sandboxStripe().checkout.sessions.retrieve(lookupSessionId);
    const order = await prisma.auntPennyOrder.findUnique({ where: { stripeSessionId: lookupSessionId } });
    if (!order || !matchesCompletedCheckout(session, order)) throw new Error("Checkout mismatch");
    if (hasToken) {
      if (recoveredOrder?.id !== order.id || order.status !== "PAID" || recoveredOrder.accessTokenHash !== order.accessTokenHash) {
        throw new Error("Invalid recovery");
      }
    } else if (order.status !== "PAID") {
      // Stripe can return the buyer before the webhook reaches us. Reconcile only
      // after the same server-side payment and order checks used by the webhook.
      if (!await recordAuntPennyPayment(order)) throw new Error("Order not payable");
      try {
        await emailAuntPennyReport(order, "initial");
      } catch {
        console.error("Aunt Penny initial report email failed after checkout");
      }
    }
    answers = JSON.parse(order.intakeJson) as IntakeAnswers;
  } catch {
    return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-3xl font-bold">Aunt Penny is checking the receipt.</h1><p className="mt-4">Your report is not available until payment is confirmed.</p><Link href="/auntpenny/roastmybooks/recover">Recover your purchased report</Link><p className="mt-4"><Link href="/auntpenny/roastmybooks/start">Return to the free roast</Link></p></main>;
  }
  const report = buildReport(answers);
  const steps = nextThreeSteps(report.triggered);
  const displayName = answers.firstName?.trim().slice(0, 40) || "friend";
  const findings = report.findings;
  return <main className="ap-premium-report ap-print mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
    <header className="ap-report-cover">
      <p className="ap-report-kicker">PK BUSINESS SERVICES PRESENTS · AUNT PENNY</p>
      <p className="ap-report-edition">THE PRIVATE BOOKS EDITION</p>
      <h1>Roast My Books<span className="ap-report-mark">!</span></h1>
      <p className="ap-report-subtitle">The receipts have entered the chat.</p>
      <div className="ap-report-rule" aria-hidden="true" />
      <p className="ap-report-intro">{pennyOpening(answers)}</p>
      <p className="ap-report-intro">Well, {displayName}, pull up a chair. I brought the receipts, the side-eye, and a plan.</p>
      <div className="ap-report-verdict">
        <p>YOUR OFFICIAL VERDICT</p>
        <h2>{report.tierName}</h2>
        <span>{report.tierLine}</span>
        <small>Severity score {report.points} · Based on figures you supplied, not a review of your records</small>
      </div>
    </header>
    <div className="ap-report-content"><div className="ap-no-print mt-6 flex flex-wrap gap-3"><PrintReportButton/><Link href="/auntpenny/roastmybooks/recover">Email me a fresh report link</Link></div><p className="ap-no-print mt-3 text-sm">Use your newest emailed link; it expires after 24 hours. Already purchased? Recover your report instead of checking out again.</p>
      <section className="ap-report-section">
        <p className="ap-report-chapter">ACT I · THE READ</p>
        <h2>Aunt Penny has some thoughts.</h2>
        <blockquote className="ap-report-quote">“{report.funniestQuote}”</blockquote>
        {report.triggered.length ? report.triggered.map((t, index) =>
          <article className="ap-report-roast" key={t.id}>
            <span className="ap-report-number">{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{t.title}</h3><p>{pennyRoastFor(t.id, answers)}</p>{t.roastLines.map((line, i) => <p key={i}>{line}</p>)}<p className="ap-report-meaning"><strong>Behind the joke:</strong> {t.meaning}</p></div>
          </article>
        ) : <p>Your submitted figures did not trigger any of Aunt Penny&apos;s warning-sign templates. Keep your books reconciled and review them regularly.</p>}
      </section>
      <section className="ap-report-section">
        <p className="ap-report-chapter">ACT II · THE RECEIPTS</p>
        <h2>What your numbers actually suggest</h2>
        <p className="ap-report-note">Each observation below traces back to a figure you entered. An unusual number is a question, not proof of an accounting error.</p>
        {findings.length ? findings.map(f => <article className="ap-report-finding" key={f.id}>
          <h3>{f.title}</h3>
          <p><strong>THE EVIDENCE</strong> {f.evidence}</p>
          <p><strong>WHY IT MATTERS</strong> {f.matters}</p>
          <p><strong>CHECK THIS</strong> {f.check}</p>
          <p><strong>YOUR NEXT MOVE</strong> {f.next}</p>
          <p><strong>WHEN TO GET HELP</strong> {f.help}</p>
        </article>) : <p>No threshold-based findings were triggered. That is not a certification that your books are error-free.</p>}
      </section>
      <section className="ap-report-section">
        <p className="ap-report-chapter">ACT III · THE COMEBACK</p>
        <h2>Three moves. No magical thinking.</h2>
        <ol className="ap-report-steps">{steps.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}</ol>
        <div className="ap-report-plans">
          <article><h3>The next 7 days</h3><p><strong>Days 1–2:</strong> Check your submitted figures against actual records.</p><p><strong>Days 3–4:</strong> {steps[0]}</p><p><strong>Days 5–6:</strong> {steps[1]}</p><p><strong>Day 7:</strong> Review progress and decide when to tackle: {steps[2]}</p></article>
          <article><h3>The next 30 days</h3><p><strong>Week 1:</strong> Work through your seven-day checkpoints.</p><p><strong>Week 2:</strong> Revisit the first priority and verify progress.</p><p><strong>Week 3:</strong> Work through remaining priorities; ask for help where needed.</p><p><strong>Week 4:</strong> Recheck the figures and set a monthly maintenance routine.</p></article>
        </div>
      </section>
      <section className="ap-report-section"><p className="ap-report-chapter">ACT IV · BRING THE RECEIPTS</p><h2>Questions to take to your bookkeeper</h2><ul className="list-disc pl-6"><li>Which of these observations can you verify from my actual records?</li><li>What supporting statements or reconciliations do you need?</li><li>Which issue should I address first, and what is the realistic scope?</li></ul></section>
      {report.bridge.show && <aside className="ap-report-bridge"><h2>When the roast needs a real bookkeeper</h2><p>{report.bridge.line}</p><Link href="/readiness/start">Explore the $99 Readiness Assessment</Link></aside>}
      <footer className="ap-report-footer"><p className="ap-report-signoff">With love, receipts, and absolutely no patience for mystery math — Aunt Penny.</p><p>{DISCLAIMER}</p><p>Private report: keep this link secure. Use your browser&apos;s Print / Save as PDF command to keep your copy.</p><p>PK Business Services · People | Knowledge | Results</p></footer>
    </div>
  </main>;
}
