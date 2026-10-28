import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { GrouponClaimFlow } from "./GrouponClaimFlow";

export const metadata: Metadata = {
  title: {
    absolute: "Groupon Voucher Redemption | PK Business Services",
  },
  description:
    "Redeem your Groupon voucher for the PK Business Readiness Assessment. Enter your voucher code and our team verifies it before your assessment unlocks.",
};

export default function GrouponPage() {
  return (
    <>
      <Section className="!pt-12" id="top">
        <div className="mx-auto max-w-3xl">
          <span className="pk-eyebrow">Groupon voucher redemption</span>
          <h1 className="pk-heading mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Welcome, Groupon{" "}
            <span className="text-gold">buyers</span>.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-gray">
            You are one step away from the PK Business Readiness Assessment
            (&#36;99 value). Enter the redemption code from your Groupon
            voucher below, along with your name and email.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-gray">
            Every voucher is verified by our team before it is honored. Once
            your code checks out, we email you a private link to start your
            assessment. Your code can be used only once, so please do not
            share it.
          </p>
        </div>
      </Section>
      <Section variant="cream">
        <div className="mx-auto max-w-3xl">
          <GrouponClaimFlow />
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl text-sm text-muted-gray">
          Bought directly instead?{" "}
          <Link
            href="/readiness/start"
            className="font-semibold text-gold underline underline-offset-4"
          >
            Start the Business Readiness Assessment here
          </Link>
          .
        </div>
      </Section>
    </>
  );
}
