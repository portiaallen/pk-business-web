import Link from "next/link";
import { pennyOpening, pennyToday } from "@/lib/auntpenny/penny-voice";
import Image from "next/image";
import { ShareCardDownload } from "./ShareCardCanvas";
import { SandboxPurchase } from "./SandboxPurchase";
import { ASSESSMENT_URL } from "@/lib/auntpenny/roast-engine";
import { DISCLAIMER } from "@/lib/auntpenny/report";
import type { IntakeAnswers, RoastReport } from "@/lib/auntpenny/roast-engine";

const fmt = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export function ReportView({
  report,
  steps,
  intake,
}: {
  report: RoastReport;
  steps: string[];
  intake: IntakeAnswers;
}) {
  return (
    <div className="mt-10 ap-print">
      <div className="ap-card p-6">
        <div className="ap-verdict-row">
          <Image
            src="/auntpenny/penny-calc.jpg"
            alt="Aunt Penny with her calculator: the math don't lie"
            width={204}
            height={304}
            className="ap-cameo"
          />
          <div>
            <p className="ap-eyebrow">The Verdict</p>
            <h2 className="mt-1 text-3xl font-bold sm:text-4xl">{report.tierName}</h2>
            <p className="mt-2 text-lg opacity-90">{report.tierLine}</p>
            <p className="mt-4 text-sm opacity-70">
              Severity score: {report.points} points
              {report.hardFlags.length > 0 && <> · hard flags: {report.hardFlags.join("; ")}</>}
            </p>
          </div>
        </div>
      </div>

      <div className="ap-card mt-6 p-6">
        <p className="ap-eyebrow">The figures, labeled</p>
        <ul className="mt-3 space-y-1 text-sm opacity-90">
          <li>Submitted: average monthly revenue, {fmt(intake.monthlyRevenue)}</li>
          <li>Submitted: average monthly expenses, {fmt(intake.monthlyExpenses)}</li>
          <li>
            Calculated: implied monthly net = revenue minus expenses ={" "}
            {fmt(report.figureCheck.impliedMonthlyNet)}
          </li>
          <li>Submitted: net income over the last 3 months, {fmt(intake.netIncome3mo)}</li>
          <li>
            Calculated: that 3-month figure divided by 3 ={" "}
            {fmt(report.figureCheck.fromThreeMonths)} per month
          </li>
        </ul>
        {report.figureCheck.note && (
          <p className="mt-3 rounded-md border border-[#d8b9c8] bg-white/70 p-3 text-sm" role="note">
            {report.figureCheck.note}
          </p>
        )}
      </div>

      <div className="ap-card mt-6 p-6">
        <p className="ap-eyebrow">Your free opening roast</p>
        <blockquote className="ap-report-quote">{pennyOpening(intake)}</blockquote>
        <p className="mt-3 text-sm">One useful thing to do today: {pennyToday(intake)}</p>
      </div>
      <div className="ap-card mt-6 p-6">
        <p className="ap-eyebrow">A peek at the receipts</p>
        {report.findings.slice(0, 2).map(f => <div key={f.id} className="mt-3">
          <h3 className="font-bold">{f.title}</h3><p className="text-sm">{f.evidence}</p>
          <p className="text-sm">{f.check}</p>
        </div>)}
        {report.findings.length === 0 && <p>No threshold-based findings triggered. This does not certify your records.</p>}
      </div>
      {/* Share card: ivory certificate with Penny on it, never prints figures, business name, or dates. */}
      <div className="mt-10 flex flex-col items-center">
        <p className="ap-eyebrow">Your share card</p>
        <div className="ap-sharecard mt-4">
          <Image
            src="/auntpenny/penny-serious.jpg"
            alt="Aunt Penny laughing: be serious"
            width={204}
            height={304}
            className="ap-cameo"
          />
          <p className="ap-eyebrow">Certified by Roast My Books</p>
          <h3 className="text-2xl font-bold">{report.tierName}</h3>
          <p className="text-lg">{report.funniestQuote}</p>
        </div>
        <ShareCardDownload report={report} />
        <p className="mt-3 max-w-sm text-center text-xs opacity-70">
          The card shows the verdict and one quip. It never prints your name, your
          figures, the business name, or dates. Post it and let the funny line travel.
        </p>
      </div>

      <SandboxPurchase answers={intake} />

      <p className="mt-8 text-xs leading-relaxed opacity-70">{DISCLAIMER}</p>
      <p className="mt-4 text-xs opacity-70">
        From the world of Aunt Penny: <Link href="https://pkservices.business">PK Business Services</Link>.
        The Dear Aunt Penny Podcast is on hold through December 2026, with a January 2027 reassessment. Ask PK is paused and is
        not linked here on purpose.
      </p>
    </div>
  );
}
