import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { CatchupIntakeFlow } from "./CatchupIntakeFlow";

export const metadata: Metadata = {
  title: {
    absolute: "Catch-Up 1040 Intake | PK Tax Division — PK Business Services",
  },
  description:
    "Start your Catch-Up 1040 intake with PK Business Services. Individual tax preparation for 2023, 2024, and 2025. Qualifying simple returns start at $99 per tax year.",
};

export default function CatchupIntakePage() {
  return (
    <>
      <Section className="!pt-12" id="top">
        <div className="mx-auto max-w-3xl">
          <span className="pk-eyebrow">Catch-Up 1040 Special</span>
          <h1 className="pk-heading mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Let&apos;s get you{" "}
            <span className="text-gold">caught up</span>.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-gray">
            Three quick steps. About five minutes. This request is for a quote,
            not an engagement, and no return is filed from it.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-gray">
            This form never asks for Social Security numbers, tax documents,
            or bank details. Those move through PK&apos;s secure client
            process after you become a client.
          </p>
        </div>
      </Section>
      <Section variant="cream">
        <div className="mx-auto max-w-3xl">
          <CatchupIntakeFlow />
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl text-sm text-muted-gray">
          Not ready yet?{" "}
          <Link
            href="/tax"
            className="font-semibold text-gold underline underline-offset-4"
          >
            Back to the Tax Division page
          </Link>
          .
        </div>
      </Section>
    </>
  );
}
