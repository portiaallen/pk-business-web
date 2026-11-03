"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Building2, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { confirmDelete } from "@/lib/confirm-delete";
import { CLARITY_TIME_CATEGORIES } from "@/lib/clarity-fulfillment";

type Submission = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  service: string;
  description: string;
  contactMethod: string;
  processed: boolean;
  sourceChannel: string | null;
  questionnaireVersion: string | null;
  questionnaireJson: string | null;
  fulfillmentStatus: string;
  assignedToUserId: string | null;
  createdAt: string;
};

type TeamMember = { id: string; name: string | null; role: string };
type TimeEntryRow = {
  id: string;
  userName: string | null;
  category: string;
  note: string | null;
  startedAt: string;
  stoppedAt: string | null;
  durationDisplay: string;
  isRunning: boolean;
};

const FULFILLMENT_STATUSES = ["new", "in_review", "awaiting_client", "fulfilled"] as const;

function formatQuestionnaire(json: string): string {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => {
        const label = key
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        if (Array.isArray(value)) {
          return `${label}: ${value
            .map((item) =>
              typeof item === "object" && item !== null
                ? Object.values(item as Record<string, unknown>).join(" / ")
                : String(item)
            )
            .join(" | ")}`;
        }
        return `${label}: ${String(value)}`;
      })
      .join("\n");
  } catch {
    return "(answers unavailable)";
  }
}

