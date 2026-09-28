import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { getEngagementContext, renderContextForPrompt } from "@/lib/ai/context";
import { selectRelevantQuestions, type TriggerCondition } from "@/lib/ai/question-library";
import { logAiActivity } from "@/lib/ai/activity";

/**
 * PK AI Assistant — Initial Review Engine.
 *
 * MVP data sources (all existing PK structures — no fabrication):
 *  - Manual QbCleanupReview checklist items/findings/questions/doc logs
 *  - Documents uploaded to the engagement
 *  - Engagement scope/context (client notes, service, invoices)
 *
 * The MVP rule engine derives findings from recorded manual-review state and
 * detected scope conditions; when ANTHROPIC_API_KEY is configured, Claude
 * enhances the summary and produces prioritized narrative recommendations.
 * It NEVER invents transaction data that is not present in the portal.
 */

export type EngineFinding = {
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  evidence?: string;
  relatedAccounts?: string;
  recommendation?: string;
  source: "AI_GENERATED" | "SYSTEM_GENERATED";
  checklistItemKey?: string;
  estimatedHours?: number;
  status?:
    | "NEEDS_REVIEW"
    | "NEEDS_INVESTIGATION"
    | "POTENTIAL_CLEANUP"
    | "CLIENT_CLARIFICATION"
    | "OUT_OF_SCOPE";
};

export type EngineResult = {
  requestId: string;
  engine: string;
  summary: string;
  findings: EngineFinding[];
  scopeAlerts: Array<{
    description: string;
    evidence?: string;
    estimatedHours?: number;
  }>;
  relevantQuestions: {
    keys: string[];
    skippedCount: number;
  };
  triggers: TriggerCondition[];
};

async function log(
  reviewId: string,
  action: string,
  detail: string,
  actorType: "AI_GENERATED" | "SYSTEM_GENERATED" = "SYSTEM_GENERATED"
) {
  await logAiActivity(reviewId, action, detail, actorType, null);
}

