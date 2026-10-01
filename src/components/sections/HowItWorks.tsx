import { Section, SectionHeader } from "@/components/layout/Section";

const steps = [
  {
    title: "Tell PK what’s going on",
    description:
      "Start with a consultation request. A brief overview is enough; no sensitive documents needed.",
  },
  {
    title: "Agree on the right support",
    description:
      "PK reviews your needs and helps determine the service and scope. Review your invoice and follow its payment terms.",
  },
  {
    title: "Put your records to work",
    description:
      "Provide the information and documents through your client portal. PK works with your authentic records and follows up on missing items.",
  },
  {
    title: "Receive the result",
    description:
      "Access your completed deliverables in the portal, with your records organized and the next step clearer.",
  },
];

export function HowItWorks() {
  return (
    <Section variant="cream">
      <SectionHeader
        title="A clear path from here."
        subtitle="Know what comes next, from the first conversation to the finished work."
        align="left"
      />
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="pk-step">
            <span className="pk-step-number">0{index + 1}</span>
            <h3 className="pk-heading mt-5 text-xl">{step.title}</h3>
            <p className="mt-3 leading-relaxed text-muted-gray">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
