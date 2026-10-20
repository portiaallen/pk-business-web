import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Section } from "@/components/layout/Section";
import { ConsultationForm } from "@/components/forms/ConsultationForm";
import { services } from "@/content/services";
import { siteConfig as config } from "@/content/site";
import {
  taxServices,
  taxAddOns,
  taxPricingPolicy,
} from "@/content/tax-services";
import { TaxGutCheck } from "./TaxGutCheck";
import { TaxChecklist } from "./TaxChecklist";
import { CatchUpSpecial } from "./CatchUpSpecial";

export const metadata: Metadata = {
  title: {
    absolute: "PK Tax Division | PK Business Services — People | Knowledge | Results",
  },
  description:
    "Tax preparation for individuals, the self-employed, and small businesses — with PK's practical, no-judgment approach. Messy books? Behind a year? We can work with that.",
};

const heroChips = ["Zero judgment", "Clear next steps", "Upfront pricing"];

const toDoItems = [
  "Understand what needs attention — before a deadline does",
  "Put your records in order, in the right order",
  "File on numbers you can actually stand behind",
  "Make next year easier than this year was",
];

const faqs = [
  {
    q: "Is the Tax Division a separate company from PK Business Services?",
    a: "No. The Tax Division is PK Business Services — same company, same founder, same professional-with-personality standard. Tax preparation now sits alongside the bookkeeping and documentation work PK has done since 2012.",
  },
  {
    q: "Is the $99 Assessment the same as tax preparation?",
    a: "No. The $99 Business Readiness Assessment is a separate, optional review of your books and setup. It is never required to start tax preparation.",
  },
  {
    q: "My books are a mess. Can you still do my taxes?",
    a: "Usually, yes. Messy books are PK's whole origin story. Depending on their condition, PK may recommend cleanup or tax-ready bookkeeping first, so the return stands on numbers that hold up.",
  },
  {
    q: "What if I'm behind a year — or more?",
    a: "That is exactly what Prior-Year & Catch-Up Support is for. Bring the notices (unopened counts). PK helps identify what's missing, organize what exists, and go one year at a time, in the right order.",
  },
  {
    q: "Does the $99 credit apply to tax preparation?",
    a: "The assessment's service credit applies to one qualifying PK service, and tax preparation qualifies. Full terms are on the assessment page.",
  },
  {
    q: "What information will PK need from me?",
    a: "To start: your name, email, and a plain-language description of what's on your desk. Never send Social Security numbers, ITINs, ID photos, or tax documents through this page — sensitive information moves through PK's secure client process after you become a client.",
  },
  {
    q: "Can PK guarantee my refund or tax outcome?",
    a: "No, and you should be wary of anyone who does. What PK guarantees is careful work on numbers you can actually stand behind.",
  },
  {
    q: "I already have a tax professional. Can PK still help?",
    a: "Yes. Tax-Ready Bookkeeping and QuickBooks Cleanup are built for exactly that: getting your records organized for the professional who files your return.",
  },
];