/** Collect trigger conditions from recorded manual-review state. */
async function collectTriggers(requestId: string): Promise<{
  triggers: Set<TriggerCondition>;
  findings: EngineFinding[];
}> {
  const triggers = new Set<TriggerCondition>();
  const findings: EngineFinding[] = [];

  const review = await prisma.qbCleanupReview.findUnique({
    where: { requestId },
    include: {
      checklistItems: { include: { checklist: true } },
      findings: true,
      docLogs: true,
    },
  });

  if (!review) {
    // No manual review yet — only core questions apply.
    triggers.add("ALWAYS");
    return { triggers, findings };
  }

  const byKey = new Map<string, { status: string; notes: string | null }>();
  for (const item of review.checklistItems) {
    byKey.set(item.checklist.itemKey, { status: item.status, notes: item.notes });
  }

  const isProblem = (key: string) => {
    const s = byKey.get(key)?.status;
    return s === "NEEDS_INVESTIGATION" || s === "CLEANUP" || s === "CRITICAL";
  };

  // Map recorded manual-review state to triggers + findings.
  const mapping: Array<{ keys: string[]; trigger: TriggerCondition; category: string; description: string }> = [
    { keys: ["rec-months-missing", "rec-discrepancies", "rec-status-all"], trigger: "UNRECONCILED", category: "Reconciliations", description: "Reconciliation issues were flagged during the manual review — accounts may not be fully reconciled for the engagement period." },
    { keys: ["uncategorized-bank", "uncategorized-expense"], trigger: "UNCATEGORIZED_TXNS", category: "Transactions", description: "Uncategorized or 'Ask My Accountant' transactions were identified — these require classification before statements are reliable." },
    { keys: ["personal-cc-list", "personal-cc-classification", "personal-nonbusiness"], trigger: "PERSONAL_CARD_ACTIVITY", category: "Personal/Business", description: "Business expenses paid through a personal credit card were identified — classification and treatment require review." },
    { keys: ["owner-draws", "owner-contributions"], trigger: "OWNER_DRAWS_CONTRIBS", category: "Equity", description: "Owner draw or contribution activity was flagged — equity treatment requires professional review." },
    { keys: ["pr-journal", "pr-wage-mismatch", "pr-liabilities"], trigger: "PAYROLL_ACTIVITY", category: "Payroll", description: "Payroll activity was flagged — recorded wages and liabilities should be compared to payroll filings." },
    { keys: ["pr-contractors"], trigger: "CONTRACTOR_ACTIVITY", category: "Payroll", description: "Contractor payments were flagged — 1099 review is indicated." },
    { keys: ["ar-aging", "ar-old-invoices"], trigger: "AR_ACTIVITY", category: "Accounts Receivable", description: "Accounts receivable items were flagged — aging and collectability require review." },
    { keys: ["ap-aging", "ap-old-bills"], trigger: "AP_ACTIVITY", category: "Accounts Payable", description: "Accounts payable items were flagged — old or possibly-paid bills require review." },
    { keys: ["st-agency", "st-filings"], trigger: "SALES_TAX_ACTIVITY", category: "Sales Tax", description: "Sales tax activity was flagged — liability balances and filings should be verified." },
    { keys: ["fa-list", "fa-depreciation"], trigger: "FIXED_ASSETS", category: "Fixed Assets", description: "Fixed asset activity was flagged — additions and depreciation require review." },
    { keys: ["loans-principal", "loans-balances"], trigger: "LOANS_LIABILITIES", category: "Loans & Liabilities", description: "Loan/liability items were flagged — principal/interest splits and balances require review." },
    { keys: ["negative-balances", "unusual-balances", "pl-negative"], trigger: "NEGATIVE_BALANCES", category: "Balances", description: "Negative or unusual balances were identified — these may indicate misclassifications or refunds." },
    { keys: ["rf-duplicates", "duplicate-expenses"], trigger: "DUPLICATE_SUSPECTED", category: "Duplicates", description: "Potential duplicate transactions were flagged — review as a group before any cleanup." },
    { keys: ["large-expenses", "pl-unusual", "income-trends"], trigger: "UNUSUAL_AMOUNTS", category: "Unusual Activity", description: "Unusual amounts or patterns were identified — these may be legitimate but warrant explanation." },
    { keys: ["transfers"], trigger: "TRANSFERS", category: "Transfers", description: "Inter-account transfers were flagged — unmatched transfer pairs require review." },
    { keys: ["inactive-accounts"], trigger: "INACTIVE_ACCOUNT_ACTIVITY", category: "Chart of Accounts", description: "Inactive accounts with period activity were detected — activity may be misclassified." },
    { keys: ["docs-gaps", "docs-statements", "docs-received"], trigger: "DOCUMENTS_GAPS", category: "Documentation", description: "Documentation gaps were identified — some requested records have not been received." },
  ];

  for (const m of mapping) {
    if (m.keys.some(isProblem)) {
      triggers.add(m.trigger);
      const evidenceKeys = m.keys.filter(isProblem);
      findings.push({
        category: m.category,
        priority: m.category === "Reconciliations" || m.category === "Personal/Business" ? "HIGH" : "MEDIUM",
        description: m.description,
        evidence: JSON.stringify({
          source: "manual-review-checklist",
          flaggedItems: evidenceKeys.map((k) => ({
            key: k,
            title: review.checklistItems.find((i) => i.checklist.itemKey === k)?.checklist.title,
            notes: byKey.get(k)?.notes ?? undefined,
          })),
        }),
        recommendation: `Review the flagged ${m.category.toLowerCase()} items and record your professional judgment.`,
        source: "SYSTEM_GENERATED",
        checklistItemKey: evidenceKeys[0],
        status: "NEEDS_REVIEW",
      });
    }
  }

  // Manual findings that are still open become findings in their own right.
  for (const f of review.findings) {
    if (f.status === "NEEDS_INVESTIGATION" || f.status === "CLEANUP" || f.status === "CRITICAL") {
      const priority =
        f.status === "CRITICAL" ? "HIGH" : f.status === "CLEANUP" ? "MEDIUM" : "MEDIUM";
      findings.push({
        category: "Manual Review Finding",
        priority: priority as EngineFinding["priority"],
        description: f.finding + (f.notes ? ` — Note: ${f.notes}` : ""),
        evidence: JSON.stringify({ source: "manual-review-finding", checklistItemId: f.checklistItemId }),
        recommendation: "Assess this recorded finding and decide next steps.",
        source: "SYSTEM_GENERATED",
        status: f.status === "CRITICAL" ? "NEEDS_INVESTIGATION" : "POTENTIAL_CLEANUP",
      });
    }
  }

  triggers.add("ALWAYS");
  return { triggers, findings };
}

