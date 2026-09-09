/**
 * QB Cleanup — Initial Review checklist template.
 * Reusable template data: creating a review instantiates one QbCleanupChecklist
 * row (definition) per item below, each with its own QbCleanupChecklistItem state.
 */

export const QB_CHECKLIST_TEMPLATE: {
  category: string;
  items: { key: string; title: string; description?: string }[];
}[] = [
  {
    category: "Client & Company Setup",
    items: [
      { key: "company-info", title: "Verify company legal name, address, and EIN in QBO" },
      { key: "company-settings", title: "Confirm company settings (accounting method, fiscal year start, tax form)" },
      { key: "fiscal-year", title: "Confirm 2025 reporting period and any mid-year changes" },
      { key: "company-type", title: "Confirm entity type (LLC, S-corp, etc.) matches expectations" },
      { key: "opening-balances", title: "Review opening balance equity and prior-year carryover" },
    ],
  },
  {
    category: "Bank & Credit Card Accounts",
    items: [
      { key: "bank-accounts", title: "List all bank accounts connected/registered in QBO" },
      { key: "cc-accounts", title: "List all credit card accounts (business and personal used for business)" },
      { key: "account-balances", title: "Compare QBO balances to actual statements as of 12/31/2025" },
      { key: "negative-balances", title: "Identify any negative or unusual account balances" },
      { key: "duplicate-accounts", title: "Identify duplicate or unused bank/CC accounts" },
      { key: "transfers", title: "Review inter-account transfers for matching pairs" },
      { key: "uncategorized-bank", title: "Identify uncategorized bank/CC feed transactions" },
    ],
  },
  {
    category: "Income / Sales",
    items: [
      { key: "income-accounts", title: "Review income account structure for duplicate/misused accounts" },
      { key: "income-trends", title: "Review monthly 2025 income for unusual spikes/dips" },
      { key: "deposits", title: "Identify undeposited funds and unapplied customer payments" },
      { key: "refunds-credits", title: "Review refunds, credits, and discounts posted in 2025" },
      { key: "other-income", title: "Identify income misclassified as other income or owner contributions" },
      { key: "unapplied-payments", title: "Identify unapplied/unmatched customer payments" },
    ],
  },
  {
    category: "Expenses",
    items: [
      { key: "expense-accounts", title: "Review expense account structure for duplicates/misuse" },
      { key: "uncategorized-expense", title: "Identify transactions posted to Ask My Accountant/Uncategorized" },
      { key: "large-expenses", title: "Flag unusually large or round-number expense transactions" },
      { key: "duplicate-expenses", title: "Identify potential duplicate expense entries" },
      { key: "negative-expenses", title: "Identify negative expense entries (possible refunds/misclassifications)" },
      { key: "merchant-patterns", title: "Review vendor/merchant spending patterns for classification consistency" },
      { key: "subcategories", title: "Verify use of cost of goods sold vs operating expense accounts" },
    ],
  },
  {
    category: "Owner / Personal Transactions",
    items: [
      { key: "personal-cc-list", title: "List all business expenses paid via personal credit card in 2025" },
      { key: "personal-cc-classification", title: "Determine how each personal-CC transaction is currently classified" },
      { key: "owner-draws", title: "Review owner draws/distributions for 2025" },
      { key: "owner-contributions", title: "Review owner contributions/investments for 2025" },
      { key: "reimbursement-method", title: "Determine appropriate treatment (reimbursement vs capital contribution vs expense direct)" },
      { key: "personal-nonbusiness", title: "Identify possible personal (non-business) charges mixed into business accounts" },
    ],
  },
  {
    category: "Chart of Accounts",
    items: [
      { key: "coa-review", title: "Review full chart of accounts for duplicates and redundancy" },
      { key: "coa-numbering", title: "Note missing account types (bank, income, expense, asset, liability, equity)" },
      { key: "inactive-accounts", title: "Review inactive accounts still receiving 2025 activity" },
      { key: "unusual-balances", title: "Flag accounts with balances inconsistent with their type" },
      { key: "cleanup-plan", title: "Propose COA consolidation/renaming plan (for cleanup phase)" },
    ],
  },
  {
    category: "Accounts Receivable",
    items: [
      { key: "ar-aging", title: "Run AR aging summary as of 12/31/2025" },
      { key: "ar-old-invoices", title: "Identify old/uncollectible invoices" },
      { key: "ar-customer-balances", title: "Verify customer balances match supporting records" },
      { key: "ar-negative-balances", title: "Identify customers with negative (credit) balances" },
      { key: "ar-income-mismatch", title: "Check for income recorded without corresponding AR/invoice" },
    ],
  },
  {
    category: "Accounts Payable",
    items: [
      { key: "ap-aging", title: "Run AP aging summary as of 12/31/2025" },
      { key: "ap-old-bills", title: "Identify old/possibly-paid outstanding bills" },
      { key: "ap-vendor-balances", title: "Verify vendor balances match supporting records" },
      { key: "ap-negative-balances", title: "Identify vendors with negative balances (duplicate bills/credits)" },
      { key: "ap-expense-mismatch", title: "Check for expenses recorded without corresponding AP/bill" },
    ],
  },
  {
    category: "Sales Tax",
    items: [
      { key: "st-registration", title: "Confirm whether sales tax is applicable and registered" },
      { key: "st-agency", title: "Review sales tax payable balance and agency owed" },
      { key: "st-filings", title: "Verify 2025 sales tax filings match recorded liability" },
      { key: "st-taxable-items", title: "Flag potentially taxable sales recorded without tax" },
      { key: "st-not-applicable", title: "Mark N/A if business does not collect sales tax" },
    ],
  },
  {
    category: "Payroll",
    items: [
      { key: "pr-provider", title: "Identify payroll provider and method of recording" },
      { key: "pr-journal", title: "Review 2025 payroll journal entries vs payroll reports" },
      { key: "pr-wage-mismatch", title: "Compare recorded wages to payroll tax filings (Q1–Q4 2025)" },
      { key: "pr-liabilities", title: "Review payroll tax liability balances" },
      { key: "pr-contractors", title: "Review contractor payments (1099 candidates) for 2025" },
      { key: "pr-not-applicable", title: "Mark N/A if no payroll in 2025" },
    ],
  },
  {
    category: "Fixed Assets",
    items: [
      { key: "fa-list", title: "List fixed asset accounts and 2025 additions" },
      { key: "fa-misclassified", title: "Identify large purchases expensed that may belong in fixed assets" },
      { key: "fa-depreciation", title: "Confirm 2025 depreciation entries exist and are reasonable" },
      { key: "fa-disposals", title: "Review asset disposals/sales during 2025" },
      { key: "fa-not-applicable", title: "Mark N/A if no fixed assets" },
    ],
  },
  {
    category: "Loans & Liabilities",
    items: [
      { key: "loans-list", title: "List all loan and liability accounts" },
      { key: "loans-principal", title: "Verify principal vs interest splits on loan payments" },
      { key: "loans-balances", title: "Compare loan balances to lender statements as of 12/31/2025" },
      { key: "loans-personal", title: "Identify personal loans used for business (if any)" },
      { key: "loans-not-applicable", title: "Mark N/A if no loans/liabilities" },
    ],
  },
  {
    category: "Reconciliations",
    items: [
      { key: "rec-status-all", title: "Run reconciliation status report for all accounts, FY2025" },
      { key: "rec-months-missing", title: "Identify months/accounts never reconciled in 2025" },
      { key: "rec-discrepancies", title: "Document reconciliation discrepancies and differences" },
      { key: "rec-stale-items", title: "Identify stale uncleared transactions (old checks, deposits)" },
      { key: "rec-adjustments", title: "Review prior reconciliation adjustments/forcing entries" },
    ],
  },
  {
    category: "Balance Sheet Review",
    items: [
      { key: "bs-run", title: "Run Balance Sheet as of 12/31/2025" },
      { key: "bs-comparative", title: "Compare to 12/31/2024 for unusual changes" },
      { key: "bs-equity", title: "Review equity accounts for reasonableness" },
      { key: "bs-suspense", title: "Identify balances in suspense/clearing/uncategorized accounts" },
      { key: "bs-out-of-balance", title: "Verify balance sheet balances (assets = liabilities + equity)" },
    ],
  },
  {
    category: "Profit & Loss Review",
    items: [
      { key: "pl-run", title: "Run 2025 P&L (accrual and cash basis if available)" },
      { key: "pl-monthly", title: "Review monthly P&L for anomalies" },
      { key: "pl-margin", title: "Check gross margin/reasonableness of income vs expense" },
      { key: "pl-unusual", title: "Flag unusual or miscategorized P&L line items" },
      { key: "pl-negative", title: "Identify negative income/expense lines needing explanation" },
    ],
  },
  {
    category: "Transaction-Level Red Flags",
    items: [
      { key: "rf-duplicates", title: "Search for duplicate transaction amounts/dates/vendors" },
      { key: "rf-round-numbers", title: "Flag round-dollar and recurring manual journal entries" },
      { key: "rf-journal-entries", title: "Review all 2025 manual journal entries" },
      { key: "rf-deleted-voided", title: "Review deleted/voided transactions from audit log" },
      { key: "rf-backdating", title: "Flag transactions with unusual entry vs transaction dates" },
      { key: "rf-split-transactions", title: "Review split/multi-line transactions for allocation errors" },
    ],
  },
  {
    category: "Accountant / Audit Trail Review",
    items: [
      { key: "audit-changes", title: "Review audit log for post-cutoff changes to 2025 transactions" },
      { key: "audit-access", title: "Note any unexpected user activity in the file" },
      { key: "audit-adjustments", title: "Review prior accountant/bookkeeper year-end adjustments" },
      { key: "audit-lock", title: "Determine whether closing the books / lock dates is needed" },
    ],
  },
  {
    category: "Users & Access",
    items: [
      { key: "users-list", title: "List all QBO users and their permission levels" },
      { key: "users-accountant", title: "Confirm accountant access is appropriately scoped" },
      { key: "users-mfa", title: "Note MFA/security status (do NOT record credentials)" },
      { key: "users-bank-feeds", title: "Review bank feed connections and permissions" },
    ],
  },
  {
    category: "Supporting Documents",
    items: [
      { key: "docs-received", title: "Confirm which requested client documents were received" },
      { key: "docs-statements", title: "Confirm bank/CC statements received for all accounts, FY2025" },
      { key: "docs-gaps", title: "Identify missing documentation needed to complete review" },
      { key: "docs-log", title: "Log all QBO reports pulled (link each to its checklist item)" },
      { key: "docs-prior-year", title: "Confirm prior-year return/tie-out info if needed" },
    ],
  },
  {
    category: "Initial Findings",
    items: [
      { key: "findings-summary", title: "Summarize the overall initial condition of the books" },
      { key: "findings-critical", title: "List critical items requiring immediate attention" },
      { key: "findings-scope", title: "Assess whether scope materially exceeds ~24 hour estimate" },
      { key: "findings-cleanup-plan", title: "Draft the cleanup work plan (for cleanup phase, not performed here)" },
      { key: "findings-client-questions", title: "Compile open questions for the client" },
      { key: "findings-readiness", title: "State whether the file is ready to proceed to cleanup" },
    ],
  },
];
