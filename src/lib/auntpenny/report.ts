/**
 * Roast My Books — report assembly.
 * Merges the scored intake with the roast templates into the deliverable
 * described in MVP spec v0.1 section 3: verdict, roast, accurate meanings,
 * next three steps, the bridge (tiers 3+), and the mandatory disclaimer.
 */
import {
  ASSESSMENT_URL,
  figureCheck,
  TIER_6_CLOSE,
  TIER_NAMES,
  scoreIntake,
  tierFor,
  type FigureCheck,
  type Finding,
  type IntakeAnswers,
  type RoastReport,
  type RoastTier,
  type TriggeredTemplate,
} from "./roast-engine";
import { evidenceFor, triggeredTemplates } from "./roast-templates";

export const DISCLAIMER =
  "Educational entertainment based on the figures you provided. This is not a review of your actual records, and it is not accounting, tax, or professional advice. Unusual numbers are not the same as errors; a professional looks at real books, not a form.";

const TIER_LINES: Record<RoastTier, string> = {
  1: "Books basically fine. Dust on the dashboard.",
  2: "Real drift, nothing criminal.",
  3: "A weekend of work changes this.",
  4: "The pieces exist; the order does not.",
  5: "Systemic. This needs a professional's calendar.",
  6: "The exorcism tier.",
};

const TIER_1_ROAST = ["Your books are basically fine. There's dust on the dashboard, nothing more."];
const TIER_1_QUIP = "Suspiciously well-behaved books. We'll be watching.";

export function buildReport(a: IntakeAnswers): RoastReport {
  const { points, hardFlags } = scoreIntake(a);
  const tier = tierFor(points, hardFlags);
  const triggered = triggeredTemplates(a);

  // The Roast: two to four lines, keyed to the templates their numbers triggered.
  const roastLines: string[] = tier === 1 && triggered.length === 0 ? TIER_1_ROAST : [];
  for (const t of triggered) for (const line of t.roastLines) if (roastLines.length < 4) roastLines.push(line);

  // Share card quip: funniest of the triggered set (first triggered), tier 1 fallback included.
  const funniestQuote = triggered.length > 0 ? triggered[0].quip : TIER_1_QUIP;

  // The Bridge, tiers 3+ only. Tier 6 closes with the founder-approved composite line.
  let bridge = { show: false, line: "" };
  if (tier === 6) {
    bridge = { show: true, line: `The exorcism is available, and it starts with an assessment. ${TIER_6_CLOSE}` };
  } else if (tier >= 3) {
    bridge = {
      show: true,
      line: `If you'd rather have a professional actually read the books, that's what the $99 Business & Tax Season Readiness Assessment is for: ${ASSESSMENT_URL}`,
    };
  }

  // Per-finding guidance: traceable to the submitted values, conditional next
  // moves, explicit help thresholds (founder round-2 directive).
  const findings: Finding[] = [];
  for (const t of triggered) {
    if (!t.guidance) continue;
    findings.push({
      id: t.id,
      title: t.title,
      evidence: evidenceFor(t.id, a),
      matters: t.guidance.matters,
      check: t.guidance.check,
      next: t.guidance.next,
      help: t.guidance.help,
    });
  }

  return {
    tier,
    tierName: TIER_NAMES[tier],
    points,
    hardFlags,
    triggered,
    funniestQuote,
    bridge,
    tierLine: TIER_LINES[tier],
    figureCheck: figureCheck(a),
    findings,
  };
}

/** Next three steps: the triggered templates' steps, ranked in trigger order, capped at three. */
export function nextThreeSteps(triggered: TriggeredTemplate[]): string[] {
  const steps: string[] = [];
  for (const t of triggered) for (const s of t.steps) if (steps.length < 3) steps.push(s);
  return steps;
}
