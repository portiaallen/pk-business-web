import type { IntakeAnswers } from "./roast-engine";

const money = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");

/** Deterministic, input-grounded comedy. No invented account details or AI calls. */
export function pennyOpening(a: IntakeAnswers): string {
  const revenue = a.monthlyRevenue;
  const expenses = a.monthlyExpenses;
  const remainder = revenue - expenses;
  if (revenue > 0 && expenses > 0 && expenses / revenue >= 0.85) {
    return "You had " + money(revenue) + " come in and " + money(expenses) + " walk right back out. Baby, those dollars treated your business like a damn airport. They never even unpacked. That leaves " + money(remainder) + " before anything these two figures don't capture.";
  }
  if (a.recordsMethod === "spreadsheet") return "A spreadsheet? Baby, Excel has been promoted to CFO, bookkeeper AND witness protection. Those cells better have receipts behind them.";
  if (a.recordsMethod === "shoebox") return "A shoebox? Baby, your receipts are living in a cardboard condo with no lease and no supervision.";
  if (a.softwareName.toLowerCase().includes("quickbooks")) return "You told me you're using QuickBooks. Wonderful. Now tell me why the books still need a chaperone.";
  if (remainder < 0) return "You brought in " + money(revenue) + " and spent " + money(expenses) + ". Baby, that's " + money(Math.abs(remainder)) + " more going out than coming in. Your budget is doing backflips without a safety net.";
  return "You brought in " + money(revenue) + " and spent " + money(expenses) + ". That's " + money(remainder) + " left on these figures. Cute. Now let's make sure the records can back it up.";
}

export function pennyRoastFor(id: string, a: IntakeAnswers): string {
  switch (id) {
    case "uncategorized-collection": return a.uncategorizedTransactions + " transactions wandering around without categories? Baby, that's not bookkeeping. That's a lost-and-found department. Start by sorting the oldest entries.";
    case "reconciliation-never-heard-of-her": return a.monthsSinceReconciliation + " months without reconciling? Your bank statement and your ledger are in a long-distance relationship, and neither one knows it's official. Reconcile the oldest month first.";
    case "ramen-reserve": return "You have " + money(a.cashOnHand) + " in cash against " + money(a.monthlyExpenses) + " in monthly expenses. Baby, your rainy-day fund is an umbrella with three holes. Start with a realistic cash cushion.";
    case "subscription-graveyard": return a.softwareSubscriptions + " software subscriptions for " + a.headcount + " people? Baby, the apps have a staff meeting and nobody invited the revenue. Audit usage before canceling anything.";
    case "overdue-invoice-choir": return money(a.overdueInvoicesTotal) + " in overdue invoices? Your customers are treating your receivables like a free lending library. Check aging and follow up on what is actually owed.";
    case "owners-draw-ocean": return "Owner draws of " + money(a.ownerDraws3mo) + " against " + money(a.netIncome3mo) + " in three-month net income? Baby, the business is not an ATM with unlimited hugs. Review how those draws are recorded.";
    case "shrinkflation-pl": return "Revenue showed up dressed for the gala, but the margin came in wearing a napkin. Review your biggest expense categories before blaming your prices.";
    case "credit-card-carousel": return a.monthsCarryingCard + " months carrying that card balance? That interest has unpacked its bags and changed the locks. Check the APR and payment terms.";
    case "shoebox-archive": return a.recordsMethod === "spreadsheet" ? "Your spreadsheet is doing its best, baby, but a formula isn't a bank reconciliation and a tab isn't an audit trail. Check the supporting records." : "Your receipts are stacked like a reality-show reunion. Somebody needs to bring order to this cardboard courtroom.";
    case "year-old-mystery": return a.monthsWithoutProfessional + " months without a professional review? Baby, that's a cold case. Bring the actual books to somebody qualified.";
    default: return "";
  }
}

export function pennyToday(a: IntakeAnswers): string {
  if (a.monthlyRevenue > 0 && a.monthlyExpenses / a.monthlyRevenue >= 0.85) return "Identify your three largest expense categories and compare them with your revenue; don't assume the difference is verified profit.";
  if (a.monthsSinceReconciliation >= 4) return "Find the oldest unreconciled bank statement and compare it with your ledger.";
  if (a.uncategorizedTransactions > 0) return "List the oldest uncategorized transactions and locate their supporting receipts.";
  if (a.recordsMethod === "spreadsheet") return "Check your spreadsheet totals against one actual bank statement.";
  return "Compare your latest bank statement with your recorded transactions.";
}
