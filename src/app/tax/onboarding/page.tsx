import type { Metadata } from "next";
import { Section } from "@/components/layout/Section";
import { TaxOnboardingFlow } from "./TaxOnboardingFlow";

export const metadata: Metadata = {
  title: {
    absolute: "Start Your Tax Intake | PK Tax Division — PK Business Services",
  },
  description:
    "PK's plain-language tax intake. Answer a few screening questions to see what PK needs from you. Sensitive identity and bank information is never collected here — it moves through PK's secure client process after you become a client.",
};

export default function TaxOnboardingPage() {
  return (
    <Section className="!pt-12" id="tax-intake">
      <div className="mx-auto max-w-3xl">
        <span className="pk-eyebrow">PK Tax Division</span>
        <h1 className="pk-heading mt-4 text-3xl font-bold sm:text-4xl">
          Start your tax intake
        </h1>
        <p className="mt-4 text-charcoal/80">
          A few plain-language questions so PK can see what your situation needs
          before you ever send a document. Nothing here collects Social Security
          numbers, ITINs, IP PINs, or bank details — those move through PK&apos;s
          secure client process after you become a client, never through this
          page.
        </p>
        <div className="mt-8">
          <TaxOnboardingFlow />
        </div>
      </div>
    </Section>
  );
}
