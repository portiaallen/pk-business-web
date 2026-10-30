"use client";

import { useEffect, useState } from "react";

type Status = string;

interface CpaPartnerApplication {
  id: string;
  intakeSubmissionId: string | null;
  firmName: string;
  contactName: string;
  email: string;
  phone: string | null;
  serviceNeeds: string[];
  partnershipModel: string;
  scopeNotes: string;
  acknowledgement: boolean;
  status: Status;
  internalNotes: Array<{ at: string; author: string; text: string }>;
  quoteAmount: string | null;
  quoteNotes: string | null;
  secureFolderName: string | null;
  secureFolderAccess: string | null;
  onboardingNotes: string | null;
  onboardingComplete: boolean;
  emailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "NEW_APPLICATION", label: "New application" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "QUOTE_SENT", label: "Quote sent" },
  { value: "APPROVED", label: "Approved" },
  { value: "DECLINED", label: "Declined" },
  { value: "ONBOARDED", label: "Onboarded" },
];

const STATUS_STYLES: Record<string, string> = {
  NEW_APPLICATION: "bg-gold/15 text-charcoal",
  IN_REVIEW: "bg-amber-100 text-amber-900",
  QUOTE_SENT: "bg-blue-100 text-blue-900",
  APPROVED: "bg-green-100 text-green-900",
  DECLINED: "bg-red-100 text-red-900",
  ONBOARDED: "bg-emerald-100 text-emerald-900",
};

const SERVICE_LABELS: Record<string, string> = {
  monthly_bookkeeping: "Monthly bookkeeping",
  cleanup_catchup: "Cleanup / catch-up",
  tax_ready_books: "Tax-ready books",
  practice_overflow: "Practice overflow",
};

const MODEL_LABELS: Record<string, string> = {
  white_label: "White-label",
  named: "Named partner",
  hybrid: "Hybrid",
  unsure: "Not sure yet",
};

