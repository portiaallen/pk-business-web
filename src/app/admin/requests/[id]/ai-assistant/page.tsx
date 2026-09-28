"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
  ClipboardList,
  History,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";

type Finding = {
  id: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  evidence: string | null;
  recommendation: string | null;
  humanDecision: string | null;
  humanNotes: string | null;
  source: string;
  estimatedHours: number | null;
};

type ScopeAlert = {
  id: string;
  description: string;
  evidence: string | null;
  estimatedHours: number | null;
  status: string;
};

type Clarification = {
  id: string;
  question: string;
  reason: string | null;
  status: string;
};

type Activity = {
  id: string;
  actorType: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

type Context = {
  engagement: { clientName: string; engagementName: string; serviceType: string; period: string; status: string };
  scope: { included: string[]; exclusions: string[]; specialInstructions: string[] };
  financialExpectations: { quotedHours: number | null; hourlyRateCents: number | null; estimatedTotalCents: number | null };
  workTracking: { hoursWorked: number; hoursRemaining: number | null; activeTimer: boolean };
};

type State = {
  context: Context;
  review: { id: string; status: string; engine: string; summary: string | null };
  findings: Finding[];
  scopeAlerts: ScopeAlert[];
  clarifications: Clarification[];
  activities: Activity[];
  relevantQuestions: { items: Array<{ checklistItemKey: string; category: string; reason: string }>; skippedCount: number };
};

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: "bg-red-50 text-red-900 border border-red-300",
  MEDIUM: "bg-amber-50 text-amber-900 border border-amber-300",
  LOW: "bg-gray-50 text-gray-700 border border-gray-300",
};

const STATUS_BADGE: Record<string, string> = {
  NEEDS_REVIEW: "bg-blue-50 text-blue-900 border border-blue-300",
  REVIEWED_NO_ISSUE: "bg-green-50 text-green-900 border border-green-300",
  NEEDS_INVESTIGATION: "bg-amber-50 text-amber-900 border border-amber-300",
  POTENTIAL_CLEANUP: "bg-purple-50 text-purple-900 border border-purple-300",
  CLIENT_CLARIFICATION: "bg-orange-50 text-orange-900 border border-orange-300",
  OUT_OF_SCOPE: "bg-red-50 text-red-900 border border-red-300",
  DISMISSED: "bg-gray-50 text-gray-600 border border-gray-300",
};

function fmtStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const DECISIONS = [
  "Reviewed — No Issue",
  "Clearly Business",
  "Needs Investigation",
  "Potential Cleanup",
  "Needs Client Clarification",
  "Needs Further Research",
  "Not an Issue",
  "Out of Scope",
];

