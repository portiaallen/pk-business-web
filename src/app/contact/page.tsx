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
        eyebrow="Let’s talk"
        title="Start wherever you are."
        subtitle="You don’t need perfect books or the right accounting words. Tell PK what’s going on, and we’ll help determine the next step."
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="pk-consultation-panel lg:col-span-3">
            <h2 className="pk-heading text-2xl">Request a consultation</h2>
            <p className="mb-8 mt-2 text-muted-gray">
              Fields marked * are required. Not sure which service fits? Choose
              “Not Sure / Help Me Choose.”
            </p>
            <ConsultationForm />
          </div>
          <div className="lg:col-span-2">
            <WhatHappensNext />
            <div className="mt-6 border-l-2 border-pink px-5 py-2">
              <h2 className="pk-heading text-xl">A conversation first.</h2>
              <p className="mt-3 leading-relaxed text-muted-gray">
                This form starts your inquiry. Keep sensitive financial
                information for the client portal when it’s time to provide
                documents.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
