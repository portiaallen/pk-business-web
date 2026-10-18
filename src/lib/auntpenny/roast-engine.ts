/**
 * Roast My Books — scoring engine.
 * Deterministic template merge. No AI calls, no uploads, no persistence:
 * the intake is computed entirely in the customer's browser (privacy-safe by
 * architecture, per MVP spec section 1).
 *
 * Source of truth: "Roast My Books — MVP Product Specification & Roast Template
 * Library v0.1" (2026-10-13, PK Drive 1mN32DG9hDkp5-AMT78FP2pBzPHM4zndtN7xtHorWlH4).
 * Trigger conditions, points, hard flags and tier bands are implemented exactly
 * as written there; where the spec's trigger table needs a figure the intake
 * form did not list (uncategorized transaction count, headcount, months the
 * card balance was carried), the field was added rather than the trigger
 * silently dropped.
 */

export type RecordsMethod = "software" | "spreadsheet" | "shoebox";

export interface IntakeAnswers {
  recordsMethod: RecordsMethod;
  softwareName: string;
  monthlyRevenue: number;
  monthlyExpenses: number;
  cashOnHand: number;
  monthsSinceReconciliation: number;
  uncategorizedPercent: number;
  uncategorizedTransactions: number;
  overdueInvoicesTotal: number;
  softwareSubscriptions: number;
  headcount: number;
  ownerDraws3mo: number;
  netIncome3mo: number;
  cardBalanceCarried: number;
  monthsCarryingCard: number;
  monthsWithoutProfessional: number;
  firstName: string;
}

export type IntakeField = keyof Omit<IntakeAnswers, "firstName" | "softwareName" | "recordsMethod">;

export interface ValidationIssue {
  field: string;
  message: string;
}

const FIELDS: Array<{ key: IntakeField; label: string; max?: number }> = [
  { key: "monthlyRevenue", label: "Average monthly revenue" },
  { key: "monthlyExpenses", label: "Average monthly expenses" },
  { key: "cashOnHand", label: "Cash on hand today" },
  { key: "monthsSinceReconciliation", label: "Months since your last full reconciliation", max: 600 },
  { key: "uncategorizedPercent", label: "Percent of transactions sitting uncategorized", max: 100 },
  { key: "uncategorizedTransactions", label: "Roughly how many transactions are sitting uncategorized", max: 1_000_000 },
  { key: "overdueInvoicesTotal", label: "Total in overdue customer invoices" },
  { key: "softwareSubscriptions", label: "Active software subscriptions you pay for", max: 1000 },
  { key: "headcount", label: "People working in the business, including you", max: 10_000 },
  { key: "ownerDraws3mo", label: "Owner draws taken over the last 3 months" },
  { key: "netIncome3mo", label: "Net income over the last 3 months" },
  { key: "cardBalanceCarried", label: "Business credit card balance you carry month to month" },
  { key: "monthsCarryingCard", label: "Months you have carried that card balance", max: 600 },
  { key: "monthsWithoutProfessional", label: "Months these books have gone without a professional's eyes", max: 1200 },
];

/** 0 = net income negative; the form captures signed net income, so only the money fields are non-negative. */
const NON_NEGATIVE_FIELDS: IntakeField[] = [
  "monthlyRevenue",
  "monthlyExpenses",
  "cashOnHand",
  "monthsSinceReconciliation",
  "uncategorizedPercent",
  "uncategorizedTransactions",
  "overdueInvoicesTotal",
  "softwareSubscriptions",
  "headcount",
  "ownerDraws3mo",
  "cardBalanceCarried",
  "monthsCarryingCard",
  "monthsWithoutProfessional",
];

export function validateIntake(a: Partial<IntakeAnswers>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (a.recordsMethod !== "software" && a.recordsMethod !== "spreadsheet" && a.recordsMethod !== "shoebox") {
    issues.push({ field: "recordsMethod", message: "Tell me how you keep your books." });
  }
  for (const { key, label, max } of FIELDS) {
    const v = a[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      issues.push({ field: key, message: `${label} needs a number.` });
      continue;
    }
    if (NON_NEGATIVE_FIELDS.includes(key) && v < 0) {
      issues.push({ field: key, message: `${label} can't be negative.` });
    }
    if (max !== undefined && v > max) {
      issues.push({ field: key, message: `${label} — that number looks past the point of believability. Check it.` });
    }
  }
  return issues;
}

export const TIER_NAMES: Record<RoastTier, string> = {
  1: "A Mild Side-Eye",
  2: "The Numbers Have Left the Congregation",
  3: "Certified Messy, Still Fixable",
  4: "Financial Chaos With Good Bone Structure",
  5: "Your Books Need Therapy, Not a Spreadsheet",
  // Founder's exact severity wording, preserved verbatim, period included (spec section 4/5).
  6: "Your QuickBooks Need A Divine Intervention.",
};

export type RoastTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface TriggeredTemplate {
  id: string;
  title: string;
  roastLines: string[];
  meaning: string;
  steps: string[];
  quip: string;
}

export interface RoastReport {
  tier: RoastTier;
  tierName: string;
  tierLine: string;
  points: number;
  hardFlags: string[];
  triggered: TriggeredTemplate[];
  funniestQuote: string;
  bridge: { show: boolean; line: string };
  figureCheck: FigureCheck;
}

