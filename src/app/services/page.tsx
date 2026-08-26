import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { ServiceDetail } from "@/components/ServiceDetail";
import { CTASection } from "@/components/CTASection";
import { services } from "@/content/services";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Bookkeeping cleanup, tax-ready bookkeeping, monthly support, and income verification documentation services for small businesses and self-employed professionals.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        title="Services Designed to Keep You Organized"
        subtitle="From bookkeeping cleanup to ongoing support and financial documentation, PK Business Services helps clients bring organization and clarity to the records that matter."
      />
      <Section>
        <div className="space-y-0">
          {services.map((service) => (
            <ServiceDetail key={service.id} service={service} />
          ))}
        </div>
        <p className="mt-12 rounded-lg border border-border bg-cream p-5 text-sm leading-relaxed text-muted-gray">
          {siteConfig.pricingNote}
        </p>
      </Section>
      <CTASection
        title="Not Sure Which Service Fits?"
        description="Request a consultation and we'll help determine the best next step for your situation."
      />
    </>
  );
}
