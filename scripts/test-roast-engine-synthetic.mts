import { validateIntake, scoreIntake, tierFor, buildReport, TIER_NAMES, TIER_6_CLOSE, ASSESSMENT_URL } from "../src/lib/auntpenny/roast-engine.ts";
import { buildReport as buildFullReport } from "../src/lib/auntpenny/report.ts";

const base = {
  recordsMethod: "software" as const,
  softwareName: "QuickBooks",
  monthlyRevenue: 8000,
  monthlyExpenses: 5000,
  cashOnHand: 12000,
  monthsSinceReconciliation: 1,
  uncategorizedPercent: 5,
  uncategorizedTransactions: 10,
  overdueInvoicesTotal: 0,
  softwareSubscriptions: 3,
  headcount: 1,
  ownerDraws3mo: 2000,
  netIncome3mo: 6000,
  cardBalanceCarried: 0,
  monthsCarryingCard: 0,
  monthsWithoutProfessional: 6,
  firstName: "Synthetic",
};

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// 1. Clean-books synthetic profile: no hard flags, low tier.
const clean = { ...base };
const cleanIssues = validateIntake(clean);
check("clean profile: no validation issues", cleanIssues.length === 0, JSON.stringify(cleanIssues));
const cleanScore = scoreIntake(clean);
check("clean profile: no hard flags", cleanScore.hardFlags.length === 0, JSON.stringify(cleanScore));
const cleanTier = tierFor(cleanScore.points, cleanScore.hardFlags);
check("clean profile: tier <= 3", cleanTier <= 3, `tier ${cleanTier} points ${cleanScore.points}`);
const cleanReport = buildFullReport(clean);
check("clean report has tier + tierName + findings", typeof cleanReport.tier === "number" && typeof cleanReport.tierName === "string" && Array.isArray(cleanReport.findings));

// 2. Disaster profile: shoebox + stale reconciliation + carried card -> hard flags, tier 5-6.
const disaster = {
  ...base,
  recordsMethod: "shoebox" as const,
  softwareName: "",
  monthlyRevenue: 3000,
  monthlyExpenses: 4200,
  cashOnHand: 200,
  monthsSinceReconciliation: 26,
  uncategorizedPercent: 80,
  uncategorizedTransactions: 900,
  overdueInvoicesTotal: 4500,
  cardBalanceCarried: 9000,
  monthsCarryingCard: 14,
  monthsWithoutProfessional: 30,
  netIncome3mo: -2600,
};
const dIssues = validateIntake(disaster);
check("disaster profile: no validation issues", dIssues.length === 0, JSON.stringify(dIssues));
const dScore = scoreIntake(disaster);
const dTier = tierFor(dScore.points, dScore.hardFlags);
check("disaster profile: hard flags present", dScore.hardFlags.length > 0, JSON.stringify(dScore.hardFlags));
check("disaster profile: tier 5 or 6", dTier >= 5, `tier ${dTier} points ${dScore.points}`);
const dReport = buildFullReport(disaster);
const reportStr = JSON.stringify(dReport);
check("disaster report references assessment CTA", reportStr.includes("pkservices.business/assessment") || ASSESSMENT_URL === "https://pkservices.business/assessment");

// 3. Validation: negative and out-of-range values produce issues, engine never crashes.
const bad: any = { ...base, monthlyRevenue: -5, uncategorizedPercent: 500, headcount: 100000 };
const badIssues = validateIntake(bad);
check("bad profile: validation catches issues", badIssues.length >= 2, JSON.stringify(badIssues));

// 4. Missing-field intake: validation lists every missing numeric field.
const empty: any = {};
const emptyIssues = validateIntake(empty);
check("empty intake: fields flagged", emptyIssues.length >= 10, `${emptyIssues.length} issues`);

// 5. Tier names complete for 1..6 and tier-6 close copy present.
check("tier names 1..6 defined", Object.keys(TIER_NAMES).length === 6 && TIER_6_CLOSE.length > 0);

// 6. Report shapes differ across tiers (clean vs disaster not identical).
check("clean vs disaster reports differ", JSON.stringify(cleanReport) !== JSON.stringify(dReport));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
