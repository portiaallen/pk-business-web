import Link from "next/link";
import { Section } from "@/components/layout/Section";

const situations = [
  {
    title: "“My QuickBooks needs a reset.”",
    text: "Catch up on existing records and identify what needs attention.",
    href: "/services#quickbooks-cleanup",
  },
  {
    title: "“I can’t keep falling behind.”",
    text: "Build ongoing bookkeeping support into your business routine.",
    href: "/services#monthly-bookkeeping",
  },
  {
    title: "“I need these records to make sense.”",
    text: "Organize financial information for tax-time handoff or income documentation.",
    href: "/services",
  },
];

export function Introduction() {
  return (
    <Section className="pk-introduction">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="pk-eyebrow">Sound familiar?</p>
          <h2 className="pk-heading mt-4 text-3xl sm:text-4xl">
            You’re running a business.
            <br />
            <span className="pk-serif">The paperwork is running behind.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-gray">
            Scattered records and unfinished books can take up more space in
            your day than they should. Bring PK what’s going on. We’ll help you
            find a practical place to start.
          </p>
        </div>
        <div className="divide-y divide-border">
          {situations.map((item) => (
            <Link key={item.title} href={item.href} className="pk-situation">
              <div>
                <h3 className="pk-heading text-xl">{item.title}</h3>
                <p className="mt-2 text-muted-gray">{item.text}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </div>
    </Section>
  );
}
