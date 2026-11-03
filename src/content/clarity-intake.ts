// PK Business Clarity Collection — per-product intake questionnaires (M2).
// Every question is deliberately non-sensitive: no question asks for, and no
// answer may contain, SSNs, ITINs, IP PINs, EFINs, or bank details. Sensitive
// values are rejected server-side before persistence (src/lib/clarity-intake.ts).
// Receipt Rescue is scoped to 50 receipts; Deduction Hunter Business reviews
// up to 25 expense entries against Schedule C. The caps below are enforced
// server-side, never only in the UI.

import type { ClarityProductId } from "./clarity";

export type ClarityIntakeQuestionType =
  | "text"
  | "longtext"
  | "select"
  | "checkbox"
  | "entry-list";

export interface ClarityIntakeEntryField {
  id: string;
  label: string;
  type: "text" | "number";
  options?: string[];
  required?: boolean;
}

export interface ClarityIntakeQuestion {
  id: string;
  label: string;
  type: ClarityIntakeQuestionType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  maxEntries?: number;
  entryFields?: ClarityIntakeEntryField[];
}

export interface ClarityIntakeDefinition {
  productId: ClarityProductId;
  version: string;
  intro: string;
  collectBusinessName: boolean;
  questions: ClarityIntakeQuestion[];
}

const TEXT_MAX_LENGTH = 2000;

export const CLARITY_INTAKE_TEXT_MAX_LENGTH = TEXT_MAX_LENGTH;

export const CLARITY_INTAKE_SENSITIVE_GUIDANCE =
  "Please remove sensitive information such as Social Security numbers, ITINs, IP PINs, or bank details and resubmit. Sensitive information moves through PK's secure client process, never this form.";

const RECEIPT_CATEGORIES = [
  "Meals and entertainment",
  "Office supplies",
  "Fuel and mileage",
  "Software and subscriptions",
  "Travel",
  "Professional services",
  "Equipment",
  "Other",
];

const SCHEDULE_C_CATEGORIES = [
  "Advertising and marketing",
  "Vehicle and mileage",
  "Home office",
  "Supplies",
  "Insurance",
  "Professional services",
  "Travel and meals",
  "Rent and utilities",
  "Payroll and contractors",
  "Software and subscriptions",
  "Education and training",
  "Other",
];

const SCHEDULE_A_AREAS = [
  "Mortgage interest and property taxes",
  "Charitable giving",
  "Medical expenses",
  "State and local taxes",
  "Casualty or theft losses",
  "Other itemized areas",
];

export const clarityIntakeDefinitions: Record<
  ClarityProductId,
  ClarityIntakeDefinition
