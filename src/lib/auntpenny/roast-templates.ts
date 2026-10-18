/**
 * Roast My Books — the ten launch roast templates.
 * Roast lines, meanings and quips are verbatim from MVP spec v0.1 section 6
 * (founder-approved draft). The books are the target of every joke, never the
 * person; nothing here shames the customer (directive, Oct 16).
 *
 * Founder round-2 directive (Oct 17, 6:10 PM email): recommendations must match
 * evidence. No "cancel 2 of 7 subscriptions" from a count alone; no oldest-first
 * payoff order without APRs and terms; no promise that a backlog fits one short
 * session; no assumption that one collection policy fits every business. Every
 * template therefore carries conditional, checkpoint-style steps plus structured
 * guidance: why it matters, what to check, a realistic next move, and when to
 * seek help. Evidence is generated per intake in evidenceFor() so every finding
 * is traceable to a submitted value.
 */
import { ASSESSMENT_URL, type IntakeAnswers, netMarginPercent, type TriggeredTemplate } from "./roast-engine";

const fmt = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

function template(
  id: string,
  title: string,
  roastLines: string[],
  meaning: string,
  steps: string[],
  quip: string,
  guidance: { matters: string; check: string; next: string; help: string }
): TriggeredTemplate {
  return { id, title, roastLines, meaning, steps, quip, guidance };
}

