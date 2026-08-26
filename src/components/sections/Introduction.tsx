import { Section, SectionHeader } from "@/components/layout/Section";

export function Introduction() {
  return (
    <Section>
      <SectionHeader
        title="Your business is busy. Your books shouldn't be."
        align="left"
      />
      <p className="max-w-3xl text-lg leading-relaxed text-muted-gray">
        Running a business generates enough paperwork without having to spend
        your time sorting through confusing transactions and scattered financial
        records. PK Business Services provides practical support to help you
        organize your records, maintain cleaner books, and approach important
        financial deadlines with greater clarity.
      </p>
    </Section>
  );
}