function FindingCard({ finding, onDecide }: { finding: Finding; onDecide: (id: string, decision: string, notes: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const decided = finding.status !== "NEEDS_REVIEW";

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[finding.priority] || ""}`}>
          {fmtStatus(finding.priority)}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[finding.status] || ""}`}>
          {fmtStatus(finding.status)}
        </span>
        <span className="text-xs font-medium text-muted-gray">{finding.category}</span>
        <span className="ml-auto text-xs text-muted-gray">
          {finding.source === "AI_GENERATED" ? "AI-generated" : "System-generated"}
        </span>
      </div>

      <p className="mt-2 text-sm text-charcoal">{finding.description}</p>

      {finding.recommendation && (
        <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
          <strong>AI recommendation (not a decision):</strong> {finding.recommendation}
        </p>
      )}

      {decided && (
        <p className="mt-2 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-900">
          <strong>Your decision:</strong> {finding.humanDecision}
          {finding.humanNotes ? ` — ${finding.humanNotes}` : ""}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-charcoal hover:text-gold"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {expanded ? "Hide" : "Evidence & decide"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {finding.evidence && (
            <details className="text-xs text-muted-gray">
              <summary className="cursor-pointer font-medium text-charcoal">View evidence</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-cream p-2 whitespace-pre-wrap">{(() => {
                try { return JSON.stringify(JSON.parse(finding.evidence), null, 2); } catch { return finding.evidence; }
              })()}</pre>
            </details>
          )}
          {!decided && (
            <>
              <div>
                <label htmlFor={`notes-${finding.id}`} className="text-xs font-medium text-charcoal">
                  Notes (optional)
                </label>
                <input
                  id={`notes-${finding.id}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                  placeholder="Short note for the record"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {DECISIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDecide(finding.id, d, notes)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-charcoal hover:bg-secondary"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function AiAssistantPage() {
  const { id: requestId } = useParams<{ id: string }>();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [tab, setTab] = useState<"queue" | "clarifications" | "questions" | "activity">("queue");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/requests/${requestId}/ai-assistant`);
    if (res.ok) setState(await res.json());
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, successText?: string) {
    setMessage(null);
    const res = await fetch(`/api/admin/requests/${requestId}/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (successText) setMessage({ ok: true, text: successText });
      return data;
    }
    setMessage({ ok: false, text: data.error || `Action failed (${res.status}).` });
    return null;
  }

  async function runReview() {
    setRunning(true);
    setMessage(null);
    const result = await act({ action: "run-review" });
    setRunning(false);
    if (result) setMessage({ ok: true, text: "Initial review analysis complete." });
    await load();
  }

  async function decide(findingId: string, decision: string, notes: string) {
    const result = await act({ action: "decide", findingId, decision, notes: notes || undefined }, `Decision recorded: ${decision}`);
    if (result) await load();
  }

  async function resolveAlert(alertId: string, resolution: string) {
    const result = await act({ action: "resolve-scope-alert", alertId, resolution }, "Scope alert resolved.");
    if (result) await load();
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    setChatLog((l) => [...l, { role: "user", text }]);
    setChatInput("");
    const res = await fetch(`/api/admin/requests/${requestId}/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", message: text }),
    });
    const data = await res.json().catch(() => ({}));
    setChatLog((l) => [...l, { role: "assistant", text: data.reply || "No response." }]);
  }

  if (loading) return <p className="py-16 text-center text-sm text-muted-gray">Loading AI Assistant…</p>;
  if (!state) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-gray">Could not load the AI Assistant for this engagement.</p>
        <Link href="/admin/requests" className="mt-3 inline-block text-sm font-medium text-charcoal underline">
          Back to requests
        </Link>
      </div>
    );
  }

  const { context: ctx, review, findings, scopeAlerts, clarifications, activities, relevantQuestions } = state;
  const queue = findings.filter((f) => f.status === "NEEDS_REVIEW" || f.status === "NEEDS_INVESTIGATION");
  const decided = findings.filter((f) => f.status !== "NEEDS_REVIEW");
  const openAlerts = scopeAlerts.filter((a) => a.status === "OPEN");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/requests/${requestId}`}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-charcoal"
            aria-label="Back to engagement"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 font-heading text-3xl font-semibold text-charcoal">
              <Sparkles className="size-6 text-gold" aria-hidden /> PK AI Assistant
            </h1>
            <p className="text-sm text-muted-gray">
              {ctx.engagement.clientName} · {ctx.engagement.engagementName} · {ctx.engagement.period}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-secondary"
          >
            <MessageSquare className="size-4" aria-hidden /> Chat
          </button>
          <button
            type="button"
            disabled={running || review.status === "RUNNING"}
            onClick={runReview}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory hover:bg-charcoal/90 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} aria-hidden />
            {running ? "Analyzing…" : review.status === "COMPLETE" ? "Re-run Analysis" : "Run Initial Review"}
          </button>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-lg border p-4 text-sm font-medium ${
            message.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-charcoal">
            <Sparkles className="size-4 text-gold" aria-hidden /> Ask about this engagement
          </h2>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto">
            {chatLog.length === 0 && (
              <p className="text-xs text-muted-gray">
                Grounded in this engagement's data only. Try: “What are the biggest issues?” or “Are we seeing anything outside scope?”
              </p>
            )}
            {chatLog.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-sm ${
                  m.role === "user" ? "ml-8 bg-cream text-charcoal" : "mr-8 border border-border bg-background text-charcoal"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Ask a question about this engagement…"
              aria-label="Chat message"
            />
            <button
              type="button"
              onClick={sendChat}
              className="inline-flex min-h-11 items-center rounded-lg bg-charcoal px-4 text-sm font-medium text-ivory hover:bg-charcoal/90"
            >
              Send
            </button>
          </div>
        </section>
      )}

      {/* Engagement context + Work Meter */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="font-heading text-lg font-semibold text-charcoal">Engagement Context</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-gray">Service</dt><dd className="font-medium text-charcoal">{ctx.engagement.serviceType}</dd></div>
            <div><dt className="text-muted-gray">Status</dt><dd className="font-medium text-charcoal">{fmtStatus(ctx.engagement.status)}</dd></div>
            <div>
              <dt className="text-muted-gray">Scope</dt>
              <dd className="text-charcoal">{ctx.scope.included.join("; ") || "Documented in engagement notes"}</dd>
            </div>
            <div>
              <dt className="text-muted-gray">Quoted</dt>
              <dd className="font-medium text-charcoal">
                {ctx.financialExpectations.quotedHours ?? "—"} hrs
                {ctx.financialExpectations.hourlyRateCents
                  ? ` @ $${(ctx.financialExpectations.hourlyRateCents / 100).toFixed(2)}/hr`
                  : ""}
              </dd>
            </div>
          </dl>
        </section>

        {/* Work Meter */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold text-charcoal">Work Meter</h2>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-cream" role="img"
            aria-label={`Work meter: ${ctx.workTracking.hoursWorked} hours worked${ctx.financialExpectations.quotedHours ? ` of ${ctx.financialExpectations.quotedHours} quoted` : ""}`}>
            {ctx.financialExpectations.quotedHours ? (
              <div
                className={`h-full rounded-full ${ctx.workTracking.hoursWorked > ctx.financialExpectations.quotedHours ? "bg-red-500" : "bg-gold"}`}
                style={{ width: `${Math.min(100, (ctx.workTracking.hoursWorked / ctx.financialExpectations.quotedHours) * 100)}%` }}
              />
            ) : (
              <div className="h-full rounded-full bg-gold/40" style={{ width: "8%" }} />
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-muted-gray">Quoted</dt><dd className="font-semibold text-charcoal">{ctx.financialExpectations.quotedHours ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-gray">Worked</dt><dd className="font-semibold text-charcoal">{ctx.workTracking.hoursWorked}{ctx.workTracking.activeTimer ? " ●" : ""}</dd></div>
            <div><dt className="text-xs text-muted-gray">Remaining</dt><dd className="font-semibold text-charcoal">{ctx.workTracking.hoursRemaining ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-gray">Out-of-scope</dt><dd className={`font-semibold ${openAlerts.length ? "text-red-800" : "text-charcoal"}`}>{openAlerts.reduce((s, a) => s + (a.estimatedHours ?? 0), 0) || "—"}</dd></div>
          </dl>
        </section>
      </div>

      {/* Scope alerts */}
      {scopeAlerts.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-amber-900">
            <ShieldAlert className="size-5" aria-hidden /> Scope Alerts
          </h2>
          <ul className="mt-3 space-y-3">
            {scopeAlerts.map((a) => (
              <li key={a.id} className="rounded-md border border-amber-200 bg-card p-3">
                <p className="text-sm text-charcoal">{a.description}</p>
                {a.status === "OPEN" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      ["INCLUDED_IN_SCOPE", "Part of existing scope"],
                      ["IGNORED", "Ignore"],
                      ["CLIENT_CLARIFICATION", "Client clarification"],
                      ["SCOPE_EXPANSION", "Potential scope expansion"],
                      ["OUT_OF_SCOPE", "Out of scope"],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => resolveAlert(a.id, val)}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-charcoal hover:bg-secondary"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-green-900">
                    Resolved: {fmtStatus(a.status)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Summary */}
      {review.summary && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Initial Review Summary</h2>
            <span className="rounded-full border border-border bg-cream px-2.5 py-0.5 text-xs font-medium text-muted-gray">
              {review.engine === "hybrid" ? "AI-enhanced" : "Rule-based"}
            </span>
          </div>
          <div className="mt-3 space-y-1 text-sm text-charcoal">
            {review.summary.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h3 key={i} className="pt-2 font-heading text-base font-semibold">{line.slice(3)}</h3>;
              if (line.startsWith("### ")) return <h4 key={i} className="pt-2 font-semibold">{line.slice(4)}</h4>;
              if (line.startsWith("- ")) return <p key={i} className="ml-3">• {line.slice(2)}</p>;
              if (/^\d+\./.test(line)) return <p key={i} className="ml-3">{line}</p>;
              return line.trim() ? <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} /> : null;
            })}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {([
          ["queue", `Review Queue (${queue.length})`, ClipboardList],
          ["clarifications", `Clarifications (${clarifications.filter((c) => c.status !== "RESOLVED").length})`, MessageSquare],
          ["questions", `Relevant Questions (${relevantQuestions.items.length})`, ClipboardList],
          ["activity", "Audit Log", History],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              tab === key ? "border-charcoal bg-charcoal text-ivory" : "border-border text-charcoal hover:bg-secondary"
            }`}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {/* Review Queue */}
      {tab === "queue" && (
        <div className="space-y-4">
          {queue.length === 0 && decided.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-gray">
              Run the Initial Review to generate findings, or work the manual checklist — the AI engine reads from it.
            </p>
          ) : queue.length === 0 ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-5 text-sm font-medium text-green-900">
              <Check className="mr-1 inline size-4" aria-hidden /> All findings have your decision. {decided.length} recorded.
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-charcoal">
                {queue.length} finding{queue.length === 1 ? "" : "s"} require your professional judgment.
              </p>
              {queue.map((f) => <FindingCard key={f.id} finding={f} onDecide={decide} />)}
            </>
          )}
          {decided.length > 0 && (
            <details className="rounded-lg border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-charcoal">
                Decided findings ({decided.length})
              </summary>
              <div className="mt-3 space-y-3">
                {decided.map((f) => <FindingCard key={f.id} finding={f} onDecide={decide} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Clarifications */}
      {tab === "clarifications" && (
        <div className="space-y-3">
          {clarifications.length === 0 && (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-gray">
              No client clarifications yet. Decide a finding with “Needs Client Clarification” to add one, or draft one below.
            </p>
          )}
          {clarifications.map((c) => (
            <article key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[c.status] ?? ""}`}>
                  {fmtStatus(c.status)}
                </span>
                <div className="flex gap-2">
                  {c.status === "DRAFT" && (
                    <button type="button" onClick={() => act({ action: "update-clarification", clarificationId: c.id, status: "READY_TO_SEND" }).then(load)}
                      className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-charcoal hover:bg-secondary">
                      Mark Ready to Send
                    </button>
                  )}
                  {c.status === "READY_TO_SEND" && (
                    <button type="button" onClick={() => act({ action: "update-clarification", clarificationId: c.id, status: "SENT" }).then(load)}
                      className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-charcoal hover:bg-secondary">
                      Mark Sent
                    </button>
                  )}
                  {c.status === "SENT" && (
                    <button type="button" onClick={() => act({ action: "update-clarification", clarificationId: c.id, status: "CLIENT_RESPONDED" }).then(load)}
                      className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-charcoal hover:bg-secondary">
                      Client Responded
                    </button>
                  )}
                  {c.status === "CLIENT_RESPONDED" && (
                    <button type="button" onClick={() => act({ action: "update-clarification", clarificationId: c.id, status: "RESOLVED" }).then(load)}
                      className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-charcoal hover:bg-secondary">
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-charcoal">{c.question}</p>
              {c.reason && <p className="mt-1 text-xs text-muted-gray">{c.reason}</p>}
            </article>
          ))}
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-charcoal">Draft a clarification</summary>
            <ClarificationDraft onSubmit={async (question, reason) => {
              const r = await act({ action: "add-clarification", question, reason }, "Clarification drafted.");
              if (r) await load();
            }} />
          </details>
        </div>
      )}

      {/* Relevant questions */}
      {tab === "questions" && (
        <div className="space-y-3">
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {relevantQuestions.items.length} of the 107 library questions are relevant based on detected conditions;
            {" "}{relevantQuestions.skippedCount} are skipped as not applicable. Open the{" "}
            <Link href={`/admin/requests/${requestId}/qb-review`} className="font-semibold underline">manual review</Link>{" "}
            to work them — the flagged categories matter most.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {relevantQuestions.items.map((q) => (
              <div key={q.checklistItemKey} className="rounded-md border border-border bg-card p-3 text-xs">
                <p className="font-medium text-charcoal">{q.category}</p>
                <p className="mt-0.5 text-muted-gray">{q.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log */}
      {tab === "activity" && (
        <ul className="rounded-lg border border-border bg-card divide-y divide-border">
          {activities.length === 0 && <li className="p-6 text-center text-sm text-muted-gray">No activity yet.</li>}
          {activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 p-3 text-sm">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  a.actorType === "HUMAN_CREATED"
                    ? "border border-green-300 bg-green-50 text-green-900"
                    : a.actorType === "AI_GENERATED"
                      ? "border border-purple-300 bg-purple-50 text-purple-900"
                      : "border border-gray-300 bg-gray-50 text-gray-700"
                }`}
              >
                {a.actorType === "HUMAN_CREATED" ? "Human" : a.actorType === "AI_GENERATED" ? "AI" : "System"}
              </span>
              <div>
                <p className="font-medium text-charcoal">{fmtStatus(a.action)}</p>
                {a.detail && <p className="text-xs text-muted-gray">{a.detail}</p>}
                <p className="text-xs text-muted-gray">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClarificationDraft({ onSubmit }: { onSubmit: (question: string, reason: string) => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-3">
      <div>
        <label htmlFor="clar-q" className="text-xs font-medium text-charcoal">Question for the client</label>
        <textarea id="clar-q" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="clar-r" className="text-xs font-medium text-charcoal">Reason / context (internal)</label>
        <input id="clar-r" value={reason} onChange={(e) => setReason(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm" />
      </div>
      <button type="button" disabled={busy || !question.trim()}
        onClick={async () => { setBusy(true); await onSubmit(question, reason); setBusy(false); setQuestion(""); setReason(""); }}
        className="inline-flex min-h-11 items-center rounded-lg bg-charcoal px-4 text-sm font-medium text-ivory hover:bg-charcoal/90 disabled:opacity-50">
        Save Draft
      </button>
    </div>
  );
}
