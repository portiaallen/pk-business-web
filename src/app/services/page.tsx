import Link from "next/link";
import { serviceSituations } from "@/content/service-discovery";
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
        eyebrow="Find your starting point"
        title="What needs attention? Let’s start there."
        subtitle="Four focused services for the records you have and the work you need. Explore the scope, starting prices, and who each service is for."
      />
      <Section className="!pb-0">
        <nav aria-label="Find a service" className="pk-service-index">
          {services.map((service, index) => (
            <Link key={service.id} href={`#${service.id}`}>
              <span className="pk-eyebrow">0{index + 1}</span>
              <span className="pk-heading mt-3 block text-lg">
                {service.shortName}
              </span>
              <span className="mt-2 block text-sm text-muted-gray">
                {serviceSituations[service.id]}
              </span>
              <span className="mt-4 block text-sm font-semibold">
                {service.price} <span aria-hidden="true">↓</span>
              </span>
            </Link>
          ))}
        </nav>
      </Section>
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
