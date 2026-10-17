/**
 * Roast My Books engine tests on synthetic data only (founder rule: no real
 * financial records in any test or preview). Run: npm run test:roast
 */
import assert from "node:assert/strict";
import { buildReport, nextThreeSteps } from "../src/lib/auntpenny/report";
import { TIER_NAMES, validateIntake, type IntakeAnswers } from "../src/lib/auntpenny/roast-engine";
import { ROAST_TEMPLATES, triggeredTemplates } from "../src/lib/auntpenny/roast-templates";

const base: IntakeAnswers = {
  recordsMethod: "software",
  softwareName: "QuickBooks",
  monthlyRevenue: 20000,
  monthlyExpenses: 12000,
  cashOnHand: 30000,
  monthsSinceReconciliation: 1,
  uncategorizedPercent: 5,
  uncategorizedTransactions: 10,
  overdueInvoicesTotal: 0,
  softwareSubscriptions: 2,
  headcount: 2,
  ownerDraws3mo: 10000,
  netIncome3mo: 24000,
  cardBalanceCarried: 0,
  monthsCarryingCard: 0,
  monthsWithoutProfessional: 3,
  firstName: "",
};

const clean = { ...base };
const t1 = buildReport(clean);
assert.equal(t1.tier, 1);
assert.equal(t1.tierName, "A Mild Side-Eye");
assert.equal(t1.bridge.show, false);

// Tier 2: spreadsheet method (+4) + uncategorized 5% (+1) = 5 points.
const t2 = buildReport({ ...base, recordsMethod: "spreadsheet" });
assert.equal(t2.tier, 2);
assert.equal(t2.tierName, "The Numbers Have Left the Congregation");
assert.ok(t2.triggered.some((x) => x.id === "shoebox-archive"));

// Tier 3: subs 7 (+2), overdue 3000 (+2), card 3mo (+2), uncategorized 8% (+1), pro gap 30 (+1) = 8.
const t3 = buildReport({
  ...base,
  softwareSubscriptions: 7,
  overdueInvoicesTotal: 3000,
  monthsCarryingCard: 3,
  cardBalanceCarried: 1500,
  uncategorizedPercent: 8,
  monthsWithoutProfessional: 30,
});
assert.equal(t3.tier, 3);
assert.equal(t3.bridge.show, true);
assert.ok(t3.bridge.line.includes("assessment"));

// Tier 4: recon 6 (+4), spreadsheet (+4), overdue 6000 (+4), subs 6 (+2), uncategorized 5% (+1) = 15.
const t4 = buildReport({
  ...base,
  recordsMethod: "spreadsheet",
  monthsSinceReconciliation: 6,
  overdueInvoicesTotal: 6000,
  softwareSubscriptions: 6,
});
assert.equal(t4.tier, 4);
assert.equal(t4.tierName, "Financial Chaos With Good Bone Structure");

// Tier 5: recon 10 (+4), spreadsheet (+4), uncategorized 20% (+3), overdue 3000 (+2), subs 6 (+2), card 2 (+2) = 17.
const t5 = buildReport({
  ...base,
  recordsMethod: "spreadsheet",
  monthsSinceReconciliation: 10,
  uncategorizedPercent: 20,
  uncategorizedTransactions: 90,
  overdueInvoicesTotal: 3000,
  softwareSubscriptions: 6,
  monthsCarryingCard: 2,
});
assert.equal(t5.tier, 5);

// Tier 6 via two hard flags: 12+ months unreconciled + >25% uncategorized.
const t6flags = buildReport({ ...base, monthsSinceReconciliation: 14, uncategorizedPercent: 40 });
assert.equal(t6flags.tier, 6);
// Founder's exact severity wording, verbatim, period included.
assert.equal(TIER_NAMES[6], "Your QuickBooks Need A Divine Intervention.");
assert.ok(t6flags.bridge.line.includes("exorcisms are booked through the assessment"));

// Tier 6 via points: everything on fire.
const t6points = buildReport({
  ...base,
  recordsMethod: "shoebox",
  monthlyRevenue: 1000,
  monthlyExpenses: 2000,
  cashOnHand: 50,
  monthsSinceReconciliation: 12,
  uncategorizedPercent: 100,
  uncategorizedTransactions: 300,
  overdueInvoicesTotal: 10000,
  softwareSubscriptions: 6,
  ownerDraws3mo: 9000,
  netIncome3mo: -3000,
  cardBalanceCarried: 8000,
  monthsCarryingCard: 12,
  monthsWithoutProfessional: 30,
});
assert.equal(t6points.tier, 6);
assert.ok(t6points.hardFlags.length >= 3);

// Negative net income alone is a hard flag but not two flags: tier still point-driven.
const negIncome = buildReport({ ...base, netIncome3mo: -500 });
assert.equal(negIncome.tier, 6); // points: base 1 + margin negative 5 + draws>income 3 = 9, plus flags(2) -> tier 6
// Wait: draws 10000 > income -500 also flags. Two flags force tier 6. Assert the flags:
assert.equal(negIncome.hardFlags.length, 2);

// Template trigger checks.
assert.ok(triggeredTemplates({ ...base, cashOnHand: 100 }).some((t) => t.id === "ramen-reserve"));
assert.ok(triggeredTemplates({ ...base }).every((t) => !t.id.startsWith("ramen")));
assert.ok(
  triggeredTemplates({ ...base, monthlyRevenue: 5000, monthlyExpenses: 4900 }).some((t) => t.id === "shrinkflation-pl"),
);
assert.ok(triggeredTemplates({ ...base, monthsWithoutProfessional: 25 }).some((t) => t.id === "year-old-mystery"));
assert.ok(triggeredTemplates({ ...base, ownerDraws3mo: 30000 }).some((t) => t.id === "owners-draw-ocean"));
assert.equal(ROAST_TEMPLATES.length, 10);

// Steps cap at three and come from triggered templates.
assert.ok(nextThreeSteps(t6points.triggered).length === 3);

// Validation: negatives and impossible ceilings rejected.
const issues = validateIntake({ ...base, monthlyRevenue: -5, uncategorizedPercent: 150 });
assert.ok(issues.some((i) => i.field === "monthlyRevenue"));
assert.ok(issues.some((i) => i.field === "uncategorizedPercent"));

console.log("roast-engine: all assertions passed");
