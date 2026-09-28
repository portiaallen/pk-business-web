"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Upload, Download, Play, Square, Pause, RotateCcw, Clock, Timer, ClipboardCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const TIME_CATEGORIES = [
  "Initial QuickBooks File Review",
  "Account/Reconciliation Review",
  "Personal Credit Card Transaction Review",
  "Transaction Classification/Reclassification",
  "Bank & Credit Card Reconciliation",
  "Cleanup/Adjustments",
  "Financial Statement Review",
  "Supporting Documentation/Workpapers",
  "Final Quality Review",
  "Final Report Preparation",
  "Client Communication",
  "Administrative/Engagement Management",
];

type Detail = {
  id: string;
  client: { id: string; name: string };
  service: string;
  requestType: string;
  status: string;
  clientNotes: string | null;
  requesterName: string | null;
  assignedStaff: { id: string; name: string; email: string } | null;
  documents: { id: string; fileName: string; reviewStatus: string; createdAt: string }[];
  documentRequests: { id: string; title: string; status: string; required: boolean }[];
  messages: { id: string; body: string; isFromStaff: boolean; authorName: string; createdAt: string }[];
  internalNotes: { id: string; content: string; authorName: string; createdAt: string }[];
  deliverables: { id: string; title: string; fileName: string; createdAt: string; visibility: string }[];
  timeEntries: Array<{
    id: string;
    userName: string;
    category: string;
    note: string | null;
    startedAt: string;
    stoppedAt: string | null;
    durationSeconds: number;
    durationDisplay: string;
    isManual: boolean;
    isRunning: boolean;
  }>;
  timeTotals: {
    totalSeconds: number;
    totalDisplay: string;
    totalHours: number;
    totalBillable: number;
  };
  timeCategories: string[];
};

type Staff = { id: string; name: string; email: string; role: string };

const STATUSES = [
  "DRAFT", "SUBMITTED", "DOCUMENTS_REQUIRED", "UNDER_REVIEW",
  "VERIFICATION_IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED",
];

