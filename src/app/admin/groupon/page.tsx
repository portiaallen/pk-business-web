import { Section } from "@/components/layout/Section";
import { GrouponQueue } from "./GrouponQueue";

export const metadata = {
  title: "Groupon voucher verifications | PK Admin",
};

export default function AdminGrouponPage() {
  return (
    <Section className="!pt-10">
      <div className="mx-auto max-w-5xl">
        <span className="pk-eyebrow">Groupon pilot</span>
        <h1 className="pk-heading mt-2 text-3xl font-semibold tracking-tight">
          Voucher verification queue
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-gray">
          Verify each claim against the voucher&apos;s live status in Groupon
          Merchant Center (valid, not refunded, not expired) BEFORE approving.
          Mark the voucher redeemed in Groupon only after you approve it here.
        </p>
        <div className="mt-6">
          <GrouponQueue />
        </div>
      </div>
    </Section>
  );
}
