"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronRight, Search, CheckSquare, Square,
  Save, Loader2, Flag, FileText, MessageCircleQuestion, ClipboardCheck, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ItemState = {
  id: string;
  status: string;
  notes: string;
  isFollowUp: boolean;
  isDocumentationNeeded: boolean;
  isCompleted: boolean;
  notApplicable: boolean;
};

type ChecklistEntry = {
  id: string;
  category: string;
  itemKey: string;
  title: string;
  description: string | null;
  state?: ItemState;
};

type CategoryGroup = { category: string; items: ChecklistEntry[] };

type Finding = {
  id: string;
  checklistItemId: string | null;
  category: string;
  finding: string;
  status: string;
  notes: string | null;
  isFollowUp: boolean;
  isDocumentationNeeded: boolean;
};

type Question = {
  id: string;
  findingId: string | null;
  question: string;
  status: string;
  clientResponse: string | null;
  internalNotes: string | null;
};

type DocLog = {
  id: string;
  name: string;
  docType: string;
  dateOrPeriod: string | null;
  description: string | null;
  checklistItemId: string | null;
  notes: string | null;
};

type ReviewData = {
  id: string;
  status: string;
  reviewer: { id: string; name: string };
  notes: string;
  categories: CategoryGroup[];
  findings: Finding[];
  questions: Question[];
  docLogs: DocLog[];
  progress: { totalItems: number; completed: number; percent: number };
  counts: {
    critical: number; needsInvestigation: number; cleanup: number;
    followUp: number; documentationNeeded: number; openQuestions: number;
  };
  request: { id: string; clientName: string; requestType: string; service: string; status: string };
};

const STATUSES = ["NOT_REVIEWED", "REVIEWED", "LOOKS_GOOD", "NEEDS_INVESTIGATION", "CLEANUP", "CRITICAL", "NOT_APPLICABLE"];

const STATUS_LABELS: Record<string, string> = {
  NOT_REVIEWED: "Not Reviewed",
  REVIEWED: "Reviewed",
  LOOKS_GOOD: "Looks Good",
  NEEDS_INVESTIGATION: "Needs Investigation",
  CLEANUP: "Cleanup",
  CRITICAL: "Critical",
  NOT_APPLICABLE: "N/A",
};

const STATUS_STYLES: Record<string, string> = {
  NOT_REVIEWED: "bg-muted text-muted-foreground border-border",
  REVIEWED: "bg-blue-50 text-blue-800 border-blue-200",
  LOOKS_GOOD: "bg-emerald-50 text-emerald-800 border-emerald-200",
  NEEDS_INVESTIGATION: "bg-amber-50 text-amber-800 border-amber-300",
  CLEANUP: "bg-orange-50 text-orange-800 border-orange-300",
  CRITICAL: "bg-red-50 text-red-800 border-red-300",
  NOT_APPLICABLE: "bg-gray-100 text-gray-600 border-gray-300",
};

const REVIEW_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "READY_FOR_CLEANUP", "ON_HOLD", "COMPLETED"];
const REVIEW_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  READY_FOR_CLEANUP: "Ready for Cleanup",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "INCOMPLETE", label: "Incomplete" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CRITICAL", label: "Critical" },
  { key: "NEEDS_INVESTIGATION", label: "Needs Investigation" },
  { key: "CLEANUP", label: "Cleanup" },
  { key: "LOOKS_GOOD", label: "Looks Good" },
  { key: "FOLLOW_UP", label: "Follow-Up" },
  { key: "DOC_NEEDED", label: "Documentation Needed" },
];

