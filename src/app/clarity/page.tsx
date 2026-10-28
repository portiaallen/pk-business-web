import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { CTASection } from "@/components/CTASection";
import { ClarityProductDetail } from "./ClarityProductDetail";
import { clarityProducts, clarityFaqs } from "@/content/clarity";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: {
    absolute: "PK Business Clarity Collection | PK Business Services",
  },
  description:
    "Four focused clarity products from PK Business Services: the Business Money Blueprint, Receipt Rescue, and the Deduction Hunter editions. Clear scope, final pricing, one deliverable each.",
};

export default function ClarityPage() {
  return (
    <>
      <PageHero
        eyebrow="PK Business Clarity Collection"
        title="One topic. Clear scope. A deliverable you can use."
        subtitle="The Clarity Collection is four focused products for small-business owners and individuals: each one takes a single money-and-records topic, works it start to finish, and hands you a plain-language deliverable."
      />
      <Section className="!pb-0">
        <nav aria-label="Clarity Collection products" className="pk-service-index">
          {clarityProducts.map((product, index) => (
            <Link key={product.id} href={`#${product.id}`}>
              <span className="pk-eyebrow">0{index + 1}</span>
              <span className="pk-heading mt-3 block text-lg">{product.shortName}</span>
              <span className="mt-2 block text-sm text-muted-gray">{product.tagline}</span>
              <span className="mt-4 block text-sm font-semibold">{product.price}</span>
            </Link>
          ))}
        </nav>
      </Section>
      <Section>
        <div className="space-y-0">
          {clarityProducts.map((product) => (
            <ClarityProductDetail key={product.id} product={product} />
          ))}
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <h2 className="pk-heading text-2xl font-semibold text-charcoal sm:text-3xl">
            Clarity Collection questions
          </h2>
          <dl className="mt-8 space-y-8">
            {clarityFaqs.map((faq) => (
              <div key={faq.q}>
                <dt className="text-base font-semibold text-charcoal">{faq.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-gray">{faq.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm leading-relaxed text-muted-gray italic">
            {siteConfig.pricingNote}
          </p>
        </div>
      </Section>
      <CTASection
        title="Ready for a clearer picture?"
        description="Request a consultation and note the Clarity Collection product you are interested in. Checkout opens at public launch."
      />
    </>
  );
}
