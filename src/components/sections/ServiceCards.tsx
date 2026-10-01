import { siteConfig } from "@/content/site";
import { services } from "@/content/services";
import { ServiceCard } from "@/components/ServiceCard";
import { Section, SectionHeader } from "@/components/layout/Section";

export function ServiceCards() {
  return (
    <Section variant="cream">
      <SectionHeader
        title="The right support for what’s on your desk."
        subtitle="A cleanup, ongoing help, or a documentation project. Start with the situation you’re in."
        align="left"
      />
      <div className="grid gap-6 sm:grid-cols-2">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-gray">
        {siteConfig.pricingNote}
      </p>
    </Section>
  );
}
