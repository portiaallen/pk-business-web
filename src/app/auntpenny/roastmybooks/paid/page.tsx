import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReport, nextThreeSteps, DISCLAIMER } from "@/lib/auntpenny/report";
import { PRICE_CENTS, PRODUCT_CODE, requireSandbox, sandboxStripe, tokenHash } from "@/lib/auntpenny/paid";
import type { IntakeAnswers } from "@/lib/auntpenny/roast-engine";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your purchased Aunt Penny report", robots: { index: false, follow: false } };
export default async function PaidReportPage({ searchParams }: { searchParams: Promise<{ session_id?: string; access_token?: string }> }) {
  const { session_id, access_token } = await searchParams;
  let answers: IntakeAnswers | null = null;
  try {
    requireSandbox();
    const hasToken = typeof access_token === "string" && /^[A-Za-z0-9_-]{43}$/.test(access_token);
    const hasSession = typeof session_id === "string" && /^cs_test_[a-zA-Z0-9_]+$/.test(session_id) && session_id.length <= 255;
    if (!hasToken && !hasSession) throw new Error("Missing credential");
    const recoveredOrder = hasToken ? await prisma.auntPennyOrder.findUnique({ where: { accessTokenHash: tokenHash(access_token!) } }) : null;
    if (hasToken && (!recoveredOrder || !recoveredOrder.accessExpiresAt || recoveredOrder.accessExpiresAt.getTime() <= Date.now())) throw new Error("Expired recovery");
    const lookupSessionId = recoveredOrder?.stripeSessionId ?? session_id;
    if (!lookupSessionId) throw new Error("Missing session");
    const session = await sandboxStripe().checkout.sessions.retrieve(lookupSessionId);
    if (session.payment_status !== "paid" || session.mode !== "payment" || session.currency !== "usd" || session.amount_total !== PRICE_CENTS || session.metadata?.productCode !== PRODUCT_CODE) throw new Error("Unpaid");
    const order = await prisma.auntPennyOrder.findUnique({ where: { stripeSessionId: session.id } });
    if (!order || (hasToken && recoveredOrder?.id !== order.id) || order.id !== session.metadata?.orderId || order.amountCents !== PRICE_CENTS || order.status !== "PAID") throw new Error("Not fulfilled");
    answers = JSON.parse(order.intakeJson) as IntakeAnswers;
  } catch {
    return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-3xl font-bold">Aunt Penny is checking the receipt.</h1><p className="mt-4">Your sandbox report is not available until payment is confirmed. No real purchases are enabled.</p><Link href="/auntpenny/roastmybooks/recover">Recover your purchased report</Link><p className="mt-4"><Link href="/auntpenny/roastmybooks/start">Return to the free roast</Link></p></main>;
  }
  const report = buildReport(answers);
  const steps = nextThreeSteps(report.triggered);
  return <main className="mx-auto max-w-3xl px-6 py-12 ap-print">
    <p className="ap-eyebrow">PK Business Services Original · Aunt Penny</p>
    <h1 className="mt-3 text-4xl font-bold">Your Roast My Books Report</h1>
    <p className="mt-2">Verified sandbox purchase · Educational entertainment</p>
    <section className="ap-card mt-8 p-6"><h2 className="text-2xl font-bold">{report.tierName}</h2><p>{report.tierLine}</p><p>Severity score: {report.points}</p></section>
    <section className="ap-card mt-6 p-6"><h2 className="text-2xl font-bold">The Roast</h2>{report.triggered.length ? report.triggered.map(t=><div key={t.id} className="mt-3"><h3 className="font-bold">{t.title}</h3>{t.roastLines.map((line,i)=><p key={i}>{line}</p>)}</div>):<p>{report.funniestQuote}</p>}</section>
    <section className="ap-card mt-6 p-6"><h2 className="text-2xl font-bold">Traceable findings</h2>{report.findings.map(f=><div key={f.id} className="mt-4"><h3 className="font-bold">{f.title}</h3><p>Evidence: {f.evidence}</p><p>Why it matters: {f.matters}</p><p>Check: {f.check}</p><p>Next: {f.next}</p><p>When to get help: {f.help}</p></div>)}</section>
    <section className="ap-card mt-6 p-6"><h2 className="text-2xl font-bold">Your first three moves</h2><ol>{steps.map((s,i)=><li key={i}>{i+1}. {s}</li>)}</ol></section>
    <section className="ap-card mt-6 p-6"><h2 className="text-2xl font-bold">7-day rescue plan</h2><p>Days 1–2: Recheck figures against your actual records.</p><p>Days 3–4: {steps[0]}</p><p>Days 5–6: {steps[1]}</p><p>Day 7: Review progress and schedule the next action: {steps[2]}</p></section>
    <section className="ap-card mt-6 p-6"><h2 className="text-2xl font-bold">30-day improvement plan</h2><p>Week 1: Work through the seven-day checkpoints.</p><p>Week 2: Revisit the first priority and verify progress.</p><p>Week 3: Work through the remaining priorities and seek help when needed.</p><p>Week 4: Recheck figures and establish monthly maintenance.</p></section>
    <p className="mt-6 text-sm">{DISCLAIMER}</p>
    <p className="mt-3 text-xs">Keep this private receipt link secure; anyone holding it may be able to view your report. Use your browser Print / Save as PDF command to keep a copy.</p>
  </main>;
}
