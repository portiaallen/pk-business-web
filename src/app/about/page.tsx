import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { Section, SectionHeader } from "@/components/layout/Section";
import { siteConfig } from "@/content/site";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: {
    absolute: "About PK Business Services | Bookkeeping & Financial Documentation",
  },
  description:
    "Meet the founder of PK Business Services and learn how our practical, professional approach helps individuals and small businesses organize bookkeeping, financial records, and documentation.",
};

const approachPrinciples = [
  {
    title: "Clarity",
    description:
      "Understand what information needs attention and what steps come next.",
  },
  {
    title: "Organization",
    description:
      "Turn scattered financial information into organized records that are easier to manage.",
  },
  {
    title: "Integrity",
    description:
      "Work with authentic information and legitimate documentation, with accuracy and transparency at the center of every engagement.",
  },
];

const whyClientsChoose = [
  {
    title: "Attention to Detail",
    description: "Careful organization and review of the information provided.",
  },
  {
    title: "Clear Communication",
    description: "Straightforward communication without unnecessary jargon.",
  },
  {
    title: "Practical Support",
    description: "Solutions focused on what the client actually needs.",
  },
  {
    title: "Client-Focused Service",
    description:
      "Professional support built around the individual situation rather than a one-size-fits-all approach.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="Practical Support. Professional Standards."
        subtitle="A founder-led business built on organization, clarity, and professional support for the financial records that matter."
      />

      {/* Founder */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <figure className="mx-auto w-full max-w-[280px] sm:max-w-xs lg:mx-0">
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-cream shadow-sm">
              <Image
                src="/images/portia-allen-founder.jpg"
                alt="Portia Allen, Founder of PK Business Services"
                fill
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 384px"
                className="object-cover object-[center_20%]"
              />
            </div>
          </figure>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Meet the Founder
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold text-charcoal sm:text-4xl">
              Portia Allen
            </h2>
            <p className="mt-1 text-base font-medium text-muted-gray">
              Founder, PK Business Services
            </p>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-gray sm:text-lg">
              <p>
                PK Business Services was created to provide practical,
                professional support to individuals and small businesses that
                need help getting their bookkeeping, financial records, and
                documentation organized.
              </p>
              <p>
                With a background spanning accounting, tax, bookkeeping,
                financial services, and business operations, Portia brings a
                practical, detail-focused approach to helping clients understand
                what needs attention, organize the information they already
                have, and move forward with greater clarity.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* The PK Approach */}
      <Section variant="cream">
        <SectionHeader title="Professional Support. Practical Solutions." />
        <p className="mx-auto mb-12 max-w-3xl text-center text-lg leading-relaxed text-muted-gray">
          Financial organization doesn&apos;t have to feel overwhelming. PK
          Business Services takes a straightforward approach: understand the
          situation, organize the information, identify what needs attention, and
          help the client determine the next step.
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          {approachPrinciples.map((principle) => (
            <div
              key={principle.title}
              className="border-t-2 border-gold/40 bg-background px-1 pt-6"
            >
              <h3 className="mb-3 font-heading text-lg font-semibold uppercase tracking-wide text-charcoal">
                {principle.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-gray sm:text-base">
                {principle.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Why Clients Choose PK */}
      <Section>
        <SectionHeader title="Why Clients Choose PK" />
        <div className="grid gap-6 sm:grid-cols-2">
          {whyClientsChoose.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-border bg-card p-6"
            >
              <h3 className="mb-2 font-heading text-lg font-semibold text-charcoal">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-gray sm:text-base">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Founder Philosophy */}
      <Section variant="cream">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-2xl font-semibold leading-snug text-charcoal sm:text-3xl">
            &ldquo;Good financial organization starts with good
            information.&rdquo;
          </p>
          <p className="mt-6 text-base leading-relaxed text-muted-gray sm:text-lg">
            PK believes that organized records create clarity. Whether a client
            needs help cleaning up their books, preparing records for tax time,
            maintaining bookkeeping throughout the year, or organizing legitimate
            income documentation, the goal is the same: create a clearer, more
            organized starting point.
          </p>
        </div>
      </Section>

      {/* Documentation With Integrity */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeader title="Documentation With Integrity" align="left" />
          <div className="space-y-5 text-base leading-relaxed text-muted-gray sm:text-lg">
            <p>
              PK Business Services helps clients organize authentic income
              information and supporting financial documentation into clear,
              professional records. We work with the information provided by the
              client and focus on organization, consistency, and clarity.
            </p>
            <p className="rounded-lg border border-border bg-cream px-5 py-4 text-sm leading-relaxed text-charcoal sm:text-base">
              PK does not create, alter, fabricate, backdate, or misrepresent
              financial records or proof of income.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="section-padding bg-charcoal text-ivory">
        <div className="container-narrow text-center">
          <div className="gold-accent-line mx-auto mb-6" />
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to Get Organized?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ivory/75">
            If you&apos;re not sure where to start, tell us what you&apos;re
            dealing with. We&apos;ll help you determine which PK service may be
            the right fit.
          </p>
          <div className="mt-8">
            <Button
              render={<Link href={siteConfig.cta.href} />}
              className="h-12 min-h-11 bg-gold px-8 text-base text-charcoal hover:bg-gold-light"
            >
              {siteConfig.cta.label}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
