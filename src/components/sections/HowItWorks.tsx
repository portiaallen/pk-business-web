import { Section, SectionHeader } from "@/components/layout/Section";

const steps = [
  {
    number: "01",
    title: "Tell Us What You Need",
    description:
      "Submit a consultation request and briefly describe what you're trying to accomplish.",
  },
  {
    number: "02",
    title: "We Review Your Situation",
    description: "We'll determine which service best fits your needs.",
  },
  {
    number: "03",
    title: "We Organize Your Records",
    description:
      "We work with the authentic information and documentation you provide.",
  },
  {
    number: "04",
    title: "Move Forward With Clarity",
    description:
      "You receive organized records and a clearer path forward.",
  },
];

export function HowItWorks() {
  return (
    <Section variant="cream">
      <SectionHeader
        title="How It Works"
        subtitle="A straightforward process to help you get organized."
      />
      <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step.number}>
            <span className="mb-4 block font-heading text-3xl font-light text-gold">
              {step.number}
            </span>
            <h3 className="mb-2 font-heading text-lg font-semibold text-charcoal">
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-gray">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
