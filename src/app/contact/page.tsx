import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { ConsultationForm } from "@/components/forms/ConsultationForm";
import { WhatHappensNext } from "@/components/contact/WhatHappensNext";

export const metadata: Metadata = {
  title: {
    absolute: "Contact PK Business Services | Request a Consultation",
  },
  description:
    "Request a consultation with PK Business Services for bookkeeping, QuickBooks support, tax-ready bookkeeping, and income documentation services.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Let's Get Your Records Organized."
        subtitle="Tell us a little about what you need help with and we'll help determine the best next step."
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ConsultationForm />
          </div>
          <div className="lg:col-span-2">
            <WhatHappensNext />
          </div>
        </div>
      </Section>
    </>
  );
}