export const ROAST_TEMPLATES: TriggeredTemplate[] = [
  template(
    "uncategorized-collection",
    "The Uncategorized Collection",
    ["Your transactions are unlabeled like leftovers in a stranger's fridge."],
    "Uncategorized entries make every report unreliable, including the ones the tax preparer needs.",
    [
      "Filter the register by 'uncategorized' and work oldest to newest.",
      "Give it a repeating block of time, 15 to 30 minutes a day, rather than one heroic weekend; how long the backlog takes depends on the count.",
      "Set a rule: nothing new sits uncategorized past Friday.",
    ],
    "Even the receipts gave up labeling this.",
    {
      matters: "Every report built on uncategorized entries is a guess, including the one your tax preparer would read.",
      check: "Check how many are repeating transactions your software could auto-categorize with a rule.",
      next: "If the count is small, clear it in daily sittings. If it runs into the hundreds, decide deliberately: your own sittings or a bookkeeper's block of hours.",
      help: "If a filing deadline is close or the count is overwhelming, a bookkeeper can clear a backlog faster than solo triage.",
    }
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
      "Reconcile the oldest month first, then roll forward month by month; a long backlog can take several sittings, and that is normal.",
      "Clear the small recurring items daily so the backlog never reforms.",
    ],
    "Certified 'it balances in my heart.'",
    {
      matters: "Unreconciled books hide errors from the one check designed to catch them.",
      check: "Check that the bank feed is connected and pulling every account; a missing account explains a lot of 'mysteries'.",
      next: "Start with the oldest month and see how far one sitting gets you before promising yourself a finish date.",
      help: "If the oldest month won't balance after an honest attempt, stop and get help; forcing a close hides the error instead of finding it.",
    }
  ),
  template(
    "ramen-reserve",
    "The Ramen Reserve",
    ["Your cash reserve wouldn't survive a slow Tuesday."],
    "Under one month of expenses in reserve is a cash-flow risk, whatever the revenue says.",
    [
      "Set a cash floor of one month's expenses and defend it as cash allows.",
      "Check pricing against actual costs before cutting anything else; if the margin itself is the leak, reserve-building won't hold.",
    ],
    "Running on vibes and a negative balance.",
    {
      matters: "Revenue is not cash. A thin reserve turns any slow month into a crisis.",
      check: "Check the last 3 months of true cash movement (money in minus money out), not just the profit figure.",
      next: "Pick a modest first target you can actually hit, then build toward the full month.",
      help: "If next month's rent or payroll is already in question, that is a today conversation with a professional, not a someday one.",
    }
  ),
  template(
    "subscription-graveyard",
    "The Subscription Graveyard",
    ["You're paying more per month to apps than to people, and the apps don't even like you."],
    "Recurring charges are the quietest expense line; most businesses find one or two they forgot.",
    [
      "Export every recurring charge and, for each one, write down what it does and when you last actually used it.",
      "Decide keep or cancel from that audit, not from the count; cancel only what you can name a reason to drop.",
      "Check for overlapping tools doing the same job before you cancel anything.",
    ],
    "A whole cemetery, and you keep feeding the ghosts.",
    {
      matters: "Small monthly charges compound into real money, and nobody notices because each one looks harmless.",
      check: "Check what each tool is actually doing in your week, and whether two tools overlap.",
      next: "Run the audit first. Cancel nothing until you have read the whole list; you may find the problem is overlap, not volume.",
      help: "None needed for the audit itself. If cash flow is tight, a professional can help prioritize cuts without breaking operations.",
    }
  ),
  template(
    "overdue-invoice-choir",
    "The Overdue Invoice Choir",
    ["Your customers are holding your money like it's a group project."],
    "Aged receivables decay into uncollectable ones; this is a process problem, not a character flaw.",
    [
      "Sort overdue invoices by age and look at which ones have actually been reminded.",
      "Put a reminder schedule on the calendar and let it run without mood.",
      "Pick collection terms that fit your clients: deposits or milestone payments up front on new work is one option, a firmer late policy is another; they are not both required and neither fits every business.",
    ],
    "Singing your name, off key, unpaid.",
    {
      matters: "The older an invoice gets, the lower its odds of ever being paid.",
      check: "Check which invoices are past 30, 60, and 90 days, and whether a reminder was ever truly sent on each.",
      next: "Start with a reminder calendar this week. Change payment terms only on NEW work, and choose the terms that fit your clients.",
      help: "If a large balance or a key relationship is at stake, get advice before escalating; collection rules vary by state.",
    }
  ),
  template(
    "owners-draw-ocean",
    "The Owner's Draw Ocean",
    ["The business paid you more than it earned, which is adorable until you need it."],
    "Over-drawing converts a cash-flow question into a solvency question.",
    [
      "Set a draw formula tied to real net income, and revisit it quarterly rather than on craving.",
      "Before year end, have the draw record reviewed by a tax professional; treatment depends on your entity type.",
    ],
    "You are your own best customer and your own worst vendor.",
    {
      matters: "Draws above income are spending the business's future cash, and mislabeled draws distort both net income and taxes.",
      check: "Check how the draws are actually recorded in the books, and against which accounts.",
      next: "Pick a draw rule you can defend (for example, a fixed share of realized net income) and write it down before the next draw.",
      help: "A tax professional should review draw treatment for your entity before year end; this is not a do-it-yourself area.",
    }
  ),
  template(
    "shrinkflation-pl",
    "The Shrinkflation P&L",
    ["Revenue is doing its job. Profit filed a missing persons report."],
    "A thin margin with real revenue is an anomaly worth investigating: pricing, costs, or both need an actual look. An anomaly is not automatically an error.",
    [
      "Break the margin down by product or service and find where it thins.",
      "Investigate pricing and direct costs before changing anything; an anomaly is a question, not a verdict.",
    ],
    "All lights on, nobody home.",
    {
      matters: "A thin margin on real revenue means something is eating the difference, and it will keep eating until named.",
      check: "Check pricing and direct costs per offer; one mispriced service can explain the whole margin.",
      next: "Rank your offers by margin before changing any price; the data picks the target, not the gut.",
      help: "If your books and your bank disagree about what came in, have the books read professionally before acting on the margin.",
    }
  ),
  template(
    "credit-card-carousel",
    "The Credit Card Carousel",
    ["Your business card balance has achieved residency."],
    "Carried balances are the most expensive working capital a small business buys.",
    [
      "Stop adding new carried balance where cash allows.",
      "List each card's APR, fees, and minimums before deciding any payoff order; the terms decide the order, not the age of the balance.",
      "If the balance keeps growing month over month, that is a cash-flow gap to understand, not just a balance to shift.",
    ],
    "The only member of the team with perfect attendance.",
    {
      matters: "Carried balances carry interest that compounds against you every single month.",
      check: "Check each card's APR and minimum payment; also check whether new spending is still landing on the card.",
      next: "Freeze new carried spending first if cash allows. Then choose a payoff order from the terms, and revisit it if your cash flow changes.",
      help: "If the balance grows month over month despite payments, a professional can help trace the cash-flow gap driving it.",
    }
  ),
  template(
    "shoebox-archive",
    "The Shoebox Archive",
    ["Your accounting system is a shoebox with a dream."],
    "Without a double-entry system, nothing in the system itself can catch an error. That is a structural fact, not an insult.",
    [
      "Adopt real bookkeeping software, starting with the current quarter rather than the backlog.",
      "Decide the backlog later, deliberately; if the volume is large, a bookkeeper's catch-up project is usually cheaper in time than doing it alone.",
    ],
    "Historians will call this 'the primitive era.'",
    {
      matters: "A shoebox cannot catch errors, and neither can memory; the structure has to do it.",
      check: "Check what your tax preparer will actually need this season; that defines the minimum catch-up.",
      next: "Set up software and enter the current quarter first; make the backlog its own scheduled project instead of a guilt pile.",
      help: "If the backlog is more than about a year, hand the catch-up to a bookkeeper; the fee is usually less than the hours it would take you.",
    }
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
    "Cold case status: open.",
    {
      matters: "Drift compounds quietly; the cost of a periodic read is small next to the cost of a season spent wrong.",
      check: "Check when a professional last looked, and what changed in the business since.",
      next: "Put the read on the calendar; the roast's findings make a ready-made agenda.",
      help: "This one is the help: the assessment is a professional reading actual books.",
    }
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

/** Evidence per finding: the submitted value and the threshold it tripped, so every finding is traceable. */
export function evidenceFor(id: string, a: IntakeAnswers): string {
  switch (id) {
    case "uncategorized-collection":
      return `${a.uncategorizedPercent}% of transactions sitting uncategorized, roughly ${a.uncategorizedTransactions} transactions (trigger: over 10%).`;
    case "reconciliation-never-heard-of-her":
      return `${a.monthsSinceReconciliation} months since the last full reconciliation (trigger: 4 or more).`;
    case "ramen-reserve":
      return `Cash on hand ${fmt(a.cashOnHand)} against one month of expenses at ${fmt(a.monthlyExpenses)} (trigger: cash below one month of expenses).`;
    case "subscription-graveyard":
      return `${a.softwareSubscriptions} software subscriptions against ${a.headcount} ${a.headcount === 1 ? "person" : "people"} in the business (trigger: more than 3 per person, or 6 or more).`;
    case "overdue-invoice-choir":
      return `${fmt(a.overdueInvoicesTotal)} in overdue customer invoices (trigger: over $1,000).`;
    case "owners-draw-ocean":
      return `Owner draws ${fmt(a.ownerDraws3mo)} against net income of ${fmt(a.netIncome3mo)} over the last 3 months (trigger: draws above net).`;
    case "shrinkflation-pl":
      return `Implied margin ${netMarginPercent(a)}% on monthly revenue of ${fmt(a.monthlyRevenue)} (trigger: 5% or under on revenue over $4,000).`;
    case "credit-card-carousel":
      return `Card balance carried ${a.monthsCarryingCard} months (trigger: 2 or more).`;
    case "shoebox-archive":
      return `Records method reported: ${a.recordsMethod} (trigger: anything other than bookkeeping software).`;
    case "year-old-mystery":
      return `${a.monthsWithoutProfessional} months without a professional look at the books (trigger: more than 24).`;
    default:
      return "Triggered by your submitted figures.";
  }
}

function byId(id: string): TriggeredTemplate {
  const t = ROAST_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template id: ${id}`);
  return t;
}
