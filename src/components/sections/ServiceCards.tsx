import { services } from "@/content/services";
import { ServiceCard } from "@/components/ServiceCard";
import { Section, SectionHeader } from "@/components/layout/Section";

export function ServiceCards() {
  return (
    <Section>
      <SectionHeader
        title="Services That Keep You Organized"
        subtitle="Focused support for bookkeeping, QuickBooks, and legitimate financial documentation."
      />
      <div className="grid gap-6 sm:grid-cols-2">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </Section>
  );
}
