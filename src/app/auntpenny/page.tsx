import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Dear Aunt Penny",
  description:
    "Come on in, baby. The Dear Aunt Penny Podcast and Aunt Penny, Roast My Books! live here. Mind your money, baby!",
  robots: { index: false, follow: false },
};

const PEARLS = [
  "Mind your money, baby!",
  "The math don't lie.",
  "Stop financing foolishness.",
  "It's a no for me.",
];

export default function AuntPennyHomePage() {
  return (
    <div className="pb-16">
      <header className="ap-topbar flex items-center justify-between gap-4">
        <p className="ap-wordmark">
          Dear Aunt Penny
          <small>Mind Your Money, Baby!</small>
        </p>
        <p className="ap-topbar-note hidden sm:block">
          A PK Family character ·{" "}
          <Link href="https://pkservices.business">PK Business Services</Link>
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-10 sm:px-8">
        <div className="flex flex-wrap gap-3">
          <span className="ap-status">Getting dressed for the PK Family Launch, Nov 30</span>
          <span className="ap-status">Nothing on this page is live yet</span>
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
            <h1 className="ap-title">Come on in, baby. We&apos;ve got some things to discuss.</h1>
            <p className="mt-4 text-lg leading-relaxed">
              Relationships messy? Money funny? Life doing the absolute most? Pull up a chair.
              Aunt Penny&apos;s got opinions.
            </p>
          </div>
        </section>

        <div className="ap-leopard-strip mt-10" aria-hidden="true" />

        <section aria-label="Two ways to pull up a chair" className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="ap-panel ap-panel-podcast">
            <p className="ap-eyebrow">The Dear Aunt Penny Podcast</p>
            <h2 className="mt-2 text-2xl font-bold">Baby, tell me what happened. Start from the beginning.</h2>
            <p className="mt-3 leading-relaxed">
              An animated advice show about relationships, family, money, work and real life.
              Episode 001, &ldquo;Girl, Don&apos;t Cosign That Car!&rdquo; is in production.
            </p>
            <p className="mt-4 inline-block rounded-full bg-white/70 px-4 py-1.5 text-sm font-semibold">
              Arrives with the PK Family Launch, Nov 30 · not published yet
            </p>
          </div>

          <div className="ap-panel ap-panel-roast">
            <p className="ap-eyebrow">Aunt Penny, Roast My Books!</p>
            <h2 className="mt-2 text-2xl font-bold">Hand me those numbers. And don&apos;t leave nothing out.</h2>
            <p className="mt-3 leading-relaxed">
              Answer a short form of financial figures and get a personalized, illustrated roast
              of your books that is funny, accurate, and tells you what to do next.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link className="ap-panel-cta" href="/auntpenny/roastmybooks">
                Open in preview
              </Link>
              <span className="text-sm font-semibold">Preview build, free while it&apos;s here</span>
            </div>
          </div>
        </section>

        <section className="ap-card mt-10 p-6">
          <p className="ap-eyebrow">Penny&apos;s Pearls</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PEARLS.map((pearl) => (
              <li key={pearl} className="ap-pearl">&ldquo;{pearl}&rdquo;</li>
            ))}
          </ul>
        </section>

        <section className="mt-10 text-center">
          <Image
            src="/auntpenny/penny-better.jpg"
            alt="Aunt Penny adjusting her cat-eye glasses: you better do better"
            width={204}
            height={304}
            className="ap-cameo mx-auto"
          />
          <h2 className="mt-5 text-2xl font-bold">A note from Aunt Penny</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed">
            I don&apos;t judge, baby. I&apos;ve seen books scarier than any horror movie, and I still
            loved the person holding them. Sit down, tell me the truth, and we&apos;ll get your money
            acting right.
          </p>
        </section>

        <footer className="mt-12 border-t border-[var(--ap-gold-soft)] pt-6 text-center text-sm">
          <p>
            Aunt Penny is a PK Business Services character.{" "}
            <Link href="https://pkservices.business">PK Business Services</Link> is open now.
          </p>
          <p className="mt-2 text-xs opacity-70">
            Merchandise, /auntpenny/shop, is a future direction and is not a store yet.
          </p>
        </footer>
      </main>
    </div>
  );
}
