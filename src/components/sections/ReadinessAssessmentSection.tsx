import Link from "next/link";
import { Section, SectionHeader } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";

const included = [
  "A focused review of your bookkeeping, business setup, and tax-season readiness.",
  "A written Readiness Report with prioritized findings and recommended actions.",
  "A $99 service credit toward one qualifying PK service. You have 14 days to claim it and six months to redeem it.",
];

export function ReadinessAssessmentSection() {
  return (
    <Section variant="charcoal">
      <SectionHeader
        light
        title="Start with the $99 Business Readiness Assessment."
        subtitle="PK’s front-door service: a one-time, fixed-price review that shows exactly where your books, business, and tax season stand, and what to fix first."
      />
      <ul className="mx-auto mb-10 max-w-2xl space-y-3 text-left text-base leading-relaxed text-ivory/85">
        {included.map((item) => (
          <li key={item} className="list-disc marker:text-ivory/60">
            {item}
          </li>
        ))}
      </ul>
      <div className="text-center">
        <p className="text-2xl font-semibold text-ivory">$99 USD, one time.</p>
        <p className="mt-2 text-sm text-ivory/70">
          Full terms are shown before you pay.
        </p>
        <div className="mt-8">
          <Button
            render={<Link href="/assessment" />}
            className="pk-primary-button h-12 px-8 text-base"
          >
            Start your $99 assessment
          </Button>
        </div>
      </div>
    </Section>
  );
}