export default function AdminRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [docReqTitle, setDocReqTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/requests/${id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function loadTimeEntries() {
    const res = await fetch(`/api/admin/requests/${id}/time-entries`);
    if (res.ok) {
      const data = await res.json();
      setTimeEntries(data.entries || []);
      setTimeTotals(data.totals || { totalSeconds: 0, totalDisplay: "0:00:00", totalHours: 0, totalBillable: 0 });
      setTimeCategories(data.categories || TIME_CATEGORIES);
    }
  }

  useEffect(() => {
    load();
    loadTimeEntries();
    fetch("/api/admin/staff").then((r) => (r.ok ? r.json() : [])).then(setStaff).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Timer state
  const [timeEntries, setTimeEntries] = useState<Detail["timeEntries"]>([]);
  const [timeTotals, setTimeTotals] = useState<Detail["timeTotals"]>({ totalSeconds: 0, totalDisplay: "0:00:00", totalHours: 0, totalBillable: 0 });
  const [timeCategories, setTimeCategories] = useState<string[]>(TIME_CATEGORIES);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerCategory, setTimerCategory] = useState("");
  const [timerNote, setTimerNote] = useState("");
  const [timerActiveId, setTimerActiveId] = useState<string | null>(null);
  const [timerError, setTimerError] = useState("");

  let timerInterval: ReturnType<typeof setInterval> | null = null;

  function startTimerInterval() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
  }

  function stopTimerInterval() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  async function startTimer() {
    if (!timerCategory) {
      setTimerError("Please select a category.");
      return;
    }
    setTimerError("");
    try {
      const res = await fetch(`/api/admin/requests/${id}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: timerCategory, note: timerNote }),
      });
      if (res.ok) {
        const data = await res.json();
        setTimerActiveId(data.id);
        setTimerRunning(true);
        startTimerInterval();
        setTimerSeconds(0);
        await loadTimeEntries();
      } else {
        const j = await res.json().catch(() => ({}));
        setTimerError(j.error || "Failed to start timer");
      }
    } catch {
      setTimerError("Failed to start timer");
    }
  }

  async function stopTimer() {
    if (!timerActiveId) return;
    stopTimerInterval();
    setTimerRunning(false);
    try {
      const res = await fetch(`/api/admin/requests/${id}/time-entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop: true }),
      });
      if (res.ok) {
        setTimerActiveId(null);
        setTimerSeconds(0);
        setTimerNote("");
        await loadTimeEntries();
      }
    } catch {
      setTimerRunning(false);
      setTimerActiveId(null);
      setTimerSeconds(0);
      await loadTimeEntries();
    }
  }

  async function addManualEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const category = data.get("manualCategory") as string;
    const note = data.get("manualNote") as string;
    const hours = parseFloat(data.get("manualHours") as string) || 0;
    const minutes = parseFloat(data.get("manualMinutes") as string) || 0;
    const durationSeconds = Math.round((hours * 3600) + (minutes * 60));

    if (!category) {
      setTimerError("Please select a category.");
      return;
    }
    if (durationSeconds <= 0) {
      setTimerError("Please enter a positive duration.");
      return;
    }
    setTimerError("");
    try {
      const res = await fetch(`/api/admin/requests/${id}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, note, isManual: true, durationSeconds }),
      });
      if (res.ok) {
        form.reset();
        await loadTimeEntries();
      }
    } finally {
      setTimerError("");
    }
  }

  async function deleteTimeEntry(entryId: string) {
    if (!confirm("Delete this time entry? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/requests/${id}/time-entries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entryId }),
      });
      if (res.ok) await loadTimeEntries();
    } catch {}
  }

  function formatTimerDisplay(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function uploadDeliverable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/deliverables`, {
        method: "POST",
        body: data,
      });
      if (res.ok) {
        form.reset();
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function setDeliverableVisibility(deliverableId: string, visibility: "RELEASED" | "DRAFT") {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/requests/${id}/deliverables/${deliverableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => null);
        const reasons: string[] = data?.reasons ?? [];
        setError(
          reasons.length > 0
            ? `Cannot release yet: ${reasons.join(" ")} (${res.status})`
            : data?.error || `Release failed (${res.status})`
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Update failed");
      } else {
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note }),
      });
      if (res.ok) { setNote(""); await load(); }
    } finally { setSaving(false); }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      if (res.ok) { setReply(""); await load(); }
    } finally { setSaving(false); }
  }

  async function addDocRequest() {
    if (!docReqTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docReqTitle }),
      });
      if (res.ok) { setDocReqTitle(""); await load(); }
    } finally { setSaving(false); }
  }

  if (!detail) return <p className="p-8 text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/requests" className="text-sm text-muted-foreground hover:underline">← All requests</Link>
        <h1 className="mt-2 text-2xl font-semibold">{detail.requestType || detail.service}</h1>
        <p className="text-sm text-muted-foreground">
          {detail.client.name} · {detail.service} · Requested by {detail.requesterName || "—"}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</p>}

      {/* Initial Review entry (QuickBooks Cleanup engagements) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div>
          <h2 className="font-medium flex items-center gap-2"><ClipboardCheck className="size-4" /> Initial Review</h2>
          <p className="text-sm text-muted-foreground">20-category QB Cleanup review checklist — records what was discovered (not cleanup itself).</p>
        </div>
        <a
          href={`/admin/requests/${id}/qb-review`}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Initial Review →
        </a>
      </div>

      {/* AI Assistant entry */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-cream p-4">
        <div>
          <h2 className="font-medium flex items-center gap-2"><Sparkles className="size-4 text-gold" /> PK AI Assistant</h2>
          <p className="text-sm text-muted-foreground">Automated initial-review analysis, prioritized findings, scope alerts, and targeted questions — your judgment decides.</p>
        </div>
        <a
          href={`/admin/requests/${id}/ai-assistant`}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-charcoal px-5 text-sm font-medium text-ivory hover:bg-charcoal/90"
        >
          Open AI Assistant →
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-medium">Manage</h2>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={detail.status}
              disabled={saving}
              onChange={(e) => patch({ status: e.target.value })}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Assigned staff</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={detail.assignedStaff?.id || ""}
              disabled={saving}
              onChange={(e) => patch({ assignedStaffId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </div>
          {detail.clientNotes && (
            <div>
              <label className="text-xs text-muted-foreground">Client notes</label>
              <p className="mt-1 rounded-md bg-muted p-3 text-sm">{detail.clientNotes}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-medium">Documents</h2>
          {detail.documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
          <ul className="space-y-1 text-sm">
            {detail.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span className="truncate">{d.fileName}</span>
                <span className="text-xs text-muted-foreground">{d.reviewStatus}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 text-sm font-medium">Requested documents</h3>
          <ul className="space-y-1 text-sm">
            {detail.documentRequests.map((dr) => (
              <li key={dr.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span>{dr.title}{dr.required && <span className="text-red-500"> *</span>}</span>
                <span className="text-xs text-muted-foreground">{dr.status}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Request a document…"
              value={docReqTitle}
              onChange={(e) => setDocReqTitle(e.target.value)}
            />
            <button onClick={addDocRequest} disabled={saving || !docReqTitle.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Deliverables (admin uploads) */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-medium">Deliverables</h2>
          <form onSubmit={uploadDeliverable} className="flex gap-2">
            <input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.webp" className="text-sm" />
            <input
              name="title"
              placeholder="Title (e.g. Cleanup Report)"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              required
            />
            <Button type="submit" disabled={saving} className="min-h-10">
              <Upload className="size-3.5" /> Upload
            </Button>
          </form>
        </div>
        {detail.deliverables.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No deliverables uploaded yet.</p>
        ) : (
          <ul className="space-y-1">
            {detail.deliverables.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-4 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{d.title}</p>
                  <p className="text-xs text-muted-gray">{d.fileName}</p>
                  <p className="mt-0.5 text-xs font-medium">
                    {d.visibility === "RELEASED" ? (
                      <span className="text-green-700">● Released to client</span>
                    ) : (
                      <span className="text-muted-gray">● Draft — hidden from client</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {d.visibility === "RELEASED" ? (
                    <button
                      type="button"
                      onClick={() => setDeliverableVisibility(d.id, "DRAFT")}
                      disabled={saving}
                      className="min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      Retract
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeliverableVisibility(d.id, "RELEASED")}
                      disabled={saving}
                      className="min-h-[44px] rounded-md bg-charcoal px-3 py-2 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      Release to client
                    </button>
                  )}
                  <a
                    href={`/api/admin/requests/${id}/deliverables/${d.id}`}
                    target="_blank"
                    rel="noopener"
                    className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-muted"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    <span className="sr-only">Download {d.title}</span>
                    <span aria-hidden="true">Download</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* === Time tracking (admin only) === */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-medium flex items-center gap-2">
            <Timer className="size-4" /> Engagement time tracking
          </h2>
          {timeTotals.totalHours > 0 && (
            <div className="text-right text-xs">
              <div className="text-muted-foreground">Actual / Estimated</div>
              <div className="text-sm font-medium">
                {timeTotals.totalHours.toFixed(2)}h / 24h
                {timeTotals.totalHours > 24 && <span className="text-rose-600 ml-1">(exceeded)</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                Billable: ${timeTotals.totalBillable.toFixed(2)} @ $75/hr
              </div>
            </div>
          )}
        </div>

        {timerError && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{timerError}</p>
        )}

        {/* Timer controls */}
        <div className="flex flex-wrap items-center gap-4">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm min-w-[220px]"
            value={timerCategory}
            onChange={(e) => setTimerCategory(e.target.value)}
          >
            <option value="">Select work category…</option>
            {timeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button
            className="min-h-10"
            disabled={timerRunning || saving}
            onClick={startTimer}
          >
            <Play className="size-3.5 mr-1" /> Start
          </Button>
          {timerRunning && (
            <Button className="min-h-10" variant="destructive" onClick={stopTimer}>
              <Square className="size-3.5 mr-1" /> Stop
            </Button>
          )}
        </div>

        {/* Active timer display */}
        {timerRunning && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  {timerActiveId ? "Timer running — session in progress" : "Timer running"}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-mono font-semibold tabular-nums tracking-wider">
                    {formatTimerDisplay(timerSeconds + (timerActiveId ? (Date.now() - new Date().getTime()) / 1000 : 0))}
                  </span>
                  <span className="text-sm text-muted-foreground">elapsed</span>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                Category: <span className="text-foreground">{timerCategory}</span>
              </div>
            </div>
            <input
              className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Optional work note…"
              value={timerNote}
              onChange={(e) => setTimerNote(e.target.value)}
            />
          </div>
        )}

        {/* Manual entry form */}
        {!timerRunning && (
          <form onSubmit={addManualEntry} className="rounded-md border border-dashed border-border p-4 space-y-3">
            <div className="text-sm font-medium">Add manual time entry</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <select name="manualCategory" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {timeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hours</label>
                <input type="number" name="manualHours" min="0" step="0.01" defaultValue="0" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Minutes</label>
                <input type="number" name="manualMinutes" min="0" step="1" defaultValue="0" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <input name="manualNote" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="What was worked on…" />
            </div>
            <Button type="submit" className="min-h-10">
              <RotateCcw className="size-3.5 mr-1" /> Add manual entry
            </Button>
          </form>
        )}

        {/* Time entries list */}
        <div className="border-t border-border pt-3">
          <h3 className="text-sm font-medium mb-2">Time entries</h3>
          {timeEntries.length === 0 && (
            <p className="text-sm text-muted-foreground">No time tracked yet.</p>
          )}
          <ul className="space-y-2">
            {timeEntries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{entry.category}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {entry.isManual ? "Manual entry" : "Timer session"}
                    {' '}
                    · {entry.userName}
                    {' '}
                    {entry.isRunning && <span className="text-emerald-600 font-medium">● running</span>}
                  </div>
                  {entry.durationDisplay && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Duration: {entry.durationDisplay}
                    </div>
                  )}
                  {entry.note && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.note}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-medium">{entry.durationDisplay}</div>
                  {entry.isRunning && <span className="text-xs text-emerald-600">live</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Client messages</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.messages.length === 0 && <li className="text-muted-foreground">No messages.</li>}
          {detail.messages.map((m) => (
            <li key={m.id} className={`rounded-md p-3 ${m.isFromStaff ? "bg-primary/10" : "bg-muted"}`}>
              <p>{m.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.authorName} · {new Date(m.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Reply to client…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button onClick={sendReply} disabled={saving || !reply.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Internal notes <span className="text-xs font-normal text-muted-foreground">(never visible to clients)</span></h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.internalNotes.map((n) => (
            <li key={n.id} className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3">
              <p>{n.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Add internal note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={addNote} disabled={saving || !note.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
