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
  if ((a.softwareName || "").toLowerCase().includes("quickbooks")) return "You told me you're using QuickBooks. Wonderful. Now tell me why the books still need a chaperone.";
  if (remainder < 0) return "You brought in " + money(revenue) + " and spent " + money(expenses) + ". Baby, that's " + money(Math.abs(remainder)) + " more going out than coming in. Your budget is doing backflips without a safety net.";
  return "You brought in " + money(revenue) + " and spent " + money(expenses) + ". That's " + money(remainder) + " left on these figures. Cute. Now let's make sure the records can back it up.";
}

export function pennyRoastFor(id: string, a: IntakeAnswers): string {
  switch (id) {
    case "uncategorized-collection": return a.uncategorizedTransactions + " transactions wandering around without categories? Baby, that's a whole damn missing-persons unit. Your transactions are wandering around with no names, no addresses, and apparently no adult supervision. Start with the oldest receipts.";
    case "reconciliation-never-heard-of-her": return a.monthsSinceReconciliation + " months without reconciling? Your bank statement and ledger haven't spoken in so long they're legally separated. Somebody call Maury, because we need to establish which balance is the father. Start with the oldest month.";
    case "ramen-reserve": return "You have " + money(a.cashOnHand) + " in cash against " + money(a.monthlyExpenses) + " in monthly expenses. Baby, that's not a rainy-day fund. That's a cocktail napkin in a hurricane. Before you call it a cushion, check what bills are due and when.";
    case "subscription-graveyard": return a.softwareSubscriptions + " software subscriptions for " + a.headcount + " people? Those apps have formed a union, elected a president, and demanded dental benefits. Meanwhile, your revenue can't even get a seat at the meeting. Audit usage before canceling anything.";
    case "overdue-invoice-choir": return money(a.overdueInvoicesTotal) + " in overdue invoices? Your customers have turned your invoices into bedtime stories: everybody reads them, nobody pays the ending. Check the aging report before you start collecting.";
    case "owners-draw-ocean": return "Owner draws of " + money(a.ownerDraws3mo) + " against " + money(a.netIncome3mo) + " in three-month net income? The business account is not your rich auntie with a bottomless purse. That doesn't automatically make the draws wrong, but somebody needs to reconcile cash and equity before the family reunion.";
    case "shrinkflation-pl": return "Revenue showed up dressed for the gala, but the margin came in wearing a napkin. Review your biggest expense categories before blaming your prices.";
    case "credit-card-carousel": return a.monthsCarryingCard + " months carrying that card balance? That interest has moved in, changed the Wi-Fi password, and started calling itself the landlord. Check the APR and payment terms.";
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