export default function ConsultationsPage() {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new">("all");
  const [deleteError, setDeleteError] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [openTimeId, setOpenTimeId] = useState<string | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);
  const [timeTotals, setTimeTotals] = useState<{ totalDisplay: string }>({ totalDisplay: "0:00:00" });
  const [timeError, setTimeError] = useState("");
  const [timeBusy, setTimeBusy] = useState(false);
  const [timeCategory, setTimeCategory] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");

  async function deleteSubmission(id: string, name: string) {
    if (!confirmDelete(`Permanently delete the consultation from ${name}? This cannot be undone.`)) return;
    setBusyId(id);
    setDeleteError("");
    try {
      const res = await fetch("/api/admin/intake-submissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || `Delete failed (${res.status})`);
      }
    } catch {
      setDeleteError("Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function load() {
    try {
      const res = await fetch("/api/admin/intake-submissions");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setSubs(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load consultations");
      setSubs([]);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/admin/team")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: TeamMember[]) =>
        setTeam(rows.filter((u) => u.role === "ADMIN" || u.role === "STAFF"))
      )
      .catch(() => setTeam([]));
  }, []);

  async function toggleProcessed(id: string, processed: boolean) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/intake-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, processed }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function updateFulfillment(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/intake-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Update failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function loadTime(id: string) {
    setTimeError("");
    try {
      const res = await fetch(`/api/admin/intake-submissions/${id}/time-entries`);
      if (!res.ok) throw new Error(`Failed to load time entries (${res.status})`);
      const data = (await res.json()) as { entries: TimeEntryRow[]; totals: { totalDisplay: string } };
      setTimeEntries(data.entries);
      setTimeTotals(data.totals);
    } catch (e) {
      setTimeError(e instanceof Error ? e.message : "Failed to load time entries");
      setTimeEntries([]);
    }
  }

  function toggleTimePanel(id: string) {
    if (openTimeId === id) {
      setOpenTimeId(null);
      return;
    }
    setOpenTimeId(id);
    setTimeCategory("");
    setTimeNote("");
    setManualMinutes("");
    loadTime(id);
  }

  async function timeAction(id: string, method: string, body: Record<string, unknown>) {
    setTimeBusy(true);
    setTimeError("");
    try {
      const res = await fetch(`/api/admin/intake-submissions/${id}/time-entries`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      await loadTime(id);
    } catch (e) {
      setTimeError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setTimeBusy(false);
    }
  }

  async function startTimer(id: string) {
    if (!timeCategory) {
      setTimeError("Pick a category first.");
      return;
    }
    await timeAction(id, "POST", { category: timeCategory, note: timeNote });
  }

  async function stopTimer(id: string, entryId: string) {
    await timeAction(id, "PATCH", { id: entryId });
  }

  async function addManual(id: string) {
    const minutes = Number(manualMinutes);
    if (!timeCategory || !Number.isFinite(minutes) || minutes <= 0) {
      setTimeError("Pick a category and enter minutes.");
      return;
    }
    await timeAction(id, "POST", {
      category: timeCategory,
      note: timeNote,
      isManual: true,
      durationSeconds: Math.round(minutes * 60),
    });
    setTimeNote("");
    setManualMinutes("");
  }

  async function deleteEntry(id: string, entryId: string) {
    if (!confirmDelete("Delete this time entry? This cannot be undone.")) return;
    await timeAction(id, "DELETE", { id: entryId });
  }

  const visible = (subs ?? []).filter((s) => (filter === "new" ? !s.processed : true));
  const newCount = (subs ?? []).filter((s) => !s.processed).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Consultations</h1>
          <p className="text-sm text-muted-gray">
            Website consultation requests. {subs ? `${newCount} new · ${subs.length} total` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Filter consultations">
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={`min-h-[44px] rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              filter === "all"
                ? "border-charcoal bg-charcoal text-background"
                : "border-border bg-background text-charcoal hover:bg-muted"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("new")}
            aria-pressed={filter === "new"}
            className={`min-h-[44px] rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              filter === "new"
                ? "border-charcoal bg-charcoal text-background"
                : "border-border bg-background text-charcoal hover:bg-muted"
            }`}
          >
            New only{newCount > 0 ? ` (${newCount})` : ""}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {deleteError && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {deleteError}
        </p>
      )}

      {subs === null ? (
        <p className="text-sm text-muted-gray">Loading consultations…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="font-medium text-charcoal">No {filter === "new" ? "new " : ""}consultations yet</p>
          <p className="mt-1 text-sm text-muted-gray">
            Website consultation requests will appear here the moment they&apos;re submitted.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => (
            <li
              key={s.id}
              className={`rounded-lg border bg-card p-4 ${s.processed ? "border-border opacity-75" : "border-gold/50"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-charcoal">
                    {s.fullName}
                    {s.businessName ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm text-muted-gray">
                        <Building2 className="size-3.5" aria-hidden="true" />
                        {s.businessName}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-gray">
                    {s.service} · {new Date(s.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <a href={`mailto:${s.email}`} className="inline-flex min-h-[32px] items-center gap-1.5 text-charcoal underline-offset-2 hover:underline">
                      <Mail className="size-4" aria-hidden="true" /> {s.email}
                    </a>
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="inline-flex min-h-[32px] items-center gap-1.5 text-charcoal underline-offset-2 hover:underline">
                        <Phone className="size-4" aria-hidden="true" /> {s.phone}
                      </a>
                    ) : null}
                    <span className="text-muted-gray">Prefers: {s.contactMethod}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal">{s.description}</p>
                  {s.sourceChannel && (
                    <p className="mt-2 text-xs text-muted-gray">
                      Source: <span className="font-medium text-charcoal">{s.sourceChannel}</span>
                      {s.questionnaireVersion ? ` · questionnaire ${s.questionnaireVersion}` : ""}
                    </p>
                  )}
                  {s.questionnaireJson && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-charcoal underline">
                        Product intake answers
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-cream p-3 text-xs leading-relaxed text-charcoal">
                        {formatQuestionnaire(s.questionnaireJson)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => toggleProcessed(s.id, !s.processed)}
                    disabled={busyId === s.id}
                    aria-pressed={s.processed}
                    className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {s.processed ? (
                      <>
                        <CheckCircle2 className="size-4 text-green-700" aria-hidden="true" />
                        Processed
                      </>
                    ) : (
                      <>
                        <Circle className="size-4 text-gold" aria-hidden="true" />
                        Mark processed
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSubmission(s.id, s.fullName)}
                    disabled={busyId === s.id}
                    className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Clarity fulfillment (M3): status, assignment, time tracking */}
              <div className="mt-4 space-y-3 rounded-md border border-border bg-cream/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-charcoal">
                    Status
                    <select
                      value={s.fulfillmentStatus}
                      onChange={(e) => updateFulfillment(s.id, { fulfillmentStatus: e.target.value })}
                      disabled={busyId === s.id}
                      className="min-h-[36px] rounded-md border border-border bg-background px-2 py-1 text-sm text-charcoal"
                    >
                      {FULFILLMENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-charcoal">
                    Assigned to
                    <select
                      value={s.assignedToUserId ?? ""}
                      onChange={(e) =>
                        updateFulfillment(s.id, { assignedToUserId: e.target.value || null })
                      }
                      disabled={busyId === s.id || team.length === 0}
                      className="min-h-[36px] max-w-[220px] rounded-md border border-border bg-background px-2 py-1 text-sm text-charcoal"
                    >
                      <option value="">Unassigned</option>
                      {team.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.id} ({u.role.toLowerCase()})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <details>
                  <summary
                    className="cursor-pointer text-xs font-medium text-charcoal underline"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleTimePanel(s.id);
                    }}
                  >
                    Fulfillment time
                  </summary>
                  {openTimeId === s.id && (
                    <div className="mt-2 space-y-2 text-sm">
                      {timeError && <p className="text-xs text-red-800">{timeError}</p>}
                      <p className="text-xs text-muted-gray">
                        Total logged: {timeTotals.totalDisplay}
                      </p>
                      <ul className="space-y-1">
                        {timeEntries.map((t) => (
                          <li key={t.id} className="flex flex-wrap items-center gap-2 text-xs text-charcoal">
                            <span className="font-medium">{t.category}</span>
                            <span>{t.durationDisplay}</span>
                            <span className="text-muted-gray">
                              {t.userName ?? ""} · {new Date(t.startedAt).toLocaleString()}
                              {t.isRunning ? " · running" : ""}
                            </span>
                            {t.isRunning ? (
                              <button
                                type="button"
                                onClick={() => stopTimer(s.id, t.id)}
                                disabled={timeBusy}
                                className="min-h-[32px] rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-charcoal hover:bg-muted disabled:opacity-50"
                              >
                                Stop
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => deleteEntry(s.id, t.id)}
                                disabled={timeBusy}
                                className="min-h-[32px] rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                          </li>
                        ))}
                        {timeEntries.length === 0 && (
                          <li className="text-xs text-muted-gray">No time logged yet.</li>
                        )}
                      </ul>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={timeCategory}
                          onChange={(e) => setTimeCategory(e.target.value)}
                          className="min-h-[36px] rounded-md border border-border bg-background px-2 py-1 text-xs text-charcoal"
                        >
                          <option value="">Category…</option>
                          {CLARITY_TIME_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={timeNote}
                          onChange={(e) => setTimeNote(e.target.value)}
                          placeholder="Note (optional)"
                          className="min-h-[36px] w-40 rounded-md border border-border bg-background px-2 py-1 text-xs text-charcoal"
                        />
                        <button
                          type="button"
                          onClick={() => startTimer(s.id)}
                          disabled={timeBusy}
                          className="min-h-[36px] rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-charcoal hover:bg-muted disabled:opacity-50"
                        >
                          Start timer
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={manualMinutes}
                          onChange={(e) => setManualMinutes(e.target.value)}
                          placeholder="min"
                          className="min-h-[36px] w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-charcoal"
                        />
                        <button
                          type="button"
                          onClick={() => addManual(s.id)}
                          disabled={timeBusy}
                          className="min-h-[36px] rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-charcoal hover:bg-muted disabled:opacity-50"
                        >
                          Add manual
                        </button>
                      </div>
                    </div>
                  )}
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
