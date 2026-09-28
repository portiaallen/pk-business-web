/**
 * PK AI Assistant — Question Library.
 * The existing 107-item manual checklist (src/lib/qb-checklist-template.ts)
 * remains the source of truth for the manual review. This library adds
 * metadata so the AI can determine which questions are RELEVANT given
 * detected findings — and skip the rest.
 *
 * trigger: which detected condition makes this question relevant.
 */

export type TriggerCondition =
  | "ALWAYS" // core question — relevant to every cleanup engagement
  | "BANK_ACCOUNTS"
  | "UNCATEGORIZED_TXNS"
  | "UNRECONCILED"
  | "PERSONAL_CARD_ACTIVITY"
  | "OWNER_DRAWS_CONTRIBS"
  | "PAYROLL_ACTIVITY"
  | "CONTRACTOR_ACTIVITY"
  | "AR_ACTIVITY"
  | "AP_ACTIVITY"
  | "SALES_TAX_ACTIVITY"
  | "FIXED_ASSETS"
  | "LOANS_LIABILITIES"
  | "NEGATIVE_BALANCES"
  | "DUPLICATE_SUSPECTED"
  | "UNUSUAL_AMOUNTS"
  | "TRANSFERS"
  | "INACTIVE_ACCOUNT_ACTIVITY"
  | "SCOPE_CONCERN"
  | "DOCUMENTS_GAPS";

export type LibraryQuestion = {
  checklistItemKey: string;
  category: string;
  trigger: TriggerCondition;
  required: boolean; // required when triggered
  audience: "ADVISOR" | "CLIENT";
};

