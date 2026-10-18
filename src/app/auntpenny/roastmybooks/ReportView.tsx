import Link from "next/link";
import Image from "next/image";
import { ShareCardDownload } from "./ShareCardCanvas";
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
        <p className="ap-eyebrow">The Roast</p>
        <div className="mt-3 space-y-2 text-lg leading-relaxed">
          {report.triggered.length === 0 ? (
            <p>{report.funniestQuote}</p>
          ) : (
            report.triggered.map((t) => (
              <div key={t.id}>
                <h3 className="font-semibold" style={{ color: "var(--ap-rose)" }}>{t.title}</h3>
                {t.roastLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="ap-card mt-6 p-6">
        <p className="ap-eyebrow">What This Actually Means</p>
        <ul className="mt-3 space-y-3 text-sm leading-relaxed opacity-90">
          {report.triggered.map((t) => (
            <li key={t.id}>
              <strong>{t.title}.</strong> {t.meaning}
            </li>
          ))}
          {report.triggered.length === 0 && (
            <li>Nothing triggered. That is genuinely rare and genuinely good.</li>
          )}
        </ul>
      </div>

      <div className="ap-card mt-6 p-6">
        <p className="ap-eyebrow">Where to start: your first three moves</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm opacity-90">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs opacity-70">
          The full report walks the first seven days and the first thirty days with you, step by step.
        </p>
      </div>

      {report.bridge.show && (
        <div className="ap-card mt-6 p-6">
          <div className="ap-leopard-strip mb-4" aria-hidden="true" />
          <p className="ap-eyebrow">The Bridge</p>
          <p className="mt-2 leading-relaxed">
            {report.bridge.line.replace(ASSESSMENT_URL, "").trim()}{" "}
            <Link href={ASSESSMENT_URL}>Book the assessment</Link>.
          </p>
          <p className="mt-2 text-sm opacity-75">
            The assessment is real PK work: a professional reading actual books. The roast
            reads a form, and it will never claim otherwise.
          </p>
        </div>
      )}

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

      <div className="ap-card mt-10 p-6">
        <p className="ap-eyebrow">Your full PDF</p>
        <p className="mt-2 leading-relaxed">
          In this preview you can save the full branded report yourself, free: the button
          below opens your browser&apos;s print dialog, where &ldquo;Save as PDF&rdquo; files it away.
          At launch, the paid version ($9.99 planned price. Not on sale yet.) delivers the
          polished PDF and share card by email automatically. Nothing is charged in this
          preview and no payment method is requested.
        </p>
        <button
          className="ap-cta ap-no-print mt-4"
          type="button"
          onClick={() => window.print()}
        >
          Print or save as PDF
        </button>
      </div>

      <p className="mt-8 text-xs leading-relaxed opacity-70">{DISCLAIMER}</p>
      <p className="mt-4 text-xs opacity-70">
        From the world of Aunt Penny: <Link href="https://pkservices.business">PK Business Services</Link>.
        The Dear Aunt Penny Podcast arrives with the PK Family Launch, Nov 30. Ask PK is paused and is
        not linked here on purpose.
      </p>
    </div>
  );
}