export function netMarginPercent(a: IntakeAnswers): number {
  if (a.monthlyRevenue <= 0) return a.monthlyExpenses > 0 ? -100 : 0;
  return ((a.monthlyRevenue - a.monthlyExpenses) / a.monthlyRevenue) * 100;
}

/** Implied monthly net, from the two monthly figures the customer submitted. */
export function impliedMonthlyNet(a: IntakeAnswers): number {
  return a.monthlyRevenue - a.monthlyExpenses;
}

/** Monthly average of the 3-month net income figure the customer submitted. */
export function monthlyNetFromThreeMonths(a: IntakeAnswers): number {
  return a.netIncome3mo / 3;
}

export interface FigureCheck {
  impliedMonthlyNet: number;
  fromThreeMonths: number;
  /** null when the two labeled figures sit close enough to read as one picture. */
  note: string | null;
}

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/**
 * Cross-checks two DIFFERENT labeled figures the customer submitted:
 * "average monthly revenue minus average monthly expenses" (a monthly average)
 * and "net income over the last 3 months" (a 3-month total, shown here divided
 * by 3). They can legitimately differ: averages versus actual months, a strong
 * or weak month inside the three, owner draws, timing, or a definition gap.
 * Nothing is overwritten and scoring never uses this reconciliation; the note
 * simply refuses to pretend two different numbers are one number.
 * Tolerance: $150/month or 20% relative, whichever is larger.
 */
export function figureCheck(a: IntakeAnswers): FigureCheck {
  const implied = impliedMonthlyNet(a);
  const from3 = monthlyNetFromThreeMonths(a);
  if (![a.monthlyRevenue, a.monthlyExpenses, a.netIncome3mo].every(Number.isFinite) || a.monthlyRevenue <= 0) {
    return { impliedMonthlyNet: implied, fromThreeMonths: from3, note: null };
  }
  const tolerance = Math.max(150, 0.2 * Math.max(Math.abs(implied), Math.abs(from3)));
  if (Math.abs(implied - from3) <= tolerance) {
    return { impliedMonthlyNet: implied, fromThreeMonths: from3, note: null };
  }
  const note =
    `Two different figures, said out loud. The monthly figures you submitted imply about ` +
    `${money(implied)} a month of net (${money(a.monthlyRevenue)} revenue minus ${money(a.monthlyExpenses)} expenses), ` +
    `while the net income you submitted for the last 3 months averages ${money(from3)} a month. ` +
    `Those are two different questions, so they can land in two different places: a monthly average ` +
    `versus three actual months, a strong or weak month inside the three, owner draws, or timing. ` +
    `Neither number was changed and the roast treats them separately. If one of them surprised you, ` +
    `that field is the one to re-check before anything else.`;
  return { impliedMonthlyNet: implied, fromThreeMonths: from3, note };
}

export function scoreIntake(a: IntakeAnswers): { points: number; hardFlags: string[] } {
  const flags: string[] = [];
  let points = 0;

  // Reconciliation gap: 2-3 months +2 / 4-11 +4 / 12+ +7
  if (a.monthsSinceReconciliation >= 12) { points += 7; flags.push("12+ months unreconciled"); }
  else if (a.monthsSinceReconciliation >= 4) points += 4;
  else if (a.monthsSinceReconciliation >= 2) points += 2;

  // Uncategorized share: <=10% +1 / <=25% +3 / >25% +5
  if (a.uncategorizedPercent > 25) { points += 5; flags.push("More than 25% of transactions uncategorized"); }
  else if (a.uncategorizedPercent > 10) points += 3;
  else points += 1;

  // Uncategorized volume: >50 transactions +2
  if (a.uncategorizedTransactions > 50) points += 2;

  // Net margin: negative +5 / 0-5% +3 / 5-15% +1
  const margin = netMarginPercent(a);
  if (margin < 0) points += 5;
  else if (margin <= 5) points += 3;
  else if (margin <= 15) points += 1;

  // Overdue invoices: <$1k +1 / $1-5k +2 / >$5k +4
  if (a.overdueInvoicesTotal > 5000) points += 4;
  else if (a.overdueInvoicesTotal >= 1000) points += 2;
  else points += 1;

  // Subscription load: >3x headcount or >=6 apps +2
  if (a.softwareSubscriptions > 3 * a.headcount || a.softwareSubscriptions >= 6) points += 2;

  // Draws vs income: draws exceed net income over the 3-month window +3
  if (a.ownerDraws3mo > a.netIncome3mo) { points += 3; flags.push("Owner draws exceed net income"); }

  // Card carry: balance carried 2+ cycles +2
  if (a.monthsCarryingCard >= 2) points += 2;

  // Records method: spreadsheet or shoebox +4
  if (a.recordsMethod !== "software") points += 4;

  // Professional gap: >24 months +1
  if (a.monthsWithoutProfessional > 24) points += 1;

  // Negative net income is a hard flag (spec section 4).
  if (a.netIncome3mo < 0) flags.push("Negative net income");

  return { points, hardFlags: flags };
}

export function tierFor(points: number, hardFlags: string[]): RoastTier {
  if (points >= 20 || hardFlags.length >= 2) return 6;
  if (points >= 16) return 5;
  if (points >= 12) return 4;
  if (points >= 8) return 3;
  if (points >= 4) return 2;
  return 1;
}

export const TIER_6_CLOSE =
  "The good news: exorcisms are booked through the assessment, and the assessment is $99."; // spec: final wording for founder review

export const ASSESSMENT_URL = "https://pkservices.business/assessment";
