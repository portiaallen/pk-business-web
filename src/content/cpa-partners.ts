// Shared option lists for the PK Practice Partners CPA application.
// These are the single source of truth for the public form, the server
// allowlist, the notification email, and the admin queue. No wholesale
// pricing appears anywhere in this content: pricing is quoted privately
// after founder review.

export const CPA_SERVICE_NEED_OPTIONS = [
  { value: "monthly_bookkeeping", label: "Monthly bookkeeping" },
  { value: "cleanup_catchup", label: "Cleanup / catch-up" },
  { value: "tax_ready_books", label: "Tax-ready books" },
  { value: "practice_overflow", label: "Practice overflow" },
] as const;

export const CPA_PARTNERSHIP_MODEL_OPTIONS = [
  { value: "white_label", label: "White-label (your firm's name, PK behind the scenes)" },
  { value: "named", label: "Named partner (PK identified as your support provider)" },
  { value: "hybrid", label: "Hybrid (decide per engagement)" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const CPA_SERVICE_NEED_VALUES = CPA_SERVICE_NEED_OPTIONS.map((o) => o.value);
export const CPA_PARTNERSHIP_MODEL_VALUES = CPA_PARTNERSHIP_MODEL_OPTIONS.map((o) => o.value);

export const CPA_ACKNOWLEDGEMENT_LABEL =
  "I understand this form must not be used to submit taxpayer files, Social Security numbers, or other sensitive client data.";

export const CPA_PAYMENT_TERMS = {
  deposit: "50% deposit before work begins",
  smallInvoice: "Invoices under $500 are fully prepaid",
  agreement: "Engagements start only after an accepted quote, signed agreement, and cleared deposit",
} as const;

export const CPA_STATUS_LABELS: Record<string, string> = {
  NEW_APPLICATION: "New application",
  IN_REVIEW: "In review",
  QUOTE_SENT: "Quote sent",
  APPROVED: "Approved",
  DECLINED: "Declined",
  ONBOARDED: "Onboarded",
};