const DOC_TYPES = [
  "QBO_REPORT", "QBO_EXPORT", "BANK_STATEMENT", "CREDIT_CARD_STATEMENT",
  "RECONCILIATION_REPORT", "TRANSACTION_DETAIL", "GENERAL_LEDGER",
  "P_AND_L", "BALANCE_SHEET", "TRIAL_BALANCE", "SUPPORTING_DOC", "OTHER",
];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function QbInitialReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedAll, setExpandedAll] = useState(true);
  const [activeTab, setActiveTab] = useState<"checklist" | "findings" | "questions" | "docs" | "notes">("checklist");
  const [newQuestion, setNewQuestion] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState("QBO_REPORT");
  const [newDocPeriod, setNewDocPeriod] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/requests/${id}/qb-review`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setReviewNotes(d.notes ?? "");
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Failed to load review");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function patchItem(itemId: string, updates: Partial<ItemState> & { status?: string }) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/admin/requests/${id}/qb-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, ...updates }),
      });
      if (res.ok) {
        setSaveState("saved");
        // Optimistically update local state so the UI feels instant
        setData((prev) => {
          if (!prev) return prev;
          const categories = prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((it) =>
              it.state?.id === itemId ? { ...it, state: { ...it.state, ...updates } as ItemState } : it
            ),
          }));
          // Recompute progress + counts locally
          const allItems = categories.flatMap((c) => c.items.map((i) => i.state)).filter(Boolean) as ItemState[];
          const completed = allItems.filter((i) => i.isCompleted || i.notApplicable).length;
          return {
            ...prev,
            categories,
            progress: {
              totalItems: prev.progress.totalItems,
              completed,
              percent: prev.progress.totalItems === 0 ? 0 : Math.round((completed / prev.progress.totalItems) * 100),
            },
            counts: {
              critical: allItems.filter((i) => i.status === "CRITICAL").length,
              needsInvestigation: allItems.filter((i) => i.status === "NEEDS_INVESTIGATION").length,
              cleanup: allItems.filter((i) => i.status === "CLEANUP").length,
              followUp: allItems.filter((i) => i.isFollowUp).length,
              documentationNeeded: allItems.filter((i) => i.isDocumentationNeeded).length,
              openQuestions: prev.counts.openQuestions,
            },
          };
        });
        // Reload findings in the background (auto-synced server-side)
        fetch(`/api/admin/requests/${id}/qb-review`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) setData((prev) => (prev ? { ...prev, findings: d.findings } : prev)); })
          .catch(() => {});
        setTimeout(() => setSaveState("idle"), 1200);
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    }
  }

  async function setReviewStatus(status: string) {
    setSaveState("saving");
    const res = await fetch(`/api/admin/requests/${id}/qb-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus: status }),
    });
    if (res.ok) { setSaveState("saved"); await load(); setTimeout(() => setSaveState("idle"), 1200); }
    else setSaveState("error");
  }

  async function saveNotes() {
    setSaveState("saving");
    const res = await fetch(`/api/admin/requests/${id}/qb-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: reviewNotes }),
    });
    if (res.ok) { setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1200); }
    else setSaveState("error");
  }

  async function addQuestion() {
    if (!newQuestion.trim()) return;
    const res = await fetch(`/api/admin/requests/${id}/qb-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "question", question: newQuestion }),
    });
    if (res.ok) { setNewQuestion(""); await load(); }
  }

  async function addDocLog() {
    if (!newDocName.trim()) return;
    const res = await fetch(`/api/admin/requests/${id}/qb-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "docLog", name: newDocName, docType: newDocType,
        dateOrPeriod: newDocPeriod || undefined,
      }),
    });
    if (res.ok) { setNewDocName(""); setNewDocPeriod(""); await load(); }
  }

  async function deleteEntry(kind: "question" | "docLog", entryId: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/admin/requests/${id}/qb-review?${kind}Id=${entryId}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function matchesFilter(item: ChecklistEntry): boolean {
    const st = item.state;
    if (!st) return filter === "ALL";
    switch (filter) {
      case "ALL": return true;
      case "INCOMPLETE": return !st.isCompleted && !st.notApplicable;
      case "COMPLETED": return st.isCompleted || st.notApplicable;
      case "CRITICAL": return st.status === "CRITICAL";
      case "NEEDS_INVESTIGATION": return st.status === "NEEDS_INVESTIGATION";
      case "CLEANUP": return st.status === "CLEANUP";
      case "LOOKS_GOOD": return st.status === "LOOKS_GOOD";
      case "FOLLOW_UP": return st.isFollowUp;
      case "DOC_NEEDED": return st.isDocumentationNeeded;
      default: return true;
    }
  }

  const filteredCategories: CategoryGroup[] = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          if (!matchesFilter(item)) return false;
          if (q && !(
            item.title.toLowerCase().includes(q) ||
            (item.description ?? "").toLowerCase().includes(q) ||
            cat.category.toLowerCase().includes(q) ||
            (item.state?.notes ?? "").toLowerCase().includes(q)
          )) return false;
          return true;
        }),
      }))
      .filter((cat) => cat.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, search]);

  if (error) {
    return (
      <div className="p-8">
        <p className="rounded-md bg-red-50 px-4 py-3 text-red-700 border border-red-200">{error}</p>
        <Link href={`/admin/requests/${id}`} className="mt-4 inline-block text-sm underline">← Back to request</Link>
      </div>
    );
  }
  if (!data) return <p className="p-8 text-muted-foreground">Loading review…</p>;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div>
        <Link href={`/admin/requests/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to engagement
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">QuickBooks Cleanup — Initial Review</h1>
            <p className="text-sm text-muted-foreground">
              Client: <span className="font-medium text-foreground">{data.request.clientName}</span>
              {" · "}Reviewer: <span className="font-medium text-foreground">{data.reviewer.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground" htmlFor="review-status">Review Status</label>
            <select
              id="review-status"
              className="min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
              value={data.status}
              onChange={(e) => setReviewStatus(e.target.value)}
            >
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Progress dashboard ─── */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress</p>
              <p className="text-2xl font-semibold">
                {data.progress.completed} / {data.progress.totalItems}
                <span className="ml-2 text-base text-muted-foreground">— {data.progress.percent}%</span>
              </p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge label="Critical" count={data.counts.critical} cls="bg-red-50 text-red-800 border-red-200" />
              <Badge label="Needs Investigation" count={data.counts.needsInvestigation} cls="bg-amber-50 text-amber-800 border-amber-200" />
              <Badge label="Cleanup" count={data.counts.cleanup} cls="bg-orange-50 text-orange-800 border-orange-200" />
              <Badge label="Follow-Up" count={data.counts.followUp} cls="bg-blue-50 text-blue-800 border-blue-200" />
              <Badge label="Documentation Needed" count={data.counts.documentationNeeded} cls="bg-purple-50 text-purple-800 border-purple-200" />
              <Badge label="Open Questions" count={data.counts.openQuestions} cls="bg-teal-50 text-teal-800 border-teal-200" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {saveState === "saving" && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Saving…</span>}
            {saveState === "saved" && <span className="flex items-center gap-1 text-emerald-700"><Save className="size-4" /> Saved</span>}
            {saveState === "error" && <span className="flex items-center gap-1 text-red-700"><AlertTriangle className="size-4" /> Save failed</span>}
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${data.progress.percent}%` }}
            role="progressbar"
            aria-valuenow={data.progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex flex-wrap gap-2 border-b border-border" role="tablist">
        {([
          ["checklist", "Checklist", <ClipboardCheck key="i" className="size-4" />],
          ["findings", `Findings (${data.findings.length})`, <Flag key="i" className="size-4" />],
          ["questions", `Client Questions (${data.questions.length})`, <MessageCircleQuestion key="i" className="size-4" />],
          ["docs", `Documentation (${data.docLogs.length})`, <FileText key="i" className="size-4" />],
          ["notes", "Review Notes", <FileText key="i" className="size-4" />],
        ] as const).map(([key, label, icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`flex min-h-11 items-center gap-2 rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ─── Checklist tab ─── */}
      {activeTab === "checklist" && (
        <div className="space-y-4">
          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search checklist items"
                placeholder="Search items… (e.g. credit card)"
                className="min-h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setExpandedAll((v) => !v);
                setCollapsed(new Set());
              }}
            >
              {expandedAll ? "Collapse All" : "Expand All"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter checklist">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`min-h-10 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Categories */}
          {filteredCategories.map((cat) => {
            const total = cat.items.length;
            const done = cat.items.filter((i) => i.state && (i.state.isCompleted || i.state.notApplicable)).length;
            const isCollapsed = collapsed.has(cat.category) || (!expandedAll && !collapsed.has(cat.category) === false && !expandedAll && collapsed.size === 0 ? false : collapsed.has(cat.category));
            const open = expandedAll ? !collapsed.has(cat.category) : collapsed.size === 0 ? false : !collapsed.has(cat.category);
            const isOpen = collapsed.has(cat.category) ? false : expandedAll ? true : !collapsed.has(cat.category);
            return (
              <section key={cat.category} className="rounded-lg border bg-card" aria-label={cat.category}>
                <button
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-t-lg px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setExpandedAll(false);
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(cat.category)) next.delete(cat.category);
                      else next.add(cat.category);
                      return next;
                    });
                  }}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    {cat.category}
                  </span>
                  <span className="text-sm text-muted-foreground">{done} / {total} complete</span>
                </button>

                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {cat.items.map((item) => {
                      const st = item.state;
                      if (!st) return null;
                      return (
                        <li key={item.id} className="p-4">
                          <div className="flex flex-wrap items-start gap-3">
                            {/* Checkbox */}
                            <button
                              onClick={() => patchItem(st.id, { isCompleted: !st.isCompleted })}
                              aria-pressed={st.isCompleted}
                              aria-label={st.isCompleted ? `Mark "${item.title}" incomplete` : `Mark "${item.title}" complete`}
                              className="mt-0.5 shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              {st.isCompleted ? (
                                <CheckSquare className="size-6 text-emerald-600" aria-hidden />
                              ) : (
                                <Square className="size-6 text-muted-foreground" aria-hidden />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium ${st.isCompleted ? "line-through opacity-60" : ""}`}>
                                {item.title}
                              </p>
                              {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}

                              {/* Status pills */}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => patchItem(st.id, { status: s, ...(s === "NOT_APPLICABLE" ? { notApplicable: true } : {}), ...(s !== "NOT_APPLICABLE" && st.notApplicable ? { notApplicable: false } : {}) })}
                                    aria-pressed={st.status === s}
                                    className={`min-h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                                      st.status === s
                                        ? STATUS_STYLES[s] + " ring-2 ring-ring ring-offset-1"
                                        : "bg-background text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>

                              {/* Flags + notes */}
                              <div className="mt-2 flex flex-wrap items-center gap-4">
                                <label className="flex min-h-8 items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={st.isFollowUp}
                                    onChange={(e) => patchItem(st.id, { isFollowUp: e.target.checked })}
                                    className="size-4 rounded border-input"
                                  />
                                  Follow-Up
                                </label>
                                <label className="flex min-h-8 items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={st.isDocumentationNeeded}
                                    onChange={(e) => patchItem(st.id, { isDocumentationNeeded: e.target.checked })}
                                    className="size-4 rounded border-input"
                                  />
                                  Documentation Needed
                                </label>
                              </div>
                              <textarea
                                rows={2}
                                placeholder="Notes…"
                                aria-label={`Notes for ${item.title}`}
                                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                defaultValue={st.notes}
                                onBlur={(e) => {
                                  if (e.target.value !== st.notes) patchItem(st.id, { notes: e.target.value });
                                }}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
          {filteredCategories.length === 0 && (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No items match the current filter/search.
            </p>
          )}

          {/* Mark ready */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium">Complete the Initial Review</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Marking this review &ldquo;Ready for Cleanup&rdquo; records what was discovered — it does not perform any cleanup.
              Cleanup is a separate workflow.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <SummaryTerm label="Total Items" value={data.progress.totalItems} />
              <SummaryTerm label="Completed" value={data.progress.completed} />
              <SummaryTerm label="Incomplete" value={data.progress.totalItems - data.progress.completed} />
              <SummaryTerm label="Critical" value={data.counts.critical} />
              <SummaryTerm label="Needs Investigation" value={data.counts.needsInvestigation} />
              <SummaryTerm label="Cleanup" value={data.counts.cleanup} />
              <SummaryTerm label="Follow-Up" value={data.counts.followUp} />
              <SummaryTerm label="Documentation Needed" value={data.counts.documentationNeeded} />
              <SummaryTerm label="Open Questions" value={data.counts.openQuestions} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={() => setReviewStatus("READY_FOR_CLEANUP")}>
                Mark Review Ready for Cleanup
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setReviewStatus("ON_HOLD")}>
                Put On Hold
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Findings tab ─── */}
      {activeTab === "findings" && (
        <div className="space-y-3">
          {data.findings.length === 0 && (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No findings yet. Items marked Critical, Needs Investigation, or Cleanup appear here automatically.
            </p>
          )}
          {data.findings.map((f) => (
            <div key={f.id} className={`rounded-lg border p-4 ${f.status === "CRITICAL" ? "border-red-300 bg-red-50/50" : f.status === "CLEANUP" ? "border-orange-300 bg-orange-50/50" : "border-amber-300 bg-amber-50/50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[f.status] ?? "bg-muted"}`}>
                  {STATUS_LABELS[f.status] ?? f.status}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.category}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{f.finding}</p>
              <textarea
                rows={2}
                placeholder="Finding notes…"
                aria-label={`Notes for finding: ${f.finding}`}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={f.notes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (f.notes ?? "")) {
                    fetch(`/api/admin/requests/${id}/qb-review`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ findingId: f.id, notes: e.target.value }),
                    });
                  }
                }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.isFollowUp}
                    onChange={(e) => {
                      fetch(`/api/admin/requests/${id}/qb-review`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ findingId: f.id, isFollowUp: e.target.checked }),
                      }).then(load);
                    }}
                    className="size-4"
                  />
                  Follow-Up
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.isDocumentationNeeded}
                    onChange={(e) => {
                      fetch(`/api/admin/requests/${id}/qb-review`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ findingId: f.id, isDocumentationNeeded: e.target.checked }),
                      }).then(load);
                    }}
                    className="size-4"
                  />
                  Documentation Needed
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  onClick={async () => {
                    const q = window.prompt("Turn this finding into a client question:", f.finding);
                    if (!q) return;
                    await fetch(`/api/admin/requests/${id}/qb-review`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "question", question: q, findingId: f.id }),
                    });
                    await load();
                  }}
                >
                  <MessageCircleQuestion className="size-4" /> Ask the Client
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Questions tab ─── */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className="min-h-11 flex-1 rounded-md border bg-background px-3 text-sm"
              placeholder="New client question…"
              aria-label="New client question"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addQuestion(); }}
            />
            <Button className="min-h-11" onClick={addQuestion} disabled={!newQuestion.trim()}>Add Question</Button>
          </div>
          {data.questions.length === 0 && (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No client questions yet.</p>
          )}
          {data.questions.map((q) => (
            <div key={q.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium">{q.question}</p>
                <select
                  aria-label={`Status for question: ${q.question}`}
                  className="min-h-9 rounded-md border bg-background px-2 text-xs"
                  value={q.status}
                  onChange={async (e) => {
                    await fetch(`/api/admin/requests/${id}/qb-review`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ questionId: q.id, status: e.target.value }),
                    });
                    await load();
                  }}
                >
                  {["OPEN", "SENT", "ANSWERED", "RESOLVED"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" className="min-h-9 text-red-600" onClick={() => deleteEntry("question", q.id)}>
                  Delete
                </Button>
              </div>
              <textarea
                rows={2}
                placeholder="Client response…"
                aria-label={`Client response for: ${q.question}`}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={q.clientResponse ?? ""}
                onBlur={async (e) => {
                  if (e.target.value !== (q.clientResponse ?? "")) {
                    await fetch(`/api/admin/requests/${id}/qb-review`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ questionId: q.id, clientResponse: e.target.value }),
                    });
                    await load();
                  }
                }}
              />
              <textarea
                rows={2}
                placeholder="Internal notes…"
                aria-label={`Internal notes for: ${q.question}`}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={q.internalNotes ?? ""}
                onBlur={async (e) => {
                  if (e.target.value !== (q.internalNotes ?? "")) {
                    await fetch(`/api/admin/requests/${id}/qb-review`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ questionId: q.id, internalNotes: e.target.value }),
                    });
                    await load();
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ─── Documentation tab ─── */}
      {activeTab === "docs" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium">Log a supporting document / QBO report</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                className="min-h-11 rounded-md border bg-background px-3 text-sm"
                placeholder="Document/report name…"
                aria-label="Document name"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
              />
              <select
                aria-label="Document type"
                className="min-h-11 rounded-md border bg-background px-3 text-sm"
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <input
                className="min-h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2"
                placeholder="Date or period (e.g. Jan–Dec 2025)"
                aria-label="Date or period"
                value={newDocPeriod}
                onChange={(e) => setNewDocPeriod(e.target.value)}
              />
            </div>
            <Button className="mt-3 min-h-11" onClick={addDocLog} disabled={!newDocName.trim()}>Add to Log</Button>
          </div>
          {data.docLogs.length === 0 && (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No documents logged yet. Record each QBO report/statement you rely on during the review.
            </p>
          )}
          {data.docLogs.length > 0 && (
            <ul className="space-y-2">
              {data.docLogs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.docType.replace(/_/g, " ")}{d.dateOrPeriod ? ` · ${d.dateOrPeriod}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="min-h-9 text-red-600" onClick={() => deleteEntry("docLog", d.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ─── Notes tab ─── */}
      {activeTab === "notes" && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-medium">Initial Review Notes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Overall observations that don&rsquo;t belong to a single checklist item.
          </p>
          <Textarea
            rows={10}
            aria-label="Initial review notes"
            className="mt-3"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
          <Button className="mt-3 min-h-11" onClick={saveNotes}>Save Notes</Button>
        </div>
      )}
    </div>
  );
}

function Badge({ label, count, cls }: { label: string; count: number; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {label}: {count}
    </span>
  );
}

function SummaryTerm({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
