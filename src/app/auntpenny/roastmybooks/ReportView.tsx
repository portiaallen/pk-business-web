import Link from "next/link";
import { ASSESSMENT_URL } from "@/lib/auntpenny/roast-engine";
import { DISCLAIMER } from "@/lib/auntpenny/report";
import type { RoastReport } from "@/lib/auntpenny/roast-engine";

export function ReportView({
  report,
  steps,
  firstName,
}: {
  report: RoastReport;
  steps: string[];
  firstName: string;
}) {
  const isTier6 = report.tier === 6;
  return (
    <div className="mt-10">
      <div className="ap-card p-6">
        <p className="ap-eyebrow">The Verdict</p>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{report.tierName}</h2>
        <p className="mt-2 text-lg opacity-90">{report.tierLine}</p>
        <p className="mt-4 text-sm opacity-70">
          Severity score: {report.points} points
          {report.hardFlags.length > 0 && <> · hard flags: {report.hardFlags.join("; ")}</>}
        </p>
      </div>

      <div className="ap-card mt-6 p-6">
        <p className="ap-eyebrow">The Roast</p>
        <div className="mt-3 space-y-2 text-lg leading-relaxed">
          {report.triggered.length === 0 ? (
            <p>{report.funniestQuote}</p>
          ) : (
            report.triggered.map((t) => (
              <div key={t.id}>
                <h3 className="font-semibold" style={{ color: "var(--ap-gold)" }}>{t.title}</h3>
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
        <p className="ap-eyebrow">Your Next Three Steps</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm opacity-90">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      {report.bridge.show && (
        <div className="ap-card ap-leopard mt-6 p-6">
          <p className="ap-eyebrow">The Bridge</p>
          <p className="mt-2 leading-relaxed">
            {report.bridge.line}{" "}
            <Link href={ASSESSMENT_URL}>Book the assessment</Link>.
          </p>
          <p className="mt-2 text-sm opacity-75">
            The assessment is real PK work: a professional reading actual books. The roast
            reads a form, and it will never claim otherwise.
          </p>
        </div>
      )}

      {/* Share card: certificate aesthetic, never prints figures, business name, or dates. */}
      <div className="mt-10 flex flex-col items-center">
        <p className="ap-eyebrow">Your share card</p>
        <div className="ap-sharecard mt-4">
          <span className="ap-seal">Certified by Roast My Books</span>
          <h3 className="text-2xl font-bold">{report.tierName}</h3>
          <p className="text-lg">{report.funniestQuote}</p>
          {firstName && <p className="text-sm opacity-80">{firstName} &apos;s books, officially rated.</p>}
        </div>
        <p className="mt-3 max-w-sm text-center text-xs opacity-70">
          The card shows the verdict and one quip. It never prints your figures, business
          name, or dates. Screenshot it and let the funny line travel.
        </p>
      </div>

      <div className="ap-card mt-10 p-6">
        <p className="ap-eyebrow">Your full PDF</p>
        <p className="mt-2 leading-relaxed">
          {isTier6
            ? "At this severity, the full write-up is worth the read even if you never buy a thing."
            : "The full branded PDF lands with the paid version."}{" "}
          <span className="font-bold">$9.99 planned price. Not on sale yet.</span> Delivery by
          email with your share card, when the launch is approved. Nothing is charged in this
          preview and no payment method is requested.
        </p>
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
