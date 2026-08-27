import { pkPrinciples } from "@/content/principles";
import { Section, SectionHeader } from "@/components/layout/Section";

export function WhyPKSection() {
  return (
    <Section variant="cream">
      <SectionHeader title="Why PK Business Services?" />
      <div className="grid gap-10 md:grid-cols-3">
        {pkPrinciples.map((principle) => (
          <div
            key={principle.title}
            className="border-t-2 border-gold/40 pt-6"
          >
            <h3 className="mb-3 font-heading text-xl font-semibold uppercase tracking-wide text-charcoal">
              {principle.title}
            </h3>
            <p className="leading-relaxed text-muted-gray">
              {principle.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
