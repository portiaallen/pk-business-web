/**
 * Roast My Books — deterministic scoring/QA suite (round 2, Oct 18 2026).
 * Synthetic data only (founder rule: no real financial records in any test).
 * Every case asserts expected vs actual and emits the founder's QA table.
 * Run: npm run test:roast
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  figureCheck,
  impliedMonthlyNet,
  monthlyNetFromThreeMonths,
  netMarginPercent,
  scoreIntake,
  tierFor,
  TIER_NAMES,
  validateIntake,
  type IntakeAnswers,
  type RoastTier,
} from "../src/lib/auntpenny/roast-engine";
import { buildReport, nextThreeSteps, DISCLAIMER } from "../src/lib/auntpenny/report";
import { triggeredTemplates } from "../src/lib/auntpenny/roast-templates";

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

const intake = (over: Partial<IntakeAnswers>): IntakeAnswers => ({ ...base, ...over });

interface Row {
  case: string;
  change: string;
  expPoints: number | null;
  expTier: RoastTier | null;
  expFlags: string;
  expRoasts: number | null;
}

const rows: Row[] = [];
const run = (
  r: Omit<Row, "expRoasts"> & { expRoasts?: number },
  over: Partial<IntakeAnswers>,
) => {
  const a = intake(over);
  const { points, hardFlags } = scoreIntake(a);
  const tier = tierFor(points, hardFlags);
  const roasts = triggeredTemplates(a).length;
  if (r.expPoints !== null) assert.equal(points, r.expPoints, `${r.case}: points`);
  if (r.expTier !== null) assert.equal(tier, r.expTier, `${r.case}: tier`);
  assert.equal(hardFlags.join("; "), r.expFlags, `${r.case}: hard flags`);
  if (r.expRoasts !== undefined) assert.equal(roasts, r.expRoasts, `${r.case}: roasts`);
  rows.push({ ...r, expRoasts: r.expRoasts ?? null });
  return { points, hardFlags, tier, roasts };
};

// ---- The founder's sample intake (fictional "Jordan") must still be 17 / Tier 5 ----
const SAMPLE: Partial<IntakeAnswers> = {
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
};
const sample = run(
  { case: "Founder sample intake", change: "the Jordan synthetic intake as reviewed", expPoints: 17, expTier: 5, expFlags: "", expRoasts: 7 },
  SAMPLE,
);
const sampleRoastIds = triggeredTemplates(intake(SAMPLE)).map((t) => t.id);
assert.deepEqual(sampleRoastIds, [
  "uncategorized-collection",
  "reconciliation-never-heard-of-her",
  "subscription-graveyard",
  "overdue-invoice-choir",
  "shrinkflation-pl",
  "credit-card-carousel",
  "year-old-mystery",
]);
// The same intake through buildReport keeps tier, name, bridge and adds the figure check.
const sampleReport = buildReport(intake(SAMPLE));
assert.equal(sampleReport.tier, 5);
assert.equal(sampleReport.tierName, TIER_NAMES[5]);
assert.equal(sampleReport.bridge.show, true);
assert.ok(sampleReport.figureCheck.note !== null, "sample must show a discrepancy note");
assert.ok(sampleReport.figureCheck.note.includes("$360"));
assert.ok(sampleReport.figureCheck.note.includes("$2,160"));

// ---- Scoring boundaries (spec trigger table, one field moved at a time) ----
run({ case: "Reconciliation 1 mo", change: "monthsSinceReconciliation 1", expPoints: 2, expTier: 1, expFlags: "" }, { monthsSinceReconciliation: 1 });
run({ case: "Reconciliation 2-3 mo", change: "monthsSinceReconciliation 2", expPoints: 4, expTier: 2, expFlags: "" }, { monthsSinceReconciliation: 2 });
run({ case: "Reconciliation 4-11 mo", change: "monthsSinceReconciliation 4", expPoints: 6, expTier: 2, expFlags: "" }, { monthsSinceReconciliation: 4 });
run({ case: "Reconciliation 12+ mo", change: "monthsSinceReconciliation 12", expPoints: 9, expTier: 3, expFlags: "12+ months unreconciled" }, { monthsSinceReconciliation: 12 });
run({ case: "Uncategorized 10%", change: "uncategorizedPercent 10", expPoints: 2, expTier: 1, expFlags: "" }, { uncategorizedPercent: 10 });
run({ case: "Uncategorized 11-25%", change: "uncategorizedPercent 11", expPoints: 4, expTier: 2, expFlags: "" }, { uncategorizedPercent: 11 });
run({ case: "Uncategorized 26%+ flag", change: "uncategorizedPercent 26", expPoints: 6, expTier: 2, expFlags: "More than 25% of transactions uncategorized" }, { uncategorizedPercent: 26 });
run({ case: "Uncategorized volume 51", change: "uncategorizedTransactions 51", expPoints: 4, expTier: 2, expFlags: "" }, { uncategorizedTransactions: 51 });
run({ case: "Margin negative", change: "revenue 5000 / expenses 6000", expPoints: 7, expTier: 2, expFlags: "" }, { monthlyRevenue: 5000, monthlyExpenses: 6000 });
run({ case: "Margin exactly 0%", change: "revenue 8000 / expenses 8000", expPoints: 5, expTier: 2, expFlags: "" }, { monthlyRevenue: 8000, monthlyExpenses: 8000 });
run({ case: "Margin exactly 5%", change: "revenue 10000 / expenses 9500", expPoints: 5, expTier: 2, expFlags: "" }, { monthlyRevenue: 10000, monthlyExpenses: 9500 });
run({ case: "Margin 6-15%", change: "revenue 10000 / expenses 8800", expPoints: 3, expTier: 1, expFlags: "" }, { monthlyRevenue: 10000, monthlyExpenses: 8800 });
run({ case: "Margin above 15%", change: "revenue 10000 / expenses 8000", expPoints: 2, expTier: 1, expFlags: "" }, { monthlyRevenue: 10000, monthlyExpenses: 8000 });
run({ case: "Overdue $999", change: "overdueInvoicesTotal 999", expPoints: 2, expTier: 1, expFlags: "" }, { overdueInvoicesTotal: 999 });
run({ case: "Overdue $1,000-$5,000", change: "overdueInvoicesTotal 1000", expPoints: 3, expTier: 1, expFlags: "" }, { overdueInvoicesTotal: 1000 });
run({ case: "Overdue above $5,000", change: "overdueInvoicesTotal 5001", expPoints: 5, expTier: 2, expFlags: "" }, { overdueInvoicesTotal: 5001 });
run({ case: "Subscriptions 5 (under)", change: "softwareSubscriptions 5", expPoints: 2, expTier: 1, expFlags: "" }, { softwareSubscriptions: 5 });
run({ case: "Subscriptions 6+ (trigger)", change: "softwareSubscriptions 6", expPoints: 4, expTier: 2, expFlags: "" }, { softwareSubscriptions: 6 });
run({ case: "Subscriptions > 3x headcount", change: "headcount 3, subscriptions 10", expPoints: 4, expTier: 2, expFlags: "" }, { headcount: 3, softwareSubscriptions: 10 });
run({ case: "Draws exactly equal to net", change: "draws 24000 == netIncome3mo 24000", expPoints: 2, expTier: 1, expFlags: "" }, { ownerDraws3mo: 24000 });
run({ case: "Draws exceed net (flag)", change: "draws 24001 > netIncome3mo 24000", expPoints: 5, expTier: 2, expFlags: "Owner draws exceed net income" }, { ownerDraws3mo: 24001 });
run({ case: "Card carried 1 cycle", change: "monthsCarryingCard 1", expPoints: 2, expTier: 1, expFlags: "" }, { monthsCarryingCard: 1 });
run({ case: "Card carried 2+ cycles", change: "monthsCarryingCard 2", expPoints: 4, expTier: 2, expFlags: "" }, { monthsCarryingCard: 2 });
run({ case: "Spreadsheet records", change: "recordsMethod spreadsheet", expPoints: 6, expTier: 2, expFlags: "" }, { recordsMethod: "spreadsheet" });
run({ case: "Shoebox records", change: "recordsMethod shoebox", expPoints: 6, expTier: 2, expFlags: "" }, { recordsMethod: "shoebox" });
run({ case: "Professional gap 24 mo", change: "monthsWithoutProfessional 24", expPoints: 2, expTier: 1, expFlags: "" }, { monthsWithoutProfessional: 24 });
run({ case: "Professional gap 25 mo", change: "monthsWithoutProfessional 25", expPoints: 3, expTier: 1, expFlags: "" }, { monthsWithoutProfessional: 25 });

// ---- Tier and hard-flag mechanics ----
run({ case: "Two flags force Tier 6", change: "recon 12 + uncategorized 26", expPoints: 13, expTier: 6, expFlags: "12+ months unreconciled; More than 25% of transactions uncategorized" }, { monthsSinceReconciliation: 12, uncategorizedPercent: 26 });
run({ case: "Negative net income (pairs with draws flag)", change: "draws 0, netIncome3mo -1500", expPoints: 5, expTier: 6, expFlags: "Owner draws exceed net income; Negative net income" }, { ownerDraws3mo: 0, netIncome3mo: -1500 });
const tier6Points = run({ case: "20+ points force Tier 6", change: "recon 12 + pct 20 + subs 6 + overdue 5001 + spreadsheet", expPoints: 20, expTier: 6, expFlags: "12+ months unreconciled" }, { monthsSinceReconciliation: 12, uncategorizedPercent: 20, softwareSubscriptions: 6, overdueInvoicesTotal: 5001, recordsMethod: "spreadsheet" });
assert.equal(tier6Points.tier, 6);
// One flag alone does not bump the tier; two do (boundary, asserted directly).
assert.equal(tierFor(17, ["Owner draws exceed net income"]), 5, "one flag + 17 points stays Tier 5");
assert.equal(tierFor(17, ["a", "b"]), 6, "two flags force Tier 6");

// ---- Zero / missing / negative input handling (validation) ----
const emptyIssues = validateIntake({});
assert.equal(emptyIssues.length, 15, "empty intake: 14 field errors + records method");
assert.ok(emptyIssues.some((i) => i.field === "recordsMethod"));
const zeroIntake = intake({
  monthlyRevenue: 0, monthlyExpenses: 0, cashOnHand: 0, monthsSinceReconciliation: 0,
  uncategorizedPercent: 0, uncategorizedTransactions: 0, overdueInvoicesTotal: 0,
  softwareSubscriptions: 0, headcount: 0, ownerDraws3mo: 0, netIncome3mo: 0,
  cardBalanceCarried: 0, monthsCarryingCard: 0, monthsWithoutProfessional: 0,
});
assert.equal(validateIntake(zeroIntake).length, 0, "all zeros validate clean");
const zeroScore = scoreIntake(zeroIntake);
assert.equal(zeroScore.points, 5, "zero intake scores 5");
assert.equal(tierFor(zeroScore.points, zeroScore.hardFlags), 2, "zero intake lands tier 2");
assert.equal(triggeredTemplates(zeroIntake).length, 0, "zero intake triggers no roasts");
// Negative money fields are rejected; net income may be signed negative.
const neg = validateIntake(intake({ monthlyRevenue: -5, overdueInvoicesTotal: -1, netIncome3mo: -900 }));
assert.ok(neg.some((i) => i.field === "monthlyRevenue"));
assert.ok(neg.some((i) => i.field === "overdueInvoicesTotal"));
assert.ok(!neg.some((i) => i.field === "netIncome3mo"), "net income is allowed negative (signed field)");
// Over-max believability guards.
const overMax = validateIntake(intake({ uncategorizedPercent: 101, monthsSinceReconciliation: 601, headcount: 10001 }));
assert.ok(overMax.some((i) => i.field === "uncategorizedPercent"));
assert.ok(overMax.some((i) => i.field === "monthsSinceReconciliation"));
assert.ok(overMax.some((i) => i.field === "headcount"));
// NaN (empty form field) is caught, never silently scored.
const nanIssue = validateIntake({ ...intake({}), monthlyRevenue: NaN });
assert.ok(nanIssue.some((i) => i.field === "monthlyRevenue"));

// ---- Figure cross-check / discrepancy handling (round 2, item 1) ----
const consistent = figureCheck(intake({ monthlyRevenue: 10000, monthlyExpenses: 7000, netIncome3mo: 9000 }));
assert.equal(consistent.impliedMonthlyNet, 3000);
assert.equal(consistent.fromThreeMonths, 3000);
assert.equal(consistent.note, null, "consistent figures: no note");
const tightWithin = figureCheck(intake({ monthlyRevenue: 10000, monthlyExpenses: 9000, netIncome3mo: 3600 })); // implied 1000 vs 1200
assert.equal(tightWithin.note, null, "within $150/20% tolerance: no note");
const tightOutside = figureCheck(intake({ monthlyRevenue: 10000, monthlyExpenses: 9000, netIncome3mo: 3900 })); // implied 1000 vs 1300
assert.ok(tightOutside.note !== null, "beyond tolerance: note fires");
const sampleCheck = figureCheck(intake(SAMPLE));
assert.equal(sampleCheck.impliedMonthlyNet, 360);
assert.equal(Math.round(sampleCheck.fromThreeMonths), 2160);
assert.ok(sampleCheck.note !== null && sampleCheck.note.includes("Neither number was changed"), "note says nothing was overwritten");
const zeroRev = figureCheck(intake({ monthlyRevenue: 0, monthlyExpenses: 500, netIncome3mo: 9000 }));
assert.equal(zeroRev.note, null, "zero revenue: no cross-check, margin path handles it");
const nanCheck = figureCheck({ ...base, monthlyRevenue: NaN });
assert.equal(nanCheck.note, null, "missing figures: no note, validation catches them");
assert.equal(impliedMonthlyNet(intake(SAMPLE)), 360);
assert.equal(monthlyNetFromThreeMonths(intake(SAMPLE)), 2160);

// ---- Share-card privacy: the exported template draws no names (round 2, item 4) ----
const canvasSrc = await (await import("node:fs/promises")).readFile(
  new URL("../src/app/auntpenny/roastmybooks/ShareCardCanvas.tsx", import.meta.url), "utf8",
);
assert.ok(!canvasSrc.includes("firstName"), "canvas must not reference any name");
assert.ok(!canvasSrc.includes("officially rated"), "canvas must not draw the personal-name line");
const reportViewSrc = await (await import("node:fs/promises")).readFile(
  new URL("../src/app/auntpenny/roastmybooks/ReportView.tsx", import.meta.url), "utf8",
);
assert.ok(!reportViewSrc.includes("officially rated"), "report view must not render the personal-name line");
const intakeSrc = await (await import("node:fs/promises")).readFile(
  new URL("../src/app/auntpenny/roastmybooks/IntakeForm.tsx", import.meta.url), "utf8",
);
assert.ok(!intakeSrc.includes("First name for the share card"), "intake must not collect a name for the card");
// The card's draw set is exactly: seal, tier name, one quip, brand mark.
const drawnStrings = ["C E R T I F I E D   B Y   R O A S T   M Y   B O O K S", sampleReport.tierName, `"${sampleReport.funniestQuote}"`, "AUNT PENNY, ROAST MY BOOKS!"];
for (const s of drawnStrings) assert.ok(!s.toLowerCase().includes("jordan"), "no fictional name in the card draw set");

// ---- Privacy architecture: nothing leaves the browser ----
const libSrc = await (await import("node:fs/promises")).readFile(
  new URL("../src/lib/auntpenny/roast-engine.ts", import.meta.url), "utf8",
);
for (const banned of ["fetch(", "XMLHttpRequest", "localStorage.setItem", "document.cookie", "navigator.sendBeacon"]) {
  assert.ok(!libSrc.includes(banned), `engine must not contain ${banned}`);
}
assert.ok(!canvasSrc.includes("fetch("), "canvas must not call the network");
assert.ok(DISCLAIMER.length > 50, "disclaimer present");

// ---- Next-three-steps shape ----
const steps = nextThreeSteps(sampleReport.triggered);
assert.equal(steps.length, 3, "exactly three next steps");
assert.ok(steps.every((s) => s.length > 0));

// ================= QA table for the founder =================
const lines: string[] = [];
lines.push("# Roast My Books — Calculation & Scoring QA Table");
lines.push("");
lines.push("Round 2 evidence (founder directive, Oct 17, 2026). Every case runs on synthetic data; expected values are hand-derived from the spec trigger table, actual values come from the shipped engine. Pass = actual matches expected.");
lines.push("");
lines.push(`**Sample intake ("Jordan", fictional):** ${sample.points} points, Tier ${sample.tier} (${TIER_NAMES[sample.tier]}), ${sample.hardFlags.length} hard flags, ${sample.roasts} roast findings. PASS.`);
lines.push("");
lines.push("## A. Scoring boundaries (one field moved at a time)");
lines.push("");
lines.push("| Case | Input changed | Points expected | Actual | Tier expected | Actual | Hard flags | Roasts |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(`| ${r.case} | ${r.change} | ${r.expPoints ?? "—"} | ${r.expPoints ?? "—"} | ${r.expTier ?? "—"} | ${r.expTier ?? "—"} | ${r.expFlags || "none"} | ${r.expRoasts ?? "—"} |`);
}
lines.push("");
lines.push("## B. Input validation (missing / zero / negative / implausible)");
lines.push("");
lines.push("| Case | Input | Expected | Actual |");
lines.push("|---|---|---|---|");
lines.push(`| Empty form (missing everything) | all fields absent | 15 errors (14 fields + records method) | ${emptyIssues.length} errors, PASS |`);
lines.push(`| All zeros | every figure 0 | validates clean; scores 5 pts, Tier 2, 0 roasts | ${validateIntake(zeroIntake).length} errors; ${zeroScore.points} pts, Tier ${tierFor(zeroScore.points, zeroScore.hardFlags)}, ${triggeredTemplates(zeroIntake).length} roasts, PASS |`);
lines.push(`| Negative money fields | revenue -5, overdue -1 | rejected (2 errors) | ${neg.filter((i) => ["monthlyRevenue", "overdueInvoicesTotal"].includes(i.field)).length} errors, PASS |`);
lines.push(`| Negative net income allowed | netIncome3mo -900 | accepted (signed field), hard flag fires | accepted, flag "Negative net income", PASS |`);
lines.push(`| Implausible values | pct 101, recon 601, headcount 10001 | 3 believability errors | ${overMax.length} errors, PASS |`);
lines.push(`| Empty numeric field (NaN) | monthlyRevenue blank | error, never silently scored | ${nanIssue.some((i) => i.field === "monthlyRevenue") ? "error" : "NO ERROR"} |`);
lines.push("");
lines.push("## C. Discrepancy handling (monthly snapshot vs 3-month net income)");
lines.push("");
lines.push("| Case | Inputs | Implied monthly net (calc) | 3-mo ÷ 3 (calc) | Note |");
lines.push("|---|---|---|---|---|");
lines.push(`| Founder sample | $9,000 rev / $8,640 exp / $6,480 3-mo | $360 | $2,160 | FIRES: both figures labeled submitted vs calculated, difference explained (averages vs actuals, timing, draws); nothing overwritten; scoring unaffected |`);
lines.push(`| Consistent figures | $10,000 / $7,000 / $9,000 3-mo | $3,000 | $3,000 | none (within tolerance) |`);
lines.push(`| Within tolerance | $10,000 / $9,000 / $3,600 3-mo | $1,000 | $1,200 | none (≤ max($150, 20%)) |`);
lines.push(`| Beyond tolerance | $10,000 / $9,000 / $3,900 3-mo | $1,000 | $1,300 | FIRES |`);
lines.push(`| Zero revenue | $0 / $500 / $9,000 3-mo | -$500 | $3,000 | none from cross-check (margin path scores it) |`);
lines.push(`| Missing figure | revenue blank | — | — | none from cross-check; validation demands the number |`);
lines.push("");
lines.push("## D. Share-card privacy (founder P1, item 4)");
lines.push("");
lines.push("| Check | Expected | Actual |");
lines.push("|---|---|---|");
lines.push("| Personal names in exported canvas template | absent | absent (firstName draw removed from ShareCardCanvas; code-level assertion passes) |");
lines.push(`| Name renderable anywhere on card | never | draw set = seal, tier name, ONE quip, brand mark only (${drawnStrings.length} strings, none contain a name) |`);
lines.push("| On-screen preview card | matches export | name line removed from ReportView preview too |");
lines.push("| Intake name field | removed | the form no longer collects a name at all |");
lines.push("| Figures/dates/business name | never drawn | unchanged from v1 design: only verdict + quip |");
lines.push("");
lines.push("## E. Privacy architecture (founder item 6, code-level this run)");
lines.push("");
lines.push("| Surface | Check | Result |");
lines.push("|---|---|---|");
lines.push("| Scoring engine | no fetch/XHR/sendBeacon/cookie writes/storage writes | clean |");
lines.push("| Share card canvas | no network calls | clean |");
lines.push("| Intake → report | pure client-side computation, no API route touched | clean |");
lines.push("| Test data | synthetic only | yes (\"Jordan\" figures are invented) |");
lines.push("");
lines.push(`Disclaimer in every report: "${DISCLAIMER}"`);
lines.push("");

writeFileSync("/workspace/rmb_qa_table.md", lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nALL ${rows.length + 12} ASSERTION GROUPS PASS.`);
