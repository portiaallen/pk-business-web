/**
 * Roast My Books — the ten launch roast templates.
 * Verbatim from MVP spec v0.1 section 6 (founder-approved draft, copy marked
 * for final review before launch). The books are the target of every joke,
 * never the person; nothing here shames the customer (directive, Oct 16).
 */
import { ASSESSMENT_URL, type IntakeAnswers, netMarginPercent, type TriggeredTemplate } from "./roast-engine";

function template(
  id: string,
  title: string,
  roastLines: string[],
  meaning: string,
  steps: string[],
  quip: string
): TriggeredTemplate {
  return { id, title, roastLines, meaning, steps, quip };
}

export const ROAST_TEMPLATES: TriggeredTemplate[] = [
  template(
    "uncategorized-collection",
    "The Uncategorized Collection",
    ["Your transactions are unlabeled like leftovers in a stranger's fridge."],
    "Uncategorized entries make every report unreliable, including the ones the tax preparer needs.",
    [
      "Filter the register by 'uncategorized' and work oldest to newest.",
      "Give it 15 minutes a day instead of one heroic weekend.",
      "Set a rule: nothing sits uncategorized past Friday.",
    ],
    "Even the receipts gave up labeling this."
  ),
  template(
    "reconciliation-never-heard-of-her",
    "Reconciliation? Never Heard of Her",
    [
      "Your bank and your books haven't spoken in a while.",
      "They're not estranged, they're just wrong.",
    ],
    "Without reconciliation, duplicates and omissions compound invisibly; errors hide in the gap.",
    [
      "Reconcile the oldest month first, then roll forward month by month.",
      "Clear the small stuff daily so the backlog never reforms.",
    ],
    "Certified 'it balances in my heart.'"
  ),
  template(
    "ramen-reserve",
    "The Ramen Reserve",
    ["Your cash reserve wouldn't survive a slow Tuesday."],
    "Under one month of expenses in reserve is a cash-flow risk, whatever the revenue says.",
    [
      "Set a cash floor of one month's expenses and defend it.",
      "Check pricing against actual costs before cutting anything else.",
    ],
    "Running on vibes and a negative balance."
  ),
  template(
    "subscription-graveyard",
    "The Subscription Graveyard",
    ["You're paying more per month to apps than to people, and the apps don't even like you."],
    "Recurring charges are the quietest expense line; most businesses find one or two they forgot.",
    [
      "Export every subscription and read the list out loud.",
      "Cancel or consolidate two today.",
    ],
    "A whole cemetery, and you keep feeding the ghosts."
  ),
  template(
    "overdue-invoice-choir",
    "The Overdue Invoice Choir",
    ["Your customers are holding your money like it's a group project."],
    "Aged receivables decay into uncollectable ones; this is a process problem, not a character flaw.",
    [
      "Put net-15 reminders on a schedule, not on a mood.",
      "Take deposits up front on new work.",
    ],
    "Singing your name, off key, unpaid."
  ),
  template(
    "owners-draw-ocean",
    "The Owner's Draw Ocean",
    ["The business paid you more than it earned, which is adorable until you need it."],
    "Over-drawing converts a cash-flow question into a solvency question.",
    [
      "Set a draw formula tied to real net income.",
      "Revisit it every quarter, not every craving.",
    ],
    "You are your own best customer and your own worst vendor."
  ),
  template(
    "shrinkflation-pl",
    "The Shrinkflation P&L",
    ["Revenue is doing its job. Profit filed a missing persons report."],
    "A thin margin with real revenue is an anomaly worth investigating: pricing, costs, or both need an actual look. An anomaly is not automatically an error.",
    [
      "Break margin down by product or service.",
      "Reprice or drop the worst performer.",
    ],
    "All lights on, nobody home."
  ),
  template(
    "credit-card-carousel",
    "The Credit Card Carousel",
    ["Your business card balance has achieved residency."],
    "Carried balances are the most expensive working capital a small business buys.",
    [
      "Stop adding new carries.",
      "Target the oldest balance first.",
    ],
    "The only member of the team with perfect attendance."
  ),
  template(
    "shoebox-archive",
    "The Shoebox Archive",
    ["Your accounting system is a shoebox with a dream."],
    "Without a double-entry system, nothing in the system itself can catch an error. That is a structural fact, not an insult.",
    [
      "Adopt real bookkeeping software this month.",
      "Start with the current quarter, not the backlog.",
    ],
    "Historians will call this 'the primitive era.'"
  ),
  template(
    "year-old-mystery",
    "The Year-Old Mystery",
    ["Your books haven't had a professional look at them in a long time."],
    "Even healthy books drift; a periodic professional read is cheap relative to what drift costs.",
    [
      `Book the $99 Business & Tax Season Readiness Assessment (${ASSESSMENT_URL}).`,
      "The roast's observations become the agenda.",
    ],
    "Cold case status: open."
  ),
];

export function triggeredTemplates(a: IntakeAnswers): TriggeredTemplate[] {
  const margin = netMarginPercent(a);
  const out: TriggeredTemplate[] = [];
  if (a.uncategorizedPercent > 10) out.push(byId("uncategorized-collection"));
  if (a.monthsSinceReconciliation >= 4) out.push(byId("reconciliation-never-heard-of-her"));
  if (a.monthlyExpenses > 0 && a.cashOnHand < a.monthlyExpenses) out.push(byId("ramen-reserve"));
  if (a.softwareSubscriptions > 3 * a.headcount || a.softwareSubscriptions >= 6) out.push(byId("subscription-graveyard"));
  if (a.overdueInvoicesTotal > 1000) out.push(byId("overdue-invoice-choir"));
  if (a.ownerDraws3mo > a.netIncome3mo) out.push(byId("owners-draw-ocean"));
  if (margin <= 5 && a.monthlyRevenue > 4000) out.push(byId("shrinkflation-pl"));
  if (a.monthsCarryingCard >= 2) out.push(byId("credit-card-carousel"));
  if (a.recordsMethod !== "software") out.push(byId("shoebox-archive"));
  if (a.monthsWithoutProfessional > 24) out.push(byId("year-old-mystery"));
  return out;
}

function byId(id: string): TriggeredTemplate {
  const t = ROAST_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template id: ${id}`);
  return t;
}
