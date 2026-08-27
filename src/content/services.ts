export type ServiceId =
  | "quickbooks-cleanup"
  | "tax-ready-bookkeeping"
  | "monthly-bookkeeping"
  | "income-verification";

export interface Service {
  id: ServiceId;
  name: string;
  shortName: string;
  headline: string;
  price: string;
  shortDescription: string;
  description: string;
  scope: string[];
  bestFor: string[];
  scopeNote?: string;
  href: string;
}

export const services: Service[] = [
  {
    id: "quickbooks-cleanup",
    name: "QuickBooks Cleanup",
    shortName: "QuickBooks Cleanup",
    headline: "A cleaner starting point for your books.",
    price: "Starting at $250",
    shortDescription:
      "Behind on your books? PK helps organize existing QuickBooks records, review transaction categorization, identify items requiring clarification, and create a cleaner starting point.",
    description:
      "If your QuickBooks file has fallen behind or become difficult to manage, PK can help organize existing records and identify areas requiring attention.",
    scope: [
      "Transaction organization",
      "Categorization review",
      "Identification of items requiring client clarification",
      "Bookkeeping organization",
      "Review of outstanding cleanup needs",
      "Preparation for ongoing bookkeeping",
    ],
    bestFor: [
      "Business owners who need a defined bookkeeping cleanup project.",
    ],
    href: "/services#quickbooks-cleanup",
  },
  {
    id: "tax-ready-bookkeeping",
    name: "Tax-Ready Bookkeeping",
    shortName: "Tax-Ready Bookkeeping",
    headline: "Get organized before tax time.",
    price: "Starting at $400",
    shortDescription:
      "Get your business records organized before providing them to your tax professional. PK helps bring structure to existing bookkeeping records and supporting documentation.",
    description:
      "PK helps business owners organize existing bookkeeping records and supporting documentation before providing them to their tax professional.",
    scope: [
      "Transaction organization",
      "Categorization",
      "Reconciliation support where appropriate",
      "Identifying missing information",
      "Organizing supporting documentation",
      "Preparing records for tax-time handoff",
    ],
    bestFor: [
      "Business owners who want to approach tax preparation with cleaner, more organized records.",
    ],
    href: "/services#tax-ready-bookkeeping",
  },
  {
    id: "monthly-bookkeeping",
    name: "Monthly Bookkeeping Support",
    shortName: "Monthly Bookkeeping Support",
    headline: "Stay organized throughout the year.",
    price: "Starting at $300/month",
    shortDescription:
      "Ongoing bookkeeping support designed to help small-business owners maintain organized records and avoid falling behind.",
    description:
      "Ongoing bookkeeping support designed to help small-business owners maintain organized financial records instead of repeatedly falling behind.",
    scope: [
      "Monthly transaction categorization",
      "Bookkeeping maintenance",
      "Reconciliation support",
      "Review of outstanding bookkeeping items",
      "Client communication regarding missing information",
    ],
    scopeNote:
      "Monthly pricing may vary based on transaction volume, complexity, number of accounts, and scope.",
    bestFor: ["Business owners who want continuing bookkeeping support."],
    href: "/services#monthly-bookkeeping",
  },
  {
    id: "income-verification",
    name: "Income Verification & Documentation",
    shortName: "Income Verification & Documentation",
    headline: "Organize the income information you already have.",
    price: "Consultation-based pricing",
    shortDescription:
      "Professional organization of authentic income records and supporting financial documentation for individuals, self-employed professionals, and businesses.",
    description:
      "PK Business Services helps individuals, self-employed professionals, and businesses organize authentic income records and supporting financial documentation into clear, professional documentation packages.",
    scope: [
      "Organizing pay statements",
      "Organizing W-2s",
      "Organizing 1099s",
      "Organizing invoices",
      "Organizing bank statements",
      "Organizing other legitimate financial records",
      "Reviewing documentation for completeness and consistency",
      "Creating summaries based on client-provided information",
      "Organizing documentation packets",
      "Helping self-employed individuals organize income records when they do not receive traditional payroll documentation",
      "Authorized administrative verification support when appropriate",
    ],
    bestFor: [
      "Individuals and self-employed professionals organizing legitimate income documentation for third-party review.",
    ],
    href: "/services#income-verification",
  },
];

export const serviceOptions = [
  ...services.map((s) => ({ value: s.id, label: s.shortName })),
  { value: "not-sure", label: "Not Sure / Help Me Choose" },
];

export function getServiceById(id: ServiceId) {
  return services.find((s) => s.id === id);
}
