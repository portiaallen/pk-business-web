export interface TaxService {
  id: string;
  number: string;
  name: string;
  priceLabel: string;
  price: string;
  situation: string;
  description: string;
  scope: string[];
}

// Approved pricing: PK Tax Pricing V1 (approved 2026-10-01, owner-confirmed 2026-10-13).
export const taxServices: TaxService[] = [
  {
    id: "tax-individual",
    number: "01",
    name: "Individual Tax Preparation",
    priceLabel: "Tiers from",
    price: "$199",
    situation: "You have a W-2 — and a life around it.",
    description:
      "A personal return prepared with care. Essential covers the standard filing; Family covers returns with dependents and credit questions.",
    scope: [
      "Essential tier — $199",
      "Family tier — $249 (dependents & credits)",
      "Additional state returns +$75 per state",
    ],
  },
  {
    id: "tax-self-employed",
    number: "02",
    name: "Self-Employed & 1099 Taxes",
    priceLabel: "Starting at",
    price: "$399",
    situation:
      "Freelancers, gig workers, creators, online sellers, independent contractors: income from everywhere, paperwork from nowhere.",
    description:
      "PK organizes the 1099s, the expenses, and the Schedule C, so the return reflects the real business.",
    scope: [
      "Schedule C expense organization",
      "1099-NEC / 1099-K income organized properly",
      "Additional Schedule C +$150 each",
    ],
  },
  {
    id: "tax-business",
    number: "03",
    name: "Business Tax Preparation",
    priceLabel: "Starting at",
    price: "$749",
    situation: "Your business needs its books and taxes to agree.",
    description:
      "Partnership and corporation returns prepared from books that hold up. The 1065 and 1120-S starting prices include up to two K-1s.",
    scope: [
      "Partnership (Form 1065) — from $749",
      "S Corporation (Form 1120-S) — from $799",
      "C Corporation (Form 1120) — from $799",
    ],
  },
  {
    id: "tax-catch-up",
    number: "04",
    name: "Prior-Year & Catch-Up Support",
    priceLabel: "Priced at",
    price: "the same tier as a current-year return",
    situation: "You're behind. Let's fix that, one year at a time.",
    description:
      "Missing a year — or a few? Bring the notices (unopened counts). PK helps identify what's actually missing, organize what exists, and work through filings in the right order.",
    scope: [
      "Missing-year inventory",
      "Record reconstruction from what exists",
      "E-file availability verified per year before filing",
      "Qualifying simple 1040s for 2023–2025 may qualify for the $99 Catch-Up 1040 Special — see above",
    ],
  },
];

export interface TaxAddOnGroup {
  group: string;
  items: { label: string; price: string }[];
}

export const taxAddOns: TaxAddOnGroup[] = [
  {
    group: "Individual returns",
    items: [
      { label: "Additional Schedule C", price: "+$150" },
      { label: "Schedule E / rental property", price: "+$125 per property" },
      { label: "Schedule D / investments", price: "Starting at $75" },
      { label: "Additional state return", price: "+$75 per state" },
      { label: "Amended return", price: "Starting at $175" },
      { label: "Prior-year return", price: "Same applicable tier" },
      { label: "Cryptocurrency", price: "Custom quote" },
    ],
  },
  {
    group: "Business returns",
    items: [
      { label: "Additional K-1", price: "+$75" },
      { label: "Standalone K-1", price: "Starting at $125" },
      { label: "Additional business state", price: "+$150 per state" },
      { label: "Business amendment", price: "$350" },
      { label: "First 1099", price: "$35" },
      { label: "Additional 1099s", price: "$15 each" },
      { label: "10 or more 1099s", price: "Custom quote" },
    ],
  },
];

export const taxPricingPolicy = [
  "No PK e-file fees on standard current-year tax preparation. (The Catch-Up 1040 Special carries a separate $35 federal e-file fee per eligible return.)",
  "No hidden markup fees.",
  "Upfront payment by default; an optional refund transfer is available on standard services, not on the Catch-Up 1040 Special.",
  "Bookkeeping is billed separately from tax work.",
];
