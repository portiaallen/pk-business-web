export type ServiceId =
  | "quickbooks-cleanup"
  | "tax-ready-bookkeeping"
  | "monthly-bookkeeping"
  | "income-verification";

export interface Service {
  id: ServiceId;
  name: string;
  shortName: string;
  price: string;
  shortDescription: string;
  description: string;
  scope: string[];
  bestFor: string[];
  href: string;
}

export const services: Service[] = [
  {
    id: "quickbooks-cleanup",
    name: "QuickBooks Cleanup",
    shortName: "QuickBooks Cleanup",
    price: "Starting at $250",
    shortDescription:
      "Organize and clean up existing QuickBooks records when your books have fallen behind or become difficult to manage.",
    description:
      "Help business owners organize and clean up existing QuickBooks records when their books have fallen behind or become difficult to manage.",
    scope: [
      "Transaction organization",
      "Categorization review",
      "Identifying items requiring client clarification",
      "Bookkeeping organization",
      "Reviewing outstanding cleanup needs",
      "Preparing records for ongoing maintenance",
    ],
    bestFor: [
      "Small business owners with backlogged QuickBooks files",
      "Self-employed professionals whose records need reorganization",
      "Entrepreneurs preparing for ongoing bookkeeping support",
    ],
    href: "/services#quickbooks-cleanup",
  },
  {
    id: "tax-ready-bookkeeping",
    name: "Tax-Ready Bookkeeping",
    shortName: "Tax-Ready Bookkeeping",
    price: "Starting at $400",
    shortDescription:
      "Organize your bookkeeping records before providing them to your tax professional for a smoother tax-time handoff.",
    description:
      "Help business owners organize their existing bookkeeping records before providing them to their tax professional.",
    scope: [
      "Transaction organization",
      "Categorization",
      "Reconciliation support where appropriate",
      "Identifying missing information",
      "Identifying questionable transactions for client clarification",
      "Organizing supporting documentation",
      "Preparing organized records for tax-time handoff",
    ],
    bestFor: [
      "Business owners approaching tax season",
      "Self-employed professionals preparing records for their CPA",
      "Entrepreneurs who need organized books before filing",
    ],
    href: "/services#tax-ready-bookkeeping",
  },
  {
    id: "monthly-bookkeeping",
    name: "Monthly Bookkeeping Support",
    shortName: "Monthly Bookkeeping Support",
    price: "Starting at $300/month",
    shortDescription:
      "Ongoing bookkeeping organization and support to help keep your financial records current and well-maintained.",
    description:
      "Ongoing bookkeeping organization and support for small businesses. Final pricing depends on transaction volume, complexity, number of accounts, and scope.",
    scope: [
      "Monthly transaction categorization",
      "Bookkeeping maintenance",
      "Reconciliation support",
      "Review of outstanding bookkeeping items",
      "Client communication regarding missing information",
      "Maintaining organized financial records",
    ],
    bestFor: [
      "Small businesses needing consistent monthly support",
      "Growing companies that want organized records year-round",
      "Self-employed professionals who prefer outsourced bookkeeping maintenance",
    ],
    href: "/services#monthly-bookkeeping",
  },
  {
    id: "income-verification",
    name: "Income Verification & Documentation Services",
    shortName: "Income Verification & Documentation",
    price: "Consultation-based pricing",
    shortDescription:
      "We organize and document the income information you already have — helping you prepare professional documentation from legitimate records.",
    description:
      "Helping clients organize and document authentic financial information they already possess. We organize and document the income information you already have.",
    scope: [
      "Organizing client-provided income records",
      "Reviewing documents for completeness and consistency",
      "Creating income documentation summaries based on supplied records",
      "Organizing pay stubs, W-2s, 1099s, bank statements, and invoices",
      "Organizing other legitimate supporting financial documentation",
      "Preparing professional documentation packets",
      "Helping self-employed clients organize legitimate income records when they do not receive traditional payroll documentation",
      "Authorized administrative verification support",
    ],
    bestFor: [
      "Self-employed individuals organizing income documentation",
      "Clients preparing legitimate financial records for third-party review",
      "Individuals who need help organizing scattered income-related documents",
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
