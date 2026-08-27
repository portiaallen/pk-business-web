import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { ServiceDetail } from "@/components/ServiceDetail";
import { CTASection } from "@/components/CTASection";
import { services } from "@/content/services";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: {
    absolute:
      "Bookkeeping & Financial Documentation Services | PK Business Services",
  },
  description:
    "QuickBooks cleanup, tax-ready bookkeeping, monthly support, and income verification documentation for small businesses and self-employed professionals.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        title="Services Designed to Keep You Organized"
        subtitle="Focused bookkeeping and documentation support — structured to help you understand what you need and what comes next."
      />
      <Section>
        <div className="space-y-0">
          {services.map((service) => (
            <ServiceDetail key={service.id} service={service} />
          ))}
        </div>
        <p className="mt-14 border-t border-border pt-8 text-sm leading-relaxed text-muted-gray">
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