> = {
  "business-money-blueprint": {
    productId: "business-money-blueprint",
    version: "PK_CLARITY_INTAKE_BMB_V1_2026_11_03",
    intro:
      "Tell PK how money moves through your business. Your answers shape the money-in and money-out review behind your Business Money Blueprint.",
    collectBusinessName: true,
    questions: [
      {
        id: "what-business-does",
        label: "What does your business do?",
        type: "longtext",
        required: true,
        placeholder: "A sentence or two about what you sell or provide.",
      },
      {
        id: "money-in",
        label: "How does money come in?",
        type: "longtext",
        required: true,
        placeholder: "For example: card payments, invoices, cash, online sales.",
      },
      {
        id: "money-out",
        label: "What are your regular money-out commitments?",
        type: "longtext",
        required: true,
        placeholder: "Rent, subscriptions, contractors, supplies, insurance, etc.",
      },
      {
        id: "records-location",
        label: "Where do your business records live today?",
        type: "select",
        required: true,
        options: [
          "Accounting software",
          "Spreadsheet",
          "Bank statements only",
          "Boxes or folders of paper",
          "A mix of the above",
          "Not organized yet",
        ],
      },
      {
        id: "business-age",
        label: "How long has the business been operating?",
        type: "select",
        required: true,
        options: ["Under 1 year", "1 to 3 years", "3 to 10 years", "Over 10 years"],
      },
      {
        id: "biggest-question",
        label: "What is the biggest money question you want answered?",
        type: "longtext",
        required: false,
        placeholder: "Optional, but it helps PK aim the review.",
      },
    ],
  },
  "receipt-rescue": {
    productId: "receipt-rescue",
    version: "PK_CLARITY_INTAKE_RR_V1_2026_11_03",
    intro:
      "Receipt Rescue organizes up to 50 receipts into a clean, reviewable record. Answer below so PK knows what is coming.",
    collectBusinessName: true,
    questions: [
      {
        id: "receipt-count",
        label: "Roughly how many receipts need organizing?",
        type: "select",
        required: true,
        options: [
          "Under 25",
          "25 to 50",
          "51 to 100",
          "Over 100",
          "Not sure yet",
        ],
        help: "Receipt Rescue covers up to 50 receipts. If you have more, PK organizes the first 50 and recommends next steps for the rest.",
      },
      {
        id: "date-range",
        label: "What date range do the receipts cover?",
        type: "text",
        required: true,
        placeholder: "For example: January 2025 through December 2025.",
      },
      {
        id: "receipt-format",
        label: "What form are the receipts in?",
        type: "select",
        required: true,
        options: ["Paper receipts", "Email or digital copies", "Photos", "A mix of formats"],
      },
      {
        id: "categories",
        label: "Which categories do the receipts fall into?",
        type: "checkbox",
        required: true,
        options: RECEIPT_CATEGORIES,
      },
      {
        id: "where-they-live",
        label: "Where do the receipts live right now?",
        type: "longtext",
        required: true,
        placeholder: "A drawer, a shoebox, your email, an app — whatever is true.",
      },
      {
        id: "notes",
        label: "Anything unusual about these receipts PK should know?",
        type: "longtext",
        required: false,
      },
    ],
  },
  "deduction-hunter-business": {
    productId: "deduction-hunter-business",
    version: "PK_CLARITY_INTAKE_DHB_V1_2026_11_03",
    intro:
      "Deduction Hunter — Business Edition reviews up to 25 expense entries against Schedule C categories. List the entries you want reviewed below.",
    collectBusinessName: true,
    questions: [
      {
        id: "business-type",
        label: "What type of business is it?",
        type: "text",
        required: true,
        placeholder: "For example: mobile dog grooming, freelance design, catering.",
      },
      {
        id: "entity-structure",
        label: "How is the business structured?",
        type: "select",
        required: true,
        options: [
          "Sole proprietor (Schedule C)",
          "Single-member LLC",
          "Multi-member LLC or partnership",
          "S corporation",
          "C corporation",
          "Not sure",
        ],
      },
      {
        id: "bookkeeping-method",
        label: "How is the bookkeeping kept today?",
        type: "select",
        required: true,
        options: ["Accounting software", "Spreadsheet", "Paper records", "Not kept yet"],
      },
      {
        id: "entries",
        label: "Expenses or deductions to review",
        type: "entry-list",
        required: true,
        maxEntries: 25,
        entryFields: [
          { id: "description", label: "Description", type: "text", required: true },
          { id: "category", label: "Category", type: "text", options: SCHEDULE_C_CATEGORIES, required: true },
          { id: "amount", label: "Approximate amount (optional)", type: "number" },
        ],
        help: "Up to 25 entries. Descriptions only: never include Social Security numbers, ITINs, IP PINs, or bank account numbers.",
      },
      {
        id: "tax-year",
        label: "Which tax year does this review cover?",
        type: "select",
        required: true,
        options: ["2024", "2025", "2026"],
      },
      {
        id: "unusual-items",
        label: "Any unusual items PK should look at closely?",
        type: "longtext",
        required: false,
      },
    ],
  },
  "deduction-hunter-personal": {
    productId: "deduction-hunter-personal",
    version: "PK_CLARITY_INTAKE_DHP_V1_2026_11_03",
    intro:
      "Deduction Hunter — Personal Edition reviews your itemized (Schedule A) deduction picture. Answer below and PK maps what applies to you.",
    collectBusinessName: false,
    questions: [
      {
        id: "filing-status",
        label: "What is your filing status?",
        type: "select",
        required: true,
        options: [
          "Single",
          "Married filing jointly",
          "Married filing separately",
          "Head of household",
        ],
      },
      {
        id: "homeownership",
        label: "Do you own or rent your home?",
        type: "select",
        required: true,
        options: ["Own with a mortgage", "Own outright", "Rent"],
      },
      {
        id: "areas",
        label: "Which itemized areas should PK review?",
        type: "checkbox",
        required: true,
        options: SCHEDULE_A_AREAS,
      },
      {
        id: "tax-year",
        label: "Which tax year does this review cover?",
        type: "select",
        required: true,
        options: ["2024", "2025", "2026"],
      },
      {
        id: "notes",
        label: "Anything else about your situation PK should know?",
        type: "longtext",
        required: false,
      },
    ],
  },
};

export function clarityIntakeDefinition(productId: string): ClarityIntakeDefinition | null {
  return (clarityIntakeDefinitions as Record<string, ClarityIntakeDefinition>)[productId] ?? null;
}
