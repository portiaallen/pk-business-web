import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Aunt Penny, Roast My Books!",
  description:
    "Answer a short form of financial figures, get a personalized, illustrated roast of your books that is funny, accurate, and tells you what to do next. Preview build, not launched.",
  robots: { index: false, follow: false },
};

const STEPS = [
  { n: "1", title: "Hand over the numbers", body: "A short form, figures only. No statements, no screenshots, no documents. Nothing about your books leaves your browser." },
  { n: "2", title: "Aunt Penny does the math", body: "Your numbers are scored against real bookkeeping red flags, from reconciliation gaps to the subscription graveyard." },
  { n: "3", title: "Get your verdict and your plan", body: "A severity verdict, a roast with teeth, what the numbers actually mean, and a step-by-step plan to fix them." },
];

const INSIDE = [
  "A personal welcome from Aunt Penny",
  "Your verdict, with the scoring shown in plain view",
  "A snapshot built from your answers, and nothing else",
  "5-8 conditional roasts, each tied to the exact answers that triggered it",
  "What each finding means in plain English",
  "Your priorities, ranked",
  "A 7-day rescue plan and a 30-day improvement plan",
  "Questions to ask a professional",
  "A share card that never shows your figures",
];

export default function RoastMyBooksPage() {
  return (
    <div className="pb-16">
      <header className="ap-topbar flex items-center justify-between gap-4">
        <p className="ap-wordmark">
          Dear Aunt Penny
          <small>Mind Your Money, Baby!</small>
        </p>
        <p className="ap-topbar-note hidden sm:block">
          <Link href="/auntpenny">Back to Aunt Penny&apos;s parlor</Link>
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-5 pt-8 sm:px-8">
        <div className="flex flex-wrap gap-3">
          <span className="ap-status">Preview build. Not launched.</span>
          <span className="ap-status">Opening with the PK Family Launch, Nov 30 (conditional)</span>
        </div>

        <section className="ap-hero mt-8">
          <Image
            src="/auntpenny/penny-hero.jpg"
            alt="Aunt Penny at her desk with her laptop and her SIP. SIDE-EYE. SOLVE. REPEAT. mug"
            width={655}
            height={650}
            priority
            className="ap-hero-art"
          />
          <div>
            <p className="ap-eyebrow">Aunt Penny, Roast My Books!</p>
            <h1 className="ap-title mt-2">Hand me those numbers. And don&apos;t leave nothing out.</h1>
            <p className="mt-4 leading-relaxed">
              Answer a short form of financial figures and get a personalized roast of your books
              that is funny, accurate, and tells you what the numbers actually suggest. Comedy is
              the product. Accuracy is what&apos;s underneath it.
            </p>
            <div className="mt-6">
              <Link className="ap-cta" href="/auntpenny/roastmybooks/start">
                Start the roast
              </Link>
            </div>
          </div>
        </section>

        <div className="ap-leopard-strip mt-10" aria-hidden="true" />

        <section className="ap-card mt-8 p-6">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="ap-seal">{s.n}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed opacity-80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ap-card mt-6 p-6">
          <h2 className="text-2xl font-bold">What&apos;s inside your report</h2>
          <p className="mt-2 text-sm leading-relaxed opacity-80">
            Roughly 8 to 12 illustrated pages, sized to your actual answers. No padding, no filler.
          </p>
          <ul className="mt-4 grid gap-2 text-sm leading-relaxed sm:grid-cols-2">
            {INSIDE.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="text-[var(--ap-gold)]">✦</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Image
            src="/auntpenny/report-preview.jpg"
            alt="Preview of the illustrated Aunt Penny report cover"
            width={560}
            height={424}
            className="mx-auto mt-5 w-full max-w-sm rounded-xl border-2 border-[var(--ap-gold-soft)]"
          />
          <p className="mt-2 text-center text-xs opacity-70">
            Sample built from fictional figures. Your report is built from your answers.
          </p>
        </section>

        <section className="ap-card mt-6 p-6">
          <div className="ap-leopard-strip mb-4" aria-hidden="true" />
          <h2 className="text-2xl font-bold">Pricing</h2>
          <p className="mt-2 text-lg font-bold">
            $9.99 <span className="text-sm font-normal opacity-80">planned price. Not on sale yet.</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed opacity-80">
            This preview does not collect payment and does not ask for a card. When the launch is
            approved, payment gates the full PDF and share card. The roast itself runs free here,
            in your browser.
          </p>
        </section>

        <section className="ap-band mt-8">
          <p className="ap-eyebrow" style={{ color: "var(--ap-gold-soft)" }}>While you&apos;re here</p>
          <p className="mt-2 leading-relaxed">
            The Dear Aunt Penny Podcast arrives with the PK Family Launch.{" "}
            <Link href="https://pkservices.business">PK Business Services</Link> is open now, and
            the $99 Business &amp; Tax Season Readiness Assessment takes real appointments.
          </p>
        </section>

        <footer className="mt-10 text-xs leading-relaxed opacity-75">
          <p>
            Educational entertainment, not accounting, tax, or professional advice. Figures stay in
            your browser; nothing is uploaded or stored.
          </p>
        </footer>
      </main>
    </div>
  );
}