export default function CpaPartnersPage() {
  const [applications, setApplications] = useState<CpaPartnerApplication[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [accessDraft, setAccessDraft] = useState("");
  const [onboardingDraft, setOnboardingDraft] = useState("");
  const [quoteAmountDraft, setQuoteAmountDraft] = useState("");
  const [quoteNotesDraft, setQuoteNotesDraft] = useState("");

  useEffect(() => {
    async function fetchApplications() {
      try {
        const res = await fetch("/api/admin/cpa-partners");
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = (await res.json()) as CpaPartnerApplication[];
        setApplications(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load applications");
        setApplications([]);
      }
    }
    void fetchApplications();
  }, []);

  const visible = (applications ?? []).filter(
    (a) => filter === "all" || a.status === filter,
  );

  function expand(a: CpaPartnerApplication) {
    setExpandedId(a.id === expandedId ? null : a.id);
    setNoteDraft("");
    setFolderDraft(a.secureFolderName ?? "");
    setAccessDraft(a.secureFolderAccess ?? "");
    setOnboardingDraft(a.onboardingNotes ?? "");
    setQuoteAmountDraft(a.quoteAmount ?? "");
    setQuoteNotesDraft(a.quoteNotes ?? "");
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/cpa-partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Update failed (${res.status})`);
      }
      const updated = (await res.json()) as { id: string; status: Status };
      setApplications((prev) =>
        (prev ?? []).map((a) =>
          a.id === id ? { ...a, status: updated.status, ...mergeLocal(a, payload) } : a,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      const res2 = await fetch("/api/admin/cpa-partners");
      if (res2.ok) setApplications((await res2.json()) as CpaPartnerApplication[]);
    } finally {
      setBusyId(null);
    }
  }

  function mergeLocal(
    a: CpaPartnerApplication,
    payload: Record<string, unknown>,
  ): Partial<CpaPartnerApplication> {
    const out: Record<string, unknown> = {};
    if (typeof payload.quoteAmount === "string") out.quoteAmount = payload.quoteAmount;
    if (typeof payload.quoteNotes === "string") out.quoteNotes = payload.quoteNotes;
    if (typeof payload.secureFolderName === "string") out.secureFolderName = payload.secureFolderName;
    if (typeof payload.secureFolderAccess === "string") out.secureFolderAccess = payload.secureFolderAccess;
    if (typeof payload.onboardingNotes === "string") out.onboardingNotes = payload.onboardingNotes;
    if (payload.onboardingComplete === true) out.onboardingComplete = true;
    if (typeof payload.newInternalNote === "string" && payload.newInternalNote.trim()) {
      out.internalNotes = [
        ...a.internalNotes,
        { at: new Date().toISOString(), author: "you", text: payload.newInternalNote.trim() },
      ];
    }
    return out;
  }

  const expanded = (applications ?? []).find((a) => a.id === expandedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">PK Practice Partners</h1>
          <p className="mt-1 text-sm text-muted-gray">
            CPA firm applications. Founder approval is required to approve, decline, or onboard a firm.
          </p>
        </div>
        <select
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | Status)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-gray">
        <p className="font-semibold text-foreground">Day-one manual onboarding checklist (founder)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>In the pksecuredocument@gmail.com Drive (PK Command Center Tablet only), create one isolated folder named for the approved firm.</li>
          <li>Share that folder with named PK accounts only. Never use &quot;anyone with the link&quot;.</li>
          <li>Keep a separate controlled document submission area for incoming firm files, and a Viewer-only area for PK deliverables back to the firm.</li>
          <li>Record the folder name and named-account access details on this partner record only. Never post folder links on public pages.</li>
          <li>Confirm the document upload method against the existing tax-security policy before any taxpayer files are accepted.</li>
        </ol>
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {applications === null ? (
        <p className="mt-6 text-sm text-muted-gray">Loading applications...</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-gray">No applications in this view.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {visible.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{a.firmName}</h2>
                  <p className="mt-1 text-sm text-muted-gray">
                    {a.contactName} &middot; {a.email}
                    {a.phone ? ` &middot; ${a.phone}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-gray">
                    {MODEL_LABELS[a.partnershipModel] ?? a.partnershipModel} &middot;{" "}
                    {a.serviceNeeds.map((s) => SERVICE_LABELS[s] ?? s).join(", ")} &middot;{" "}
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-800"}`}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === a.status)?.label ?? a.status}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-gray-50"
                    onClick={() => expand(a)}
                  >
                    {a.id === expandedId ? "Close" : "Open"}
                  </button>
                </div>
              </div>

              {a.id === expandedId && expanded ? (
                <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                  <div>
                    <p className="font-semibold">Scope (non-sensitive, as submitted)</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-gray">{a.scopeNotes}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        disabled={busyId === a.id || s.value === a.status}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                        onClick={() => void patch(a.id, { status: s.value })}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="font-semibold">Quote amount</span>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2"
                        value={quoteAmountDraft}
                        onChange={(e) => setQuoteAmountDraft(e.target.value)}
                        placeholder="e.g. $1,200/month"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold">Quote notes</span>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2"
                        value={quoteNotesDraft}
                        onChange={(e) => setQuoteNotesDraft(e.target.value)}
                        placeholder="Scope, timeline, deposit terms"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold">Secure folder (internal only)</span>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2"
                        value={folderDraft}
                        onChange={(e) => setFolderDraft(e.target.value)}
                        placeholder="Folder name in pksecuredocument Drive"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold">Named-account access (internal only)</span>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2"
                        value={accessDraft}
                        onChange={(e) => setAccessDraft(e.target.value)}
                        placeholder="Which named accounts have access"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="font-semibold">Onboarding notes (internal only)</span>
                      <textarea
                        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2"
                        rows={3}
                        value={onboardingDraft}
                        onChange={(e) => setOnboardingDraft(e.target.value)}
                        placeholder="Manual day-one steps completed, receipt/status log location"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      className="rounded-md bg-charcoal px-4 py-2 text-xs font-semibold text-ivory hover:opacity-90 disabled:opacity-40"
                      onClick={() =>
                        void patch(a.id, {
                          quoteAmount: quoteAmountDraft || null,
                          quoteNotes: quoteNotesDraft || null,
                          secureFolderName: folderDraft || null,
                          secureFolderAccess: accessDraft || null,
                          onboardingNotes: onboardingDraft || null,
                        })
                      }
                    >
                      Save internal fields
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id || a.onboardingComplete}
                      className="rounded-md border border-border px-4 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                      onClick={() => void patch(a.id, { onboardingComplete: true })}
                    >
                      Mark onboarding complete
                    </button>
                  </div>
                  <div>
                    <p className="font-semibold">Internal notes</p>
                    <ul className="mt-2 space-y-1 text-muted-gray">
                      {a.internalNotes.length === 0 ? (
                        <li className="text-xs">No notes yet.</li>
                      ) : (
                        a.internalNotes.map((n, i) => (
                          <li key={i} className="text-xs">
                            {new Date(n.at).toLocaleString()} &middot; {n.author}: {n.text}
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="w-full rounded-md border border-border bg-white px-3 py-2"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add an internal note (append-only)"
                      />
                      <button
                        type="button"
                        disabled={busyId === a.id || !noteDraft.trim()}
                        className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                        onClick={() => {
                          void patch(a.id, { newInternalNote: noteDraft });
                          setNoteDraft("");
                        }}
                      >
                        Add note
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-gray">
                    Notification email {a.emailSent ? "sent" : "not sent"}. Firm retains its client
                    relationship; PK does not solicit partner firms&apos; clients.
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
