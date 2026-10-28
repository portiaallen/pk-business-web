export type ClarityProductId =
  | "business-money-blueprint"
  | "receipt-rescue"
  | "deduction-hunter-business"
  | "deduction-hunter-personal";

export interface ClarityProduct {
  id: ClarityProductId;
  name: string;
  shortName: string;
  tagline: string;
  headline: string;
  price: string;
  shortDescription: string;
  description: string;
  scope: string[];
  bestFor: string[];
  perProductNote?: string;
  href: string;
}

export interface ClarityFaq {
  q: string;
  a: string;
}

// PK Business Clarity Collection — approved final direct prices (founder-approved
// final, 2026-10-23). These prices are displayed exactly as approved. They are
// never presented as historical comparison prices or as Groupon discounts, and
// the proposed Groupon tier prices remain separate and unapproved.
export const clarityProducts: ClarityProduct[] = [
  {
    id: "business-money-blueprint",
    name: "Business Money Blueprint",
    shortName: "Business Money Blueprint",
    tagline: "Know where your business money stands",
    headline: "A clear working picture of the money coming in, the money going out, and what it is telling you.",
    price: "$149",
    shortDescription:
      "PK organizes your business money picture: money in, money out, recurring commitments, and a plain-language summary report with prioritized next steps.",
    description:
      "If you cannot say, in one breath, where your business money stands, the Business Money Blueprint is the starting point. PK reviews how money moves through your business, organizes money-in and money-out into a clear picture, maps your recurring commitments, and hands you a plain-language summary report with prioritized next steps you can act on or bring straight to a consultation.",
    scope: [
      "Money-in organization review",
      "Money-out and recurring-commitment mapping",
      "Bank and payment activity organization, where records allow",
      "A plain-language summary report of your money picture",
      "Prioritized next steps, in writing",
      "A discussion-ready starting point for any PK service",
    ],
    bestFor: [
      "Business owners who cannot quickly answer: what comes in, what goes out, and what is left.",
      "Newer businesses that want their money picture organized before problems pile up.",
      "Anyone preparing for a consultation, loan conversation, or tax season who wants a clean summary in hand.",
    ],
    href: "/clarity/business-money-blueprint",
  },
  {
    id: "receipt-rescue",
    name: "Receipt Rescue",
    shortName: "Receipt Rescue",
    tagline: "Turn loose receipts into organized records",
    headline: "Receipts, invoices, and loose records sorted, categorized, and flagged for what is missing.",
    price: "$149",
    shortDescription:
      "PK organizes your receipts and loose documentation into categorized, statement-matched, handoff-ready records, and tells you plainly what is missing.",
    description:
      "Shoebox, folder, phone camera roll, or inbox: receipts pile up until they feel unusable. Receipt Rescue takes your existing receipts and loose records, organizes them into sensible expense categories, matches them to statements where the records allow, and flags the gaps. You finish with an organized receipt summary that is ready to hand to a tax professional instead of another year of scrambling.",
    scope: [
      "Receipt and loose-record intake organization",
      "Categorization into sensible expense buckets",
      "Matching to bank or card statements where records allow",
      "Flagging missing documentation, item by item",
      "An organized receipt summary as your deliverable",
      "A records set ready for tax-time handoff",
    ],
    bestFor: [
      "Owners with a shoebox, drawer, or inbox full of unsorted receipts.",
      "Businesses that scramble every year when a tax professional asks for documentation.",
      "Anyone who wants to know exactly which receipts and records are missing before tax season.",
    ],
    perProductNote:
      "PK works only with authentic, client-provided records. Receipt Rescue organizes what you provide; it does not create, alter, or reconstruct documentation.",
    href: "/clarity/receipt-rescue",
  },
  {
    id: "deduction-hunter-business",
    name: "Deduction Hunter — Business Edition",
    shortName: "Deduction Hunter Business",
    tagline: "A guided review of business deduction opportunities",
    headline: "A documentation-first review of deduction categories your business may qualify for, delivered as a discussion-ready list.",
    price: "$129",
    shortDescription:
      "PK reviews your business records for deduction categories worth discussing with your tax professional, and documents what each one would need.",
    description:
      "Business owners routinely leave deduction categories unexamined, not because the deductions are exotic, but because nobody ever sat down with their records and went category by category. Deduction Hunter, Business Edition is that sit-down. PK reviews your business records against common deduction categories for your type of business, builds a checklist of candidates worth discussing, and documents exactly what each candidate would need in support. The deliverable is a discussion-ready list you take to your tax professional.",
    scope: [
      "Category-by-category review of common business deductions",
      "A checklist of candidates matched to your records",
      "Documentation requirements documented for each candidate",
      "Flagging of categories that do not apply, with the reason",
      "An organized, discussion-ready candidate list",
      "Plain-language notes on record-keeping for next year",
    ],
    bestFor: [
      "Self-employed professionals and small-business owners with organized or semi-organized records.",
      "Businesses preparing for a tax appointment that want a focused, documented list to bring.",
      "Owners who suspect they are missing deduction categories but do not know which ones apply.",
    ],
    perProductNote:
      "Deduction Hunter is a review and documentation product. PK does not determine your final tax position; final deduction decisions rest with your tax professional.",
    href: "/clarity/deduction-hunter-business",
  },
  {
    id: "deduction-hunter-personal",
    name: "Deduction Hunter — Personal Edition",
    shortName: "Deduction Hunter Personal",
    tagline: "A guided review of personal deduction opportunities",
    headline: "The same documentation-first review, built for personal returns.",
    price: "$119",
    shortDescription:
      "PK reviews your personal records against common individual deduction and credit categories, and documents what each one would need.",
    description:
      "Personal returns leave the same categories unexamined as business ones: education costs, charitable contributions, medical expenses, and the record-keeping that decides whether a claim holds up. Deduction Hunter, Personal Edition reviews your personal records against the common individual categories, builds a checklist of candidates worth discussing, and documents what each one would need. The deliverable is a discussion-ready list for your tax appointment.",
    scope: [
      "Category-by-category review of common individual deductions",
      "A checklist of candidates matched to your records",
      "Documentation requirements documented for each candidate",
      "Flagging of categories that do not apply, with the reason",
      "An organized, discussion-ready candidate list",
      "Plain-language notes on record-keeping for next year",
    ],
    bestFor: [
      "Individuals who want their records reviewed before a tax appointment.",
      "Taxpayers with a year of life changes — education, medical, charitable giving — who are unsure what their records support.",
      "Anyone who wants next year's record-keeping set up right, starting now.",
    ],
    perProductNote:
      "Deduction Hunter is a review and documentation product. PK does not determine your final tax position; final deduction decisions rest with your tax professional.",
    href: "/clarity/deduction-hunter-personal",
  },
];

