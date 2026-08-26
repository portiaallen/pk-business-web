import { services } from "@/content/services";
import { ServiceCard } from "@/components/ServiceCard";
import { Section, SectionHeader } from "@/components/layout/Section";

export function ServiceCards() {
  return (
    <Section variant="cream">
      <SectionHeader
        title="Services to Keep You Organized"
        subtitle="Practical bookkeeping and documentation support tailored to your needs."
      />
      <div className="grid gap-6 sm:grid-cols-2">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </Section>
  );
}
