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
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
        <div>
          <p className="pk-eyebrow">Sound familiar?</p>
          <h2 className="pk-heading mt-4 text-3xl sm:text-4xl">
            You run the business.
            <br />
            <span className="pk-serif">
              Let’s handle the <em className="pk-ink-underline">paperwork.</em>
            </span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-gray">
            Scattered records and unfinished books can take up more space in
            your day than they should. Bring PK what’s going on. We’ll help you
            find a practical place to start.
          </p>
        </div>
        <div className="pk-notebook">
          <span className="pk-notebook-label">ON THE PK TO-DO LIST</span>
          <p className="pk-notebook-title">
            More clarity.
            <br />
            <span>Less stress.</span>
          </p>
          <ul>
            <li>Understand what needs attention</li>
            <li>Put your records in order</li>
            <li>Make the next step clear</li>
          </ul>
          <p className="pk-margin-note">One step at a time.</p>
        </div>
      </div>
      <div className="pk-situation-grid">
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
    </Section>
  );
}
