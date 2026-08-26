import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { Section, SectionHeader } from "@/components/layout/Section";
import { CTASection } from "@/components/CTASection";
import { siteConfig } from "@/content/site";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description:
    "PK Business Services is a client-focused business-services company dedicated to helping individuals and small businesses organize their financial records, bookkeeping, and documentation.",
};

const principles = [
  {
    title: "Clarity",
    description: "Helping clients understand what needs attention.",
  },
  {
    title: "Organization",
    description: "Turning scattered information into organized records.",
  },
  {
    title: "Integrity",
    description:
      "Working only with authentic information and legitimate documentation.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="About PK Business Services"
        subtitle="A client-focused business-services company dedicated to helping individuals and small businesses organize their financial records, bookkeeping, and documentation."
      />
      <Section>
        <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-muted-gray">
          <p>
            PK Business Services provides professional support for small-business
            owners, self-employed professionals, independent contractors,
            entrepreneurs, and individuals who need help organizing their
            financial records and documentation.
          </p>
          <p>
            We believe that well-organized records are the foundation of a
            stronger business. Our approach emphasizes professionalism,
            accuracy, clear communication, and practical support — always
            with respect for client confidentiality.
          </p>
          <p>
            Whether you need a QuickBooks cleanup, tax-ready bookkeeping,
            ongoing monthly support, or help organizing legitimate income
            documentation, we work with the authentic information you provide
            to help you move forward with greater clarity.
          </p>
        </div>
      </Section>

      <Section variant="cream">
        <SectionHeader title="Why PK?" />
        <div className="grid gap-8 md:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle.title} className="text-center md:text-left">
              <h3 className="mb-3 font-heading text-2xl font-semibold text-charcoal">
                {principle.title}
              </h3>
              <p className="text-muted-gray">{principle.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-charcoal">
            Let&apos;s Work Together
          </h2>
          <p className="mt-4 text-lg text-muted-gray">
            Ready to bring organization to your financial records? We&apos;d
            like to hear about your situation.
          </p>
          <Button
            render={<Link href={siteConfig.cta.href} />}
            className="mt-8 h-12 bg-charcoal px-8 text-ivory hover:bg-charcoal/90"
          >
            {siteConfig.cta.label}
          </Button>
        </div>
      </Section>

      <CTASection
        title="Ready to Get Your Records in Order?"
        description="Request a consultation to discuss your bookkeeping, QuickBooks, or documentation needs."
      />
    </>
  );
}
