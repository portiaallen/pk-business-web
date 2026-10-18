/** Builds the fictional sample report (founder review, 2026-10-17).
    Figures are synthetic: a small service business chosen to land tier 5. */
import { scoreIntake, tierFor, TIER_NAMES, netMarginPercent, figureCheck } from "../src/lib/auntpenny/roast-engine";
import { triggeredTemplates } from "../src/lib/auntpenny/roast-templates";
import { buildReport, nextThreeSteps, DISCLAIMER } from "../src/lib/auntpenny/report";
import { writeFileSync } from "node:fs";

const intake = {
  recordsMethod: "software" as const,
  softwareName: "QuickBooks",
  monthlyRevenue: 9000,
  monthlyExpenses: 8640,
  cashOnHand: 9800,
  monthsSinceReconciliation: 7,
  uncategorizedPercent: 18,
  uncategorizedTransactions: 30,
  overdueInvoicesTotal: 4200,
  softwareSubscriptions: 7,
  headcount: 2,
  ownerDraws3mo: 5200,
  netIncome3mo: 6480,
  cardBalanceCarried: 4200,
  monthsCarryingCard: 5,
  monthsWithoutProfessional: 30,
  firstName: "Jordan",
};

const { points, hardFlags } = scoreIntake(intake);
const tier = tierFor(points, hardFlags);
const report = buildReport(intake);
const out = {
  intake,
  marginPercent: netMarginPercent(intake),
  figureCheck: figureCheck(intake),
  points, hardFlags, tier,
  tierName: TIER_NAMES[tier],
  tierLine: report.tierLine,
  triggered: triggeredTemplates(intake),
  nextThreeSteps: nextThreeSteps(triggeredTemplates(intake)),
  bridge: report.bridge,
  disclaimer: DISCLAIMER,
};
writeFileSync("/workspace/rmb_sample_report.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ points, hardFlags, tier, tierName: out.tierName, roasts: out.triggered.length, names: out.triggered.map(t => t.id) }));
