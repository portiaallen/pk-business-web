import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PK Practice Partners | CPA Outsourcing & Practice Support",
  description: "Flexible bookkeeping, cleanup, and tax-ready bookkeeping support for CPA and accounting firms. White-label, named, or hybrid partnerships.",
};

const services = [
  ["Monthly bookkeeping", "Reconciliations, transaction review, and monthly close support."],
  ["Cleanup and catch-up", "Bring historical records up to date and prepare books for review."],
  ["Tax-ready bookkeeping", "Organized financial records and supporting schedules for your tax workflow."],
  ["Practice overflow", "Defined project support when your firm needs additional capacity."],
];

const models = [
  ["White-label", "PK supports your firm behind the scenes while you lead the client relationship."],
  ["Named partner", "Identify PK Business Services as an approved practice support provider."],
  ["Hybrid", "Choose the arrangement separately for each engagement."],
];

export default function CPAPartnersPage() {
  return (
    <>
      <section className="bg-charcoal px-5 py-20 text-ivory sm:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-gold-light">PK Practice Partners</p>
          <h1 className="max-w-4xl font-heading text-5xl leading-tight sm:text-7xl">Your practice. Your clients. Your choice. <span className="text-gold-light">Our support.</span></h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ivory/85">Flexible outsourced bookkeeping and practice support for CPA firms, tax professionals, and accounting practices. Expand capacity without giving up your client relationships.</p>
          <a className="mt-9 inline-flex min-h-12 items-center justify-center rounded-md bg-pink px-7 py-3 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4" href="mailto:info@pkservices.business?subject=PK%20Practice%20Partners%20-%20Partnership%20Inquiry">Request a partner conversation</a>
          <p className="mt-3 text-sm text-ivory/70">No sensitive client or taxpayer documents by email, please.</p>
        </div>
      </section>
      <section className="section-padding">
        <div className="container-narrow">
          <p className="font-semibold uppercase tracking-widest text-pink">Built around your workflow</p>
          <h2 className="mt-3 text-4xl">Support when your firm needs it.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {services.map(([name, description]) => (
              <div key={name} className="rounded-xl border border-border bg-card p-7">
                <h3 className="text-2xl">{name}</h3><p className="mt-3 leading-relaxed text-muted-gray">{description}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-gray">Tax return preparation assistance, payroll support, and other specialized work may be considered after scope, credentials, and compliance review.</p>
        </div>
      </section>
      <section className="section-padding bg-secondary">
        <div className="container-narrow">
          <p className="font-semibold uppercase tracking-widest text-pink">Your choice</p>
          <h2 className="mt-3 text-4xl">Three ways to work together.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {models.map(([name, description]) => (
              <div key={name} className="rounded-xl border border-border bg-card p-7">
                <h3 className="text-2xl">{name}</h3><p className="mt-3 leading-relaxed text-muted-gray">{description}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-gray">All arrangements remain subject to applicable confidentiality, taxpayer disclosure, and professional requirements.</p>
        </div>
      </section>
      <section className="section-padding">
        <div className="container-narrow grid gap-10 md:grid-cols-2">
          <div>
            <p className="font-semibold uppercase tracking-widest text-pink">How it works</p>
            <h2 className="mt-3 text-4xl">A straightforward partnership.</h2>
          </div>
          <ol className="space-y-5 text-lg leading-relaxed">
            <li><strong>01. Connect.</strong> Tell us about your practice and the capacity you need.</li>
            <li><strong>02. Scope.</strong> Agree on deliverables, communication, pricing, and confidentiality.</li>
            <li><strong>03. Onboard.</strong> Complete the appropriate agreements and secure-access checks.</li>
            <li><strong>04. Deliver.</strong> PK supports the assigned work; your firm maintains final review and approval.</li>
          </ol>
        </div>
      </section>
      <section className="bg-charcoal px-5 py-16 text-center text-ivory">
        <h2 className="text-4xl">Let's build a better way to handle overflow.</h2>
        <p className="mx-auto mt-4 max-w-xl text-ivory/80">Wholesale partner pricing is customized by engagement scope and volume.</p>
        <a href="mailto:info@pkservices.business?subject=PK%20Practice%20Partners%20-%20Partnership%20Inquiry" className="mt-8 inline-flex min-h-12 items-center rounded-md bg-pink px-7 py-3 font-semibold text-white">Contact PK about partnering</a>
        <p className="mt-5 text-sm text-ivory/70">PK Business Services · Professional with Personality</p>
        <Link className="mt-3 inline-block text-sm underline underline-offset-4" href="/contact">General service inquiries</Link>
      </section>
    </>
  );
}