/** Detect scope conditions: hours worked vs quoted, and doc/period mismatches. */
async function detectScopeAlerts(requestId: string): Promise<
  Array<{ description: string; evidence?: string; estimatedHours?: number }>
> {
  const ctx = await getEngagementContext(requestId);
  const alerts: Array<{ description: string; evidence?: string; estimatedHours?: number }> = [];

  if (ctx.financialExpectations.quotedHours !== null && ctx.workTracking.hoursWorked > ctx.financialExpectations.quotedHours) {
    alerts.push({
      description: `Hours worked (${ctx.workTracking.hoursWorked}) have exceeded the quoted estimate (${ctx.financialExpectations.quotedHours}). This does not automatically mean out-of-scope work — the original estimate was preliminary — but the engagement scope should be confirmed with the client before continuing.`,
      evidence: JSON.stringify({
        quotedHours: ctx.financialExpectations.quotedHours,
        hoursWorked: ctx.workTracking.hoursWorked,
        rateCents: ctx.financialExpectations.hourlyRateCents,
      }),
    });
  }

  return alerts;
}

/** Optional Claude enhancement of the summary. Returns null if not configured. */
async function claudeSummary(ctxText: string, findings: EngineFinding[]): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const findingList = findings
      .slice(0, 25)
      .map((f) => `- [${f.priority}] ${f.category}: ${f.description}`)
      .join("\n");
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      system:
        "You are the PK Business Services AI bookkeeping analyst. You write concise advisor-facing initial-review summaries. " +
        "Rules: use tentative language ('potential', 'appears', 'requires review'); never assert an error exists; " +
        "never claim work is complete; base every statement ONLY on the data provided; end with recommended next steps as a numbered list. " +
        "Format as short markdown sections.",
      messages: [
        {
          role: "user",
          content: `Engagement context:\n${ctxText}\n\nDetected findings:\n${findingList || "(none recorded yet)"}\n\nWrite the Initial Review Summary.`,
        },
      ],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    return text || null;
  } catch (err) {
    console.error("Claude summary failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Run the initial review engine for an engagement. Idempotent per request. */
export async function runInitialReview(requestId: string, userId: string): Promise<EngineResult> {
  const ctx = await getEngagementContext(requestId);

  // Get or create the AiReview row.
  let review = await prisma.aiReview.findUnique({ where: { requestId } });
  if (review?.status === "RUNNING") throw ApiError.badRequest("An analysis is already running for this engagement.");
  if (!review) {
    review = await prisma.aiReview.create({ data: { requestId, status: "PENDING" } });
  }

  await prisma.aiReview.update({ where: { id: review.id }, data: { status: "RUNNING" } });
  await log(review.id, "ANALYSIS_RUN", `Initial review analysis started (by user ${userId}).`);

  try {
    const { triggers, findings: detected } = await collectTriggers(requestId);
    const scopeAlerts = await detectScopeAlerts(requestId);

    // Persist findings — skip duplicates (same category + description).
    const existing = await prisma.aiFinding.findMany({
      where: { reviewId: review.id },
      select: { category: true, description: true },
    });
    const seen = new Set(existing.map((f) => `${f.category}::${f.description}`));
    const newFindings = detected.filter((f) => !seen.has(`${f.category}::${f.description}`));
    if (newFindings.length) {
      await prisma.aiFinding.createMany({
        data: newFindings.map((f) => ({
          reviewId: review!.id,
          category: f.category,
          priority: f.priority,
          status: f.status ?? "NEEDS_REVIEW",
          description: f.description,
          evidence: f.evidence ?? null,
          relatedAccounts: f.relatedAccounts ?? null,
          recommendation: f.recommendation ?? null,
          source: f.source,
          checklistItemKey: f.checklistItemKey ?? null,
          estimatedHours: f.estimatedHours ?? null,
        })),
      });
      await log(review.id, "FINDING_GENERATED", `${newFindings.length} finding(s) generated.`);
    }

    // Persist scope alerts (skip duplicates by description).
    const existingAlerts = await prisma.aiScopeAlert.findMany({
      where: { reviewId: review.id },
      select: { description: true },
    });
    const seenAlerts = new Set(existingAlerts.map((a) => a.description));
    const newAlerts = scopeAlerts.filter((a) => !seenAlerts.has(a.description));
    if (newAlerts.length) {
      await prisma.aiScopeAlert.createMany({
        data: newAlerts.map((a) => ({
          reviewId: review!.id,
          description: a.description,
          evidence: a.evidence ?? null,
          estimatedHours: a.estimatedHours ?? null,
        })),
      });
      await log(review.id, "SCOPE_ALERT", `${newAlerts.length} scope alert(s) raised.`, "AI_GENERATED");
    }

    // Relevant questions for this engagement.
    const { relevant, skippedCount } = selectRelevantQuestions(triggers);

    // Build the summary.
    const ctxText = renderContextForPrompt(ctx);
    let summary = buildRuleSummary(ctx, newFindings.length, relevant.length, skippedCount, scopeAlerts.length);
    let engine = "rules";
    const claude = await claudeSummary(ctxText, detected);
    if (claude) {
      summary = claude;
      engine = "hybrid";
    }

    await prisma.aiReview.update({
      where: { id: review.id },
      data: { status: "COMPLETE", completedAt: new Date(), summary, engine },
    });
    await log(review.id, "RECOMMENDATION_GENERATED", `Summary generated (engine: ${engine}).`, claude ? "AI_GENERATED" : "SYSTEM_GENERATED");

    return {
      requestId,
      engine,
      summary,
      findings: detected,
      scopeAlerts,
      relevantQuestions: { keys: relevant.map((q) => q.checklistItemKey), skippedCount },
      triggers: [...triggers],
    };
  } catch (err) {
    await prisma.aiReview.update({ where: { id: review.id }, data: { status: "FAILED" } });
    throw err;
  }
}

function buildRuleSummary(
  ctx: Awaited<ReturnType<typeof getEngagementContext>>,
  newFindings: number,
  relevantCount: number,
  skipped: number,
  scopeAlerts: number
): string {
  const fe = ctx.financialExpectations;
  const wt = ctx.workTracking;
  const rs = ctx.reviewState;
  const lines: string[] = [];
  lines.push(`## Initial Review Summary`);
  lines.push(`**Client:** ${ctx.engagement.clientName}  `);
  lines.push(`**Engagement:** ${ctx.engagement.engagementName} — ${ctx.engagement.period}  `);
  lines.push(`**Status:** ${ctx.engagement.status}`);
  lines.push("");
  lines.push(`### Current State (from recorded review data)`);
  lines.push(`- Manual checklist: ${rs.manualItemsCompleted} of ${rs.manualItemsTotal} items completed`);
  lines.push(`- Open manual findings: ${rs.manualFindingsOpen}`);
  lines.push(`- Open client questions: ${rs.clientQuestionsOpen}`);
  lines.push(`- Documents logged: ${rs.documentsLogged}`);
  lines.push(`- Hours worked: ${wt.hoursWorked}${fe.quotedHours ? ` of ${fe.quotedHours} quoted` : ""}${wt.activeTimer ? " (timer running)" : ""}`);
  if (newFindings > 0) lines.push(`- New AI-detected findings: ${newFindings}`);
  if (scopeAlerts > 0) lines.push(`- Scope alerts: ${scopeAlerts} — review before investigating further`);
  lines.push("");
  lines.push(`### Question Relevance`);
  lines.push(`${relevantCount} of the 107 library questions are relevant to this engagement based on detected conditions; ${skipped} are skipped as not applicable (e.g., no payroll detected → payroll questions skipped).`);
  lines.push("");
  lines.push(`### Recommended Next Steps`);
  lines.push(`1. Work the Review Queue below — findings are ordered by priority.`);
  lines.push(`2. Record a decision on each finding (this is your professional judgment, not the AI's).`);
  lines.push(`3. Add client clarifications where client input is required.`);
  lines.push(`4. Confirm scope before investigating anything outside the agreed accounts.`);
  return lines.join("\n");
}
