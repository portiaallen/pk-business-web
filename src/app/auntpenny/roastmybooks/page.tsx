import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aunt Penny, Roast My Books!",
  description:
    "Answer a short form of financial figures, get a personalized roast of your books that is funny, accurate, and tells you what to do next. Not launched yet.",
  robots: { index: false, follow: false },
};

const STEPS = [
  { n: "1", title: "Hand over the numbers", body: "A short form, figures only. No statements, no screenshots, no documents. Nothing about your books leaves your browser." },
  { n: "2", title: "Aunt Penny does the math", body: "Your numbers are scored against real bookkeeping red flags, from reconciliation gaps to the subscription graveyard." },
  { n: "3", title: "Get your verdict", body: "A severity verdict, a roast with teeth, what the numbers actually mean, and your next three steps." },
];

export default function RoastMyBooksPage() {
  return (
    <main className="min-h-screen px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="ap-eyebrow">Aunt Penny, Roast My Books!</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="ap-status">Preview build. Not launched.</span>
          <span className="ap-status">Opening with the PK Family Launch, Nov 30.</span>
        </div>
        <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
          Hand me those numbers. And don&apos;t leave nothing out.
        </h1>
        <p className="mt-4 text-lg leading-relaxed opacity-90">
          Answer a short form of financial figures and get a personalized roast of your
          books that is funny, accurate, and tells you what the numbers actually suggest.
          Comedy is the product. Accuracy is what&apos;s underneath it.
        </p>

        <div className="ap-card mt-10 p-6">
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="ap-seal shrink-0">{s.n}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed opacity-80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="ap-card ap-leopard mt-6 p-6">
          <h2 className="text-xl font-semibold">Pricing</h2>
          <p className="mt-2 text-lg font-bold">
            $9.99 <span className="text-sm font-normal opacity-80">planned price. Not on sale yet.</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed opacity-80">
            This preview does not collect payment and does not ask for a card. When the
            launch is approved, payment gates the full PDF and share card. The roast
            itself runs free here, in your browser.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4">
          <Link className="ap-cta" href="/auntpenny/roastmybooks/start">
            Start the roast
          </Link>
          <p className="text-sm opacity-75">
            Educational entertainment, not accounting, tax, or professional advice. Figures stay in your
            browser; nothing is uploaded or stored. Approved Aunt Penny artwork is added to this page
            before launch.
          </p>
          <p className="text-sm opacity-75">
            The Dear Aunt Penny Podcast arrives with the PK Family Launch.{" "}
            <Link href="https://pkservices.business">PK Business Services</Link> is open now.
          </p>
        </div>
      </div>
    </main>
  );
}