export const QUESTION_LIBRARY: LibraryQuestion[] = [
  // Client & Company Setup
  { checklistItemKey: "company-info", category: "Client & Company Setup", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "company-settings", category: "Client & Company Setup", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "fiscal-year", category: "Client & Company Setup", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "company-type", category: "Client & Company Setup", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "opening-balances", category: "Client & Company Setup", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Bank & Credit Card Accounts
  { checklistItemKey: "bank-accounts", category: "Bank & Credit Card Accounts", trigger: "BANK_ACCOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "cc-accounts", category: "Bank & Credit Card Accounts", trigger: "BANK_ACCOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "account-balances", category: "Bank & Credit Card Accounts", trigger: "UNRECONCILED", required: true, audience: "ADVISOR" },
  { checklistItemKey: "negative-balances", category: "Bank & Credit Card Accounts", trigger: "NEGATIVE_BALANCES", required: true, audience: "ADVISOR" },
  { checklistItemKey: "duplicate-accounts", category: "Bank & Credit Card Accounts", trigger: "BANK_ACCOUNTS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "transfers", category: "Bank & Credit Card Accounts", trigger: "TRANSFERS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "uncategorized-bank", category: "Bank & Credit Card Accounts", trigger: "UNCATEGORIZED_TXNS", required: true, audience: "ADVISOR" },

  // Income / Sales
  { checklistItemKey: "income-accounts", category: "Income / Sales", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "income-trends", category: "Income / Sales", trigger: "UNUSUAL_AMOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "deposits", category: "Income / Sales", trigger: "UNRECONCILED", required: false, audience: "ADVISOR" },
  { checklistItemKey: "refunds-credits", category: "Income / Sales", trigger: "UNUSUAL_AMOUNTS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "other-income", category: "Income / Sales", trigger: "OWNER_DRAWS_CONTRIBS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "unapplied-payments", category: "Income / Sales", trigger: "AR_ACTIVITY", required: true, audience: "ADVISOR" },

  // Expenses
  { checklistItemKey: "expense-accounts", category: "Expenses", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "uncategorized-expense", category: "Expenses", trigger: "UNCATEGORIZED_TXNS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "large-expenses", category: "Expenses", trigger: "UNUSUAL_AMOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "duplicate-expenses", category: "Expenses", trigger: "DUPLICATE_SUSPECTED", required: true, audience: "ADVISOR" },
  { checklistItemKey: "negative-expenses", category: "Expenses", trigger: "NEGATIVE_BALANCES", required: false, audience: "ADVISOR" },
  { checklistItemKey: "merchant-patterns", category: "Expenses", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "subcategories", category: "Expenses", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Owner / Personal Transactions
  { checklistItemKey: "personal-cc-list", category: "Owner / Personal Transactions", trigger: "PERSONAL_CARD_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "personal-cc-classification", category: "Owner / Personal Transactions", trigger: "PERSONAL_CARD_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "owner-draws", category: "Owner / Personal Transactions", trigger: "OWNER_DRAWS_CONTRIBS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "owner-contributions", category: "Owner / Personal Transactions", trigger: "OWNER_DRAWS_CONTRIBS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "reimbursement-method", category: "Owner / Personal Transactions", trigger: "PERSONAL_CARD_ACTIVITY", required: true, audience: "CLIENT" },
  { checklistItemKey: "personal-nonbusiness", category: "Owner / Personal Transactions", trigger: "PERSONAL_CARD_ACTIVITY", required: true, audience: "CLIENT" },

  // Chart of Accounts
  { checklistItemKey: "coa-review", category: "Chart of Accounts", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "coa-numbering", category: "Chart of Accounts", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "inactive-accounts", category: "Chart of Accounts", trigger: "INACTIVE_ACCOUNT_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "unusual-balances", category: "Chart of Accounts", trigger: "NEGATIVE_BALANCES", required: true, audience: "ADVISOR" },
  { checklistItemKey: "cleanup-plan", category: "Chart of Accounts", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Accounts Receivable
  { checklistItemKey: "ar-aging", category: "Accounts Receivable", trigger: "AR_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "ar-old-invoices", category: "Accounts Receivable", trigger: "AR_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "ar-customer-balances", category: "Accounts Receivable", trigger: "AR_ACTIVITY", required: false, audience: "ADVISOR" },
  { checklistItemKey: "ar-negative-balances", category: "Accounts Receivable", trigger: "AR_ACTIVITY", required: false, audience: "ADVISOR" },
  { checklistItemKey: "ar-income-mismatch", category: "Accounts Receivable", trigger: "AR_ACTIVITY", required: false, audience: "ADVISOR" },

  // Accounts Payable
  { checklistItemKey: "ap-aging", category: "Accounts Payable", trigger: "AP_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "ap-old-bills", category: "Accounts Payable", trigger: "AP_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "ap-vendor-balances", category: "Accounts Payable", trigger: "AP_ACTIVITY", required: false, audience: "ADVISOR" },
  { checklistItemKey: "ap-negative-balances", category: "Accounts Payable", trigger: "AP_ACTIVITY", required: false, audience: "ADVISOR" },
  { checklistItemKey: "ap-expense-mismatch", category: "Accounts Payable", trigger: "AP_ACTIVITY", required: false, audience: "ADVISOR" },

  // Sales Tax
  { checklistItemKey: "st-registration", category: "Sales Tax", trigger: "SALES_TAX_ACTIVITY", required: true, audience: "CLIENT" },
  { checklistItemKey: "st-agency", category: "Sales Tax", trigger: "SALES_TAX_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "st-filings", category: "Sales Tax", trigger: "SALES_TAX_ACTIVITY", required: true, audience: "CLIENT" },
  { checklistItemKey: "st-taxable-items", category: "Sales Tax", trigger: "SALES_TAX_ACTIVITY", required: false, audience: "ADVISOR" },
  { checklistItemKey: "st-not-applicable", category: "Sales Tax", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Payroll
  { checklistItemKey: "pr-provider", category: "Payroll", trigger: "PAYROLL_ACTIVITY", required: true, audience: "CLIENT" },
  { checklistItemKey: "pr-journal", category: "Payroll", trigger: "PAYROLL_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pr-wage-mismatch", category: "Payroll", trigger: "PAYROLL_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pr-liabilities", category: "Payroll", trigger: "PAYROLL_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pr-contractors", category: "Payroll", trigger: "CONTRACTOR_ACTIVITY", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pr-not-applicable", category: "Payroll", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Fixed Assets
  { checklistItemKey: "fa-list", category: "Fixed Assets", trigger: "FIXED_ASSETS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "fa-misclassified", category: "Fixed Assets", trigger: "UNUSUAL_AMOUNTS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "fa-depreciation", category: "Fixed Assets", trigger: "FIXED_ASSETS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "fa-disposals", category: "Fixed Assets", trigger: "FIXED_ASSETS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "fa-not-applicable", category: "Fixed Assets", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Loans & Liabilities
  { checklistItemKey: "loans-list", category: "Loans & Liabilities", trigger: "LOANS_LIABILITIES", required: true, audience: "ADVISOR" },
  { checklistItemKey: "loans-principal", category: "Loans & Liabilities", trigger: "LOANS_LIABILITIES", required: true, audience: "ADVISOR" },
  { checklistItemKey: "loans-balances", category: "Loans & Liabilities", trigger: "LOANS_LIABILITIES", required: true, audience: "ADVISOR" },
  { checklistItemKey: "loans-personal", category: "Loans & Liabilities", trigger: "LOANS_LIABILITIES", required: false, audience: "CLIENT" },
  { checklistItemKey: "loans-not-applicable", category: "Loans & Liabilities", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Reconciliations
  { checklistItemKey: "rec-status-all", category: "Reconciliations", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "rec-months-missing", category: "Reconciliations", trigger: "UNRECONCILED", required: true, audience: "ADVISOR" },
  { checklistItemKey: "rec-discrepancies", category: "Reconciliations", trigger: "UNRECONCILED", required: true, audience: "ADVISOR" },
  { checklistItemKey: "rec-stale-items", category: "Reconciliations", trigger: "UNRECONCILED", required: true, audience: "ADVISOR" },
  { checklistItemKey: "rec-adjustments", category: "Reconciliations", trigger: "UNRECONCILED", required: false, audience: "ADVISOR" },

  // Balance Sheet Review
  { checklistItemKey: "bs-run", category: "Balance Sheet Review", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "bs-comparative", category: "Balance Sheet Review", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "bs-equity", category: "Balance Sheet Review", trigger: "OWNER_DRAWS_CONTRIBS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "bs-suspense", category: "Balance Sheet Review", trigger: "UNCATEGORIZED_TXNS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "bs-out-of-balance", category: "Balance Sheet Review", trigger: "ALWAYS", required: true, audience: "ADVISOR" },

  // Profit & Loss Review
  { checklistItemKey: "pl-run", category: "Profit & Loss Review", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pl-monthly", category: "Profit & Loss Review", trigger: "UNUSUAL_AMOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pl-margin", category: "Profit & Loss Review", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "pl-unusual", category: "Profit & Loss Review", trigger: "UNUSUAL_AMOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "pl-negative", category: "Profit & Loss Review", trigger: "NEGATIVE_BALANCES", required: true, audience: "ADVISOR" },

  // Transaction-Level Red Flags
  { checklistItemKey: "rf-duplicates", category: "Transaction-Level Red Flags", trigger: "DUPLICATE_SUSPECTED", required: true, audience: "ADVISOR" },
  { checklistItemKey: "rf-round-numbers", category: "Transaction-Level Red Flags", trigger: "UNUSUAL_AMOUNTS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "rf-journal-entries", category: "Transaction-Level Red Flags", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "rf-deleted-voided", category: "Transaction-Level Red Flags", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "rf-backdating", category: "Transaction-Level Red Flags", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "rf-split-transactions", category: "Transaction-Level Red Flags", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Accountant / Audit Trail Review
  { checklistItemKey: "audit-changes", category: "Accountant / Audit Trail Review", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "audit-access", category: "Accountant / Audit Trail Review", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "audit-adjustments", category: "Accountant / Audit Trail Review", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "audit-lock", category: "Accountant / Audit Trail Review", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Users & Access
  { checklistItemKey: "users-list", category: "Users & Access", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "users-accountant", category: "Users & Access", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "users-mfa", category: "Users & Access", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "users-bank-feeds", category: "Users & Access", trigger: "BANK_ACCOUNTS", required: false, audience: "ADVISOR" },

  // Supporting Documents
  { checklistItemKey: "docs-received", category: "Supporting Documents", trigger: "DOCUMENTS_GAPS", required: true, audience: "CLIENT" },
  { checklistItemKey: "docs-statements", category: "Supporting Documents", trigger: "DOCUMENTS_GAPS", required: true, audience: "CLIENT" },
  { checklistItemKey: "docs-gaps", category: "Supporting Documents", trigger: "DOCUMENTS_GAPS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "docs-log", category: "Supporting Documents", trigger: "ALWAYS", required: false, audience: "ADVISOR" },
  { checklistItemKey: "docs-prior-year", category: "Supporting Documents", trigger: "ALWAYS", required: false, audience: "ADVISOR" },

  // Initial Findings
  { checklistItemKey: "findings-summary", category: "Initial Findings", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "findings-critical", category: "Initial Findings", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "findings-scope", category: "Initial Findings", trigger: "SCOPE_CONCERN", required: true, audience: "ADVISOR" },
  { checklistItemKey: "findings-cleanup-plan", category: "Initial Findings", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "findings-client-questions", category: "Initial Findings", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
  { checklistItemKey: "findings-readiness", category: "Initial Findings", trigger: "ALWAYS", required: true, audience: "ADVISOR" },
];

/**
 * Given detected trigger conditions, return the relevant questions
 * (with a reason for each), plus the count skipped.
 */
export function selectRelevantQuestions(
  triggers: Set<TriggerCondition>
): {
  relevant: Array<LibraryQuestion & { reason: string }>;
  skippedCount: number;
} {
  const TRIGGER_REASONS: Partial<Record<TriggerCondition, string>> = {
    ALWAYS: "Core question — applies to every cleanup engagement",
    BANK_ACCOUNTS: "Bank/credit card accounts detected in the file",
    UNCATEGORIZED_TXNS: "Uncategorized/Ask My Accountant transactions detected",
    UNRECONCILED: "Unreconciled or missing reconciliations detected",
    PERSONAL_CARD_ACTIVITY: "Business expenses paid via personal card detected",
    OWNER_DRAWS_CONTRIBS: "Owner draw/contribution activity detected",
    PAYROLL_ACTIVITY: "Payroll activity detected",
    CONTRACTOR_ACTIVITY: "Contractor/1099 payments detected",
    AR_ACTIVITY: "Accounts receivable activity detected",
    AP_ACTIVITY: "Accounts payable activity detected",
    SALES_TAX_ACTIVITY: "Sales tax activity detected",
    FIXED_ASSETS: "Fixed asset accounts detected",
    LOANS_LIABILITIES: "Loan/liability accounts detected",
    NEGATIVE_BALANCES: "Negative or unusual balances detected",
    DUPLICATE_SUSPECTED: "Potential duplicate transactions detected",
    UNUSUAL_AMOUNTS: "Unusual amounts or patterns detected",
    TRANSFERS: "Inter-account transfers detected",
    INACTIVE_ACCOUNT_ACTIVITY: "Inactive accounts with 2025 activity detected",
    SCOPE_CONCERN: "Work appears to exceed the agreed scope",
    DOCUMENTS_GAPS: "Documentation gaps detected",
  };

  const relevant: Array<LibraryQuestion & { reason: string }> = [];
  for (const q of QUESTION_LIBRARY) {
    if (triggers.has(q.trigger) || (q.trigger === "ALWAYS" && triggers.size >= 0)) {
      relevant.push({ ...q, reason: TRIGGER_REASONS[q.trigger] ?? "Relevant to this engagement" });
    }
  }
  return { relevant, skippedCount: QUESTION_LIBRARY.length - relevant.length };
}