export const clarityFaqs: ClarityFaq[] = [
  {
    q: "How is a Clarity Collection product different from the $99 Readiness Assessment?",
    a: "The $99 Business & Tax Season Readiness Assessment is a broad review of your overall books and setup, and its service credit applies to qualifying PK services. A Clarity Collection product is a focused single-topic work session with its own deliverable. Many clients start with the assessment; some come straight to a Clarity product. Neither requires the other.",
  },
  {
    q: "Do I need to be an existing PK client?",
    a: "No. Every Clarity Collection product stands on its own.",
  },
  {
    q: "What do I actually receive?",
    a: "A plain-language deliverable for the product you chose: an organized summary report, a categorized receipt summary, or a documented discussion-ready candidate list, depending on the product.",
  },
  {
    q: "What information will PK need from me?",
    a: "To start: your name, email, and a plain-language description of your situation. Never send Social Security numbers, ITINs, ID photos, or tax documents through this website. Sensitive information moves through PK's secure client process after you become a client.",
  },
  {
    q: "Are the prices final?",
    a: "Yes. The four Clarity Collection prices are final: Business Money Blueprint $149, Receipt Rescue $149, Deduction Hunter Business Edition $129, and Deduction Hunter Personal Edition $119. Each product is one focused engagement at one price, with its deliverable included.",
  },
  {
    q: "When can I purchase?",
    a: "The Clarity Collection is in final launch preparation. Checkout opens at public launch; until then, request a consultation and PK will note the product you are interested in.",
  },
];
