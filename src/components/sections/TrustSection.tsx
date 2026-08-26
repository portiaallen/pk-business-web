import { Section, SectionHeader } from "@/components/layout/Section";

const trustPoints = [
  {
    title: "Attention to Detail",
    description:
      "Careful review and organization of your financial records and documentation.",
  },
  {
    title: "Clear Communication",
    description:
      "Straightforward updates so you understand what needs attention and why.",
  },
  {
    title: "Client-Focused Service",
    description:
      "Support tailored to your situation, not a one-size-fits-all approach.",
  },
  {
    title: "Confidential Handling",
    description:
      "Your financial information is treated with discretion and respect.",
  },
  {
    title: "Practical Problem-Solving",
    description:
      "Focused solutions that help you move from scattered records to organized clarity.",
  },
  {
    title: "Organization",
    description:
      "Structured processes that turn complex paperwork into manageable records.",
  },
];

export function TrustSection() {
  return (
    <Section variant="cream">
      <SectionHeader
        title="Professional Support. Practical Solutions."
        subtitle="The qualities that guide how we work with every client."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {trustPoints.map((point) => (
          <div
            key={point.title}
            className="rounded-lg border border-border bg-background p-6"
          >
            <h3 className="mb-2 font-heading text-lg font-semibold text-charcoal">
              {point.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-gray">
              {point.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
