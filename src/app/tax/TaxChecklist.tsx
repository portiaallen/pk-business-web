"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ChecklistTab = {
  id: string;
  label: string;
  intro: string;
  items: string[];
};

const tabs: ChecklistTab[] = [
  {
    id: "individual",
    label: "Individual / W-2",
    intro: "For a straightforward personal return.",
    items: [
      "W-2s from every employer",
      "Income records for side income that didn't get a 1099",
      "Records for deductible expenses you want to claim",
      "Bank & credit card statements",
      "Last year's return, if you filed one",
      "Records of estimated tax payments, if you made any",
      "Childcare & education records, if they apply",
      "Any letter or notice you received from the IRS or your state",
    ],
  },
  {
    id: "self-employed",
    label: "Freelancer / 1099",
    intro: "For income that arrived from everywhere.",
    items: [
      "Every 1099-NEC / 1099-K you received",
      "Income records for money that didn't get a 1099",
      "Business expense records — tracked or not, bring what's there",
      "Bank & credit card statements for business accounts",
      "Mileage log or vehicle records, if you drive for work",
      "Home-office details, if that applies to you",
      "Quarterly estimated payments you've already made",
      "Last year's return & Schedule C, if you filed one",
    ],
  },
  {
    id: "small-business",
    label: "Small Business",
    intro: "For a business return with books behind it.",
    items: [
      "Business bank & credit card statements for the full year",
      "Your bookkeeping file — QuickBooks or a spreadsheet, however rough",
      "Payroll records, if you have employees",
      "Records of owner draws, distributions & guaranteed payments",
      "Asset purchases (equipment, vehicles) with dates and amounts",
      "Loan statements & interest paid",
      "Prior-year business return",
      "Licenses, registrations, and any IRS or state notices",
    ],
  },
  {
    id: "catching-up",
    label: "Catching Up",
    intro: "For a missing year — or a few.",
    items: [
      "A list of which years you believe are missing (a guess is fine)",
      "Any notices or letters — unopened is fine",
      "Whatever records still exist for each year",
      "Bank & credit card statements (banks can usually resend past ones)",
      "Prior returns you do have, for anything",
      "A short note on what changed those years (jobs, business, moves)",
      "Patience — one year at a time, in the right order",
    ],
  },
];

export function TaxChecklist() {
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  async function copyChecklist() {
    const text = `PK Tax Division — ${current.label} document checklist\n\n${current.items
      .map((item) => `- ${item}`)
      .join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div>
        <div
          role="tablist"
          aria-label="Choose your situation"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active === tab.id
                  ? "bg-charcoal text-ivory"
                  : "bg-cream text-charcoal hover:bg-gold-light/40",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted-gray">{current.intro}</p>
        <ul className="mt-4 space-y-2">
          {current.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-lg bg-cream px-4 py-3 text-sm"
            >
              <span aria-hidden="true" className="mt-0.5 text-gold">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit rounded-2xl border border-gold-light/60 bg-cream p-6">
        <p className="pk-heading text-lg font-semibold">
          Bring what you have.
        </p>
        <p className="mt-2 text-sm text-muted-gray">
          &ldquo;Perfect records&rdquo; is not the admission price. PK works
          with what exists and helps you rebuild the rest.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyChecklist}
            className="rounded-lg border border-charcoal px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-ivory"
          >
            {copied ? "Copied ✓" : "Copy my checklist"}
          </button>
          <Link
            href="#start"
            className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-ivory transition-colors hover:bg-gold"
          >
            Bring it to PK
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-gray">
          Please don&apos;t send Social Security numbers, ITINs, ID photos, or
          tax documents through any web page. Once you&apos;re a PK client,
          sensitive documents move through a secure client portal — never email
          or this site.
        </p>
      </aside>
    </div>
  );
}