export default function TaxDivisionPage() {
  return (
    <>
      {/* Hero */}
      <Section className="!pt-12" id="top">
        <div className="flex flex-wrap items-center gap-3">
          <span className="pk-eyebrow">Professional with personality</span>
          <span className="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ivory">
            New · PK Tax Division
          </span>
        </div>
        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h1 className="pk-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your business is busy. Your{" "}
              <span className="text-gold">taxes</span> shouldn&apos;t be{" "}
              <em className="text-pink">a mystery.</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-gray">
              Messy books? Behind a year? We can work with that. The PK Tax
              Division brings PK&apos;s practical, no-judgment approach to tax
              preparation for small businesses, self-employed professionals,
              and individuals.
            </p>
            <p className="mt-3 font-serif text-lg italic text-charcoal">
              No judgment. Just a practical place to start — now with filing.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#start"
                className="rounded-lg bg-charcoal px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold"
              >
                Request a Tax Consultation →
              </Link>
              <Link
                href="#services"
                className="rounded-lg border border-charcoal px-6 py-3 text-sm font-semibold text-charcoal transition-colors hover:bg-cream"
              >
                Explore Tax Services →
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-gray">
              {heroChips.map((chip) => (
                <li key={chip} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-gold">
                    ✓
                  </span>
                  {chip}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden="true"
              className="absolute -inset-2 rounded-3xl bg-gold-light/40"
            />
            <div className="relative overflow-hidden rounded-3xl border border-gold-light/60">
              <Image
                src="/images/pk-founder-workspace.jpg"
                alt="Portia Allen, founder of PK Business Services, at her desk"
                width={640}
                height={480}
                className="h-auto w-full object-cover"
                priority
              />
              <span className="absolute left-4 top-4 rounded-lg bg-charcoal px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ivory">
                Now filing · Taxes, the PK way.
              </span>
            </div>
            <div className="relative mt-3 flex items-center justify-between rounded-2xl bg-charcoal px-5 py-3 text-ivory">
              <div>
                <p className="text-sm font-semibold">Portia Allen</p>
                <p className="text-xs text-ivory/70">
                  Founder, PK Business Services · Tax Division
                </p>
              </div>
              <p className="text-xs font-semibold text-gold-light">
                Real help. Real human.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Catch-Up 1040 Special — founder-approved 2026-10-19 */}
      <CatchUpSpecial />

      {/* Intro / founder voice */}
      <Section variant="cream" id="founder">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="pk-eyebrow">Sound familiar?</p>
            <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              You run the business. Let&apos;s handle the{" "}
              <em className="text-pink">tax paperwork.</em>
            </h2>
            <p className="mt-5 leading-relaxed text-muted-gray">
              Most people don&apos;t avoid their taxes because they&apos;re
              careless. They avoid them because they&apos;re busy running the
              thing that makes the money.
            </p>
            <p className="mt-4 leading-relaxed text-muted-gray">
              <strong>No lecture. No side-eye.</strong> And definitely no{" "}
              <em>&ldquo;you should&apos;ve called me sooner.&rdquo;</em>
            </p>
            <Link
              href="/about"
              className="mt-6 inline-block text-sm font-semibold text-gold underline underline-offset-4"
            >
              Meet the person behind PK →
            </Link>
          </div>
          <div>
            <p className="pk-eyebrow">On the PK to-do list</p>
            <p className="pk-heading mt-2 text-2xl font-semibold">
              More clarity. Less tax-season dread.
            </p>
            <ul className="mt-5 space-y-3">
              {toDoItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span aria-hidden="true" className="mt-0.5 text-gold">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-serif italic text-charcoal">
              One step at a time. — P.
            </p>
          </div>
        </div>
      </Section>

      {/* Gut check */}
      <Section id="gut-check">
        <div className="max-w-3xl">
          <p className="pk-eyebrow">60-second gut check</p>
          <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tap anything that <em className="text-pink">sounds like you.</em>
          </h2>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-cream p-6 sm:p-8">
          <TaxGutCheck />
        </div>
      </Section>

      {/* Optional assessment — subordinate, single mention */}
      <Section variant="cream">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-light/60 bg-cream px-6 py-5">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-gray">
            <span className="font-semibold text-charcoal">
              Optional, not required:
            </span>{" "}
            PK also offers a separate $99 Business Readiness Assessment — a
            fixed-price review of your books and setup. It is never required to
            start tax preparation.
          </p>
          <Link
            href="/assessment"
            className="text-sm font-semibold text-gold underline underline-offset-4"
          >
            See the assessment →
          </Link>
        </div>
      </Section>

      {/* Tax services */}
      <Section id="services">
        <div className="max-w-3xl">
          <p className="pk-eyebrow">PK Tax Division · Tax services</p>
          <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            The right support for what&apos;s{" "}
            <em className="text-pink">on your desk.</em>
          </h2>
          <p className="mt-4 leading-relaxed text-muted-gray">
            A return to file, a year to catch up, or records to organize first.
            One company, one brand — now with a Tax Division built for it.
          </p>
          <Link
            href="#checklist"
            className="mt-4 inline-block text-sm font-semibold text-gold underline underline-offset-4"
          >
            Not sure? Check your document list →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {taxServices.map((service) => (
            <article
              key={service.id}
              className="flex flex-col rounded-2xl border border-border bg-cream p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="pk-heading text-2xl font-semibold text-gold">
                  {service.number}
                </span>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-gray">
                    {service.priceLabel}
                  </p>
                  <p className="text-sm font-semibold text-charcoal">
                    {service.price}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-gray">{service.situation}</p>
              <h3 className="pk-heading mt-2 text-xl font-semibold">
                {service.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-gray">
                {service.description}
              </p>
              <ul className="mt-4 space-y-2">
                {service.scope.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span aria-hidden="true" className="mt-0.5 text-gold">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="#start"
                className="mt-auto pt-5 text-sm font-semibold text-gold underline underline-offset-4"
              >
                Request this service →
              </Link>
            </article>
          ))}
        </div>

        {/* Existing PK bookkeeping services, cross-linked */}
        <div className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="pk-eyebrow">
              Already a PK strength — now pointed at tax season
            </p>
            <Link
              href="/services"
              className="text-sm font-semibold text-gold underline underline-offset-4"
            >
              All PK services →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {services
              .filter((service) => service.id !== "income-verification")
              .map((service) => (
                <Link
                  key={service.id}
                  href={service.href}
                  className="rounded-xl border border-border bg-cream p-5 transition-colors hover:border-gold"
                >
                  <p className="font-semibold text-charcoal">{service.name}</p>
                  <p className="mt-1 text-sm font-semibold text-gold">
                    {service.price}
                  </p>
                  <p className="mt-2 text-sm text-muted-gray">
                    {service.shortDescription}
                  </p>
                </Link>
              ))}
          </div>
          <p className="mt-4 text-xs text-muted-gray">
            {config.pricingNote}
          </p>
        </div>
      </Section>

      {/* Approved pricing details — PK Tax Pricing V1 */}
      <Section variant="cream" id="pricing">
        <div className="max-w-3xl">
          <p className="pk-eyebrow">Straight answers</p>
          <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Prices, up <em className="text-pink">front.</em>
          </h2>
          <p className="mt-4 leading-relaxed text-muted-gray">
            These are PK&apos;s approved tax prices, published as they are.
            Scope work (extra years, reconstruction, special filings) is
            agreed with you before it begins — never buried in a fee.
          </p>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {taxAddOns.map((group) => (
            <div
              key={group.group}
              className="rounded-2xl border border-border bg-ivory p-6"
            >
              <h3 className="pk-heading text-lg font-semibold">
                {group.group}
              </h3>
              <ul className="mt-4 divide-y divide-border">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-baseline justify-between gap-4 py-2 text-sm"
                  >
                    <span className="text-muted-gray">{item.label}</span>
                    <span className="whitespace-nowrap font-semibold text-charcoal">
                      {item.price}
                    </span>
                  </li>
                ))}
              </ul>
              {group.group === "Business returns" && (
                <p className="mt-3 text-xs text-muted-gray">
                  Form 1065 and 1120-S starting prices include up to two
                  K-1s.
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-gray">
          Qualifying simple individual returns for tax years 2023–2025 may
          qualify for the Catch-Up 1040 Special pricing shown at the top of
          this page.
        </p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-gold-light/60 bg-cream px-6 py-5">
          {taxPricingPolicy.map((line) => (
            <p
              key={line}
              className="flex items-center gap-2 text-sm font-medium text-charcoal"
            >
              <span aria-hidden="true" className="text-gold">
                ✓
              </span>
              {line}
            </p>
          ))}
        </div>
      </Section>

      {/* Document checklist */}
      <Section variant="cream" id="checklist">
        <div className="max-w-3xl">
          <p className="pk-eyebrow">Document checklist</p>
          <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Bring the right papers, <em className="text-pink">not all of them.</em>
          </h2>
          <p className="mt-4 leading-relaxed text-muted-gray">
            Pick your situation and PK gives you a focused checklist — copy it,
            gather at your own pace, then bring it to a consultation.
          </p>
        </div>
        <div className="mt-8">
          <TaxChecklist />
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="pk-eyebrow">Questions</p>
            <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Asked before <em className="text-pink">you asked.</em>
            </h2>
            <Link
              href="/about"
              className="mt-5 inline-block text-sm font-semibold text-gold underline underline-offset-4"
            >
              Meet the person behind PK →
            </Link>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-cream">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-charcoal marker:hidden">
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="float-right text-gold transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-gray">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* Consultation form — real intake */}
      <Section variant="charcoal" id="start">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="pk-eyebrow">Start here</p>
            <h2 className="pk-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tell PK what&apos;s <em className="text-gold-light">going on.</em>
            </h2>
            <p className="mt-4 text-ivory/75">
              A short, non-sensitive note is all it takes. No judgment on the
              state of your desk.
            </p>
            <p className="mt-4 text-sm text-ivory/60">
              Please don&apos;t include Social Security numbers, ITINs, ID
              photos, or tax documents here. Sensitive information moves through
              PK&apos;s secure client process after you become a client.
            </p>
            <p className="mt-6 text-xs text-ivory/50">{config.disclaimer}</p>
          </div>
          <div className="rounded-2xl bg-cream p-6 text-charcoal sm:p-8">
            <ConsultationForm />
          </div>
        </div>
      </Section>
    </>
  );
}
