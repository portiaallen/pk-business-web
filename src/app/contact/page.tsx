import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { ConsultationForm } from "@/components/forms/ConsultationForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Request a consultation with PK Business Services for bookkeeping, QuickBooks support, and financial documentation services.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Let's Get Your Records Organized."
        subtitle="Tell us a little about what you need help with and we'll help determine the best next step."
      />
      <Section>
        <div className="mx-auto max-w-2xl">
          <ConsultationForm />
          <p className="mt-8 text-sm leading-relaxed text-muted-gray">
            Please do not submit Social Security numbers, bank account numbers,
            passwords, or other highly sensitive financial information through
            this initial form.
          </p>
        </div>
      </Section>
    </>
  );
}
