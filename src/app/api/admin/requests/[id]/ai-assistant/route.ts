import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getEngagementContext } from "@/lib/ai/context";
import { runInitialReview } from "@/lib/ai/review-engine";
import { getOrCreateAiReview, logAiActivity } from "@/lib/ai/activity";
import { selectRelevantQuestions, type TriggerCondition } from "@/lib/ai/question-library";

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();
  return user;
}

/** GET — full AI Assistant state for the engagement. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id: requestId } = await params;

    const [ctx, review] = await Promise.all([
      getEngagementContext(requestId),
      getOrCreateAiReview(requestId),
    ]);

    const [findings, scopeAlerts, clarifications, activities] = await Promise.all([
      prisma.aiFinding.findMany({
        where: { reviewId: review.id },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      }),
      prisma.aiScopeAlert.findMany({
        where: { reviewId: review.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.aiClarification.findMany({
        where: { reviewId: review.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.aiActivityLog.findMany({
        where: { reviewId: review.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    // Question relevance: recompute triggers from current finding categories.
    const triggers = new Set<TriggerCondition>(["ALWAYS"]);
    const TRIGGER_BY_CATEGORY: Record<string, TriggerCondition> = {
      Reconciliations: "UNRECONCILED",
      Transactions: "UNCATEGORIZED_TXNS",
      "Personal/Business": "PERSONAL_CARD_ACTIVITY",
      Equity: "OWNER_DRAWS_CONTRIBS",
      Payroll: "PAYROLL_ACTIVITY",
      "Accounts Receivable": "AR_ACTIVITY",
      "Accounts Payable": "AP_ACTIVITY",
      "Sales Tax": "SALES_TAX_ACTIVITY",
      "Fixed Assets": "FIXED_ASSETS",
      "Loans & Liabilities": "LOANS_LIABILITIES",
      Balances: "NEGATIVE_BALANCES",
      Duplicates: "DUPLICATE_SUSPECTED",
      "Unusual Activity": "UNUSUAL_AMOUNTS",
      Transfers: "TRANSFERS",
      "Chart of Accounts": "INACTIVE_ACCOUNT_ACTIVITY",
      Documentation: "DOCUMENTS_GAPS",
    };
    for (const f of findings) {
      const t = TRIGGER_BY_CATEGORY[f.category];
      if (t) triggers.add(t);
    }
    const { relevant, skippedCount } = selectRelevantQuestions(triggers);

    return NextResponse.json({
      context: ctx,
      review: {
        id: review.id,
        status: review.status,
        engine: review.engine,
        summary: review.summary,
        startedAt: review.startedAt.toISOString(),
        completedAt: review.completedAt?.toISOString() ?? null,
      },
      findings,
      scopeAlerts,
      clarifications,
      activities,
      relevantQuestions: { items: relevant, skippedCount },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — actions: run-review | decide | resolve-scope-alert | add-clarification | update-clarification | chat */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id: requestId } = await params;
    const body = await request.json();
    const action = String(body.action ?? "");

    const review = await getOrCreateAiReview(requestId);

    // ─── RUN REVIEW ───────────────────────────────────────────────────────
    if (action === "run-review") {
      const result = await runInitialReview(requestId, admin.id);
      return NextResponse.json({ ok: true, engine: result.engine, summary: result.summary });
    }

    // ─── RECORD DECISION (human approval gate) ───────────────────────────
    if (action === "decide") {
      const findingId = String(body.findingId ?? "");
      const decision = String(body.decision ?? "").trim();
      const notes = body.notes ? String(body.notes) : null;
      if (!findingId || !decision) throw ApiError.badRequest("Finding and decision are required.");

      const finding = await prisma.aiFinding.findUnique({ where: { id: findingId } });
      if (!finding) throw ApiError.notFound("Finding not found.");
      if (finding.reviewId !== review.id) throw ApiError.badRequest("Finding does not belong to this engagement.");

      const STATUS_BY_DECISION: Record<string, string> = {
        "Reviewed — No Issue": "REVIEWED_NO_ISSUE",
        "Clearly Business": "REVIEWED_NO_ISSUE",
        "Needs Investigation": "NEEDS_INVESTIGATION",
        "Potential Cleanup": "POTENTIAL_CLEANUP",
        "Needs Client Clarification": "CLIENT_CLARIFICATION",
        "Needs Further Research": "NEEDS_INVESTIGATION",
        "Out of Scope": "OUT_OF_SCOPE",
        "Not an Issue": "REVIEWED_NO_ISSUE",
      };
      const newStatus = STATUS_BY_DECISION[decision];
      if (!newStatus) throw ApiError.badRequest(`Unknown decision: ${decision}`);

      await prisma.$transaction([
        prisma.aiFinding.update({
          where: { id: findingId },
          data: {
            status: newStatus as never,
            humanDecision: decision,
            humanNotes: notes,
            decidedBy: admin.id,
            decidedAt: new Date(),
          },
        }),
        prisma.aiDecision.create({
          data: {
            findingId,
            recommendation: finding.recommendation,
            humanDecision: decision,
            approvedBy: admin.id,
            notes,
          },
        }),
      ]);

      // Auto-create a clarification when Portia routes to the client queue.
      if (newStatus === "CLIENT_CLARIFICATION") {
        const existing = await prisma.aiClarification.findFirst({
          where: { findingId, status: { in: ["DRAFT", "READY_TO_SEND", "SENT"] } },
        });
        if (!existing) {
          await prisma.aiClarification.create({
            data: {
              reviewId: review.id,
              findingId,
              question: `Clarification needed regarding: ${finding.description}`,
              reason: `Flagged during AI-assisted review. AI recommendation was: ${finding.recommendation ?? "(none)"}`,
            },
          });
        }
      }

      await logAiActivity(
        review.id,
        "DECISION_RECORDED",
        `Finding "${finding.description.slice(0, 80)}" → ${decision}${notes ? ` (${notes})` : ""}`,
        "HUMAN_CREATED",
        admin.id
      );
      return NextResponse.json({ ok: true, status: newStatus });
    }

    // ─── RESOLVE SCOPE ALERT ──────────────────────────────────────────────
    if (action === "resolve-scope-alert") {
      const alertId = String(body.alertId ?? "");
      const resolution = String(body.resolution ?? "");
      const valid = ["IGNORED", "INCLUDED_IN_SCOPE", "CLIENT_CLARIFICATION", "SCOPE_EXPANSION", "OUT_OF_SCOPE"];
      if (!valid.includes(resolution)) throw ApiError.badRequest("Invalid scope resolution.");
      const alert = await prisma.aiScopeAlert.findUnique({ where: { id: alertId } });
      if (!alert || alert.reviewId !== review.id) throw ApiError.notFound("Scope alert not found.");
      await prisma.aiScopeAlert.update({
        where: { id: alertId },
        data: { status: resolution as never, resolvedBy: admin.id, resolvedAt: new Date() },
      });
      await logAiActivity(
        review.id,
        "SCOPE_ALERT",
        `Scope alert resolved as ${resolution} by ${admin.name}.`,
        "HUMAN_CREATED",
        admin.id
      );
      return NextResponse.json({ ok: true });
    }

    // ─── CLARIFICATIONS ───────────────────────────────────────────────────
    if (action === "add-clarification") {
      const question = String(body.question ?? "").trim();
      if (!question) throw ApiError.badRequest("Question text is required.");
      const clarification = await prisma.aiClarification.create({
        data: {
          reviewId: review.id,
          findingId: body.findingId ? String(body.findingId) : null,
          question,
          reason: body.reason ? String(body.reason) : null,
          relatedAccount: body.relatedAccount ? String(body.relatedAccount) : null,
          relatedPeriod: body.relatedPeriod ? String(body.relatedPeriod) : null,
          amountCents: body.amountCents != null ? Math.round(Number(body.amountCents)) : null,
          status: "DRAFT",
        },
      });
      await logAiActivity(review.id, "DECISION_RECORDED", `Clarification drafted by ${admin.name}.`, "HUMAN_CREATED", admin.id);
      return NextResponse.json({ ok: true, clarificationId: clarification.id });
    }

    if (action === "update-clarification") {
      const clarId = String(body.clarificationId ?? "");
      const clar = await prisma.aiClarification.findUnique({ where: { id: clarId } });
      if (!clar || clar.reviewId !== review.id) throw ApiError.notFound("Clarification not found.");
      const data: Record<string, unknown> = {};
      if (body.question !== undefined) data.question = String(body.question);
      if (body.reason !== undefined) data.reason = body.reason ? String(body.reason) : null;
      if (body.clientResponse !== undefined) data.clientResponse = body.clientResponse ? String(body.clientResponse) : null;
      if (body.status !== undefined) {
        const s = String(body.status);
        if (!["DRAFT", "READY_TO_SEND", "SENT", "CLIENT_RESPONDED", "RESOLVED"].includes(s))
          throw ApiError.badRequest("Invalid clarification status.");
        data.status = s;
        if (s === "RESOLVED") data.resolvedAt = new Date();
      }
      await prisma.aiClarification.update({ where: { id: clarId }, data });
      return NextResponse.json({ ok: true });
    }

    // ─── CHAT (grounded, secondary interface) ─────────────────────────────
    if (action === "chat") {
      const message = String(body.message ?? "").trim();
      if (!message) throw ApiError.badRequest("Message is required.");

      const [ctx, findings, scopeAlerts] = await Promise.all([
        getEngagementContext(requestId),
        prisma.aiFinding.findMany({ where: { reviewId: review.id }, orderBy: [{ priority: "asc" }] }),
        prisma.aiScopeAlert.findMany({ where: { reviewId: review.id, status: "OPEN" } }),
      ]);

      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          reply:
            "AI chat requires ANTHROPIC_API_KEY to be configured. The structured Review Queue, findings, and scope alerts below are generated by the rule engine and work without it.",
        });
      }

      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey });
        const findingsText = findings
          .slice(0, 20)
          .map((f) => `- [${f.priority}/${f.status}] ${f.category}: ${f.description}`)
          .join("\n");
        const scopeText = scopeAlerts.map((a) => `- ${a.description}`).join("\n");

        const res = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 800,
          system:
            "You are the PK Business Services AI bookkeeping analyst for one specific engagement. " +
            "Answer ONLY from the engagement data provided. If the answer is not in the data, say so plainly. " +
            "Use tentative language for potential issues. Never claim work is complete or books are reconciled. " +
            "You recommend; the human advisor decides. Keep answers concise.",
          messages: [
            {
              role: "user",
              content: `Engagement data:\n${ctx}\n\nFindings:\n${findingsText || "(none)"}\n\nOpen scope alerts:\n${scopeText || "(none)"}\n\nAdvisor question: ${message}`,
            },
          ],
        });
        const reply = res.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("\n");
        await logAiActivity(review.id, "CHAT_MESSAGE", `Q: ${message.slice(0, 100)}`, "HUMAN_CREATED", admin.id);
        await logAiActivity(review.id, "CHAT_MESSAGE", `A: ${reply.slice(0, 200)}`, "AI_GENERATED", null);
        return NextResponse.json({ ok: true, reply });
      } catch (err) {
        console.error("AI chat failed:", err instanceof Error ? err.message : err);
        return NextResponse.json(
          { ok: false, reply: "AI chat is temporarily unavailable. The structured findings below remain available." },
          { status: 502 }
        );
      }
    }

    throw ApiError.badRequest(`Unknown action: ${action || "(none)"}`);
  } catch (error) {
    return handleApiError(error);
  }
}
