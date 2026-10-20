"use client";

import { useEffect, useState } from "react";

type Status = string;

interface CatchupIntake {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  contactMethod: string;
  contactTime: string | null;
  taxYears: string[];
  filingStatuses: Record<string, string>;
  alreadyFiled: Record<string, string>;
  complexity: string[];
  notes: string | null;
  states: string[];
  hasNotices: boolean;
  recordsStatus: string;
  simpleEligible: boolean;
  status: Status;
  emailSent: boolean;
  createdAt: string;
}

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "NEW_LEAD", label: "New lead" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
  { value: "QUOTE_SENT", label: "Quote sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DOCUMENTS_REQUESTED", label: "Documents requested" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
];

const STATUS_STYLES: Record<string, string> = {
  NEW_LEAD: "bg-gold/15 text-charcoal",
  NEEDS_REVIEW: "bg-amber-100 text-amber-900",
  QUOTE_SENT: "bg-blue-100 text-blue-900",
  ACCEPTED: "bg-green-100 text-green-900",
  DOCUMENTS_REQUESTED: "bg-purple-100 text-purple-900",
  IN_PROGRESS: "bg-indigo-100 text-indigo-900",
  COMPLETED: "bg-emerald-100 text-emerald-900",
};

const filingStatusLabels: Record<string, string> = {
  single: "Single",
  married_jointly: "Married filing jointly",
  married_separately: "Married filing separately",
  head_of_household: "Head of household",
  qualifying_surviving_spouse: "Qualifying surviving spouse",
  unknown: "Not sure yet",
};

const alreadyFiledLabels: Record<string, string> = {
  no: "Not yet filed",
  yes: "Already filed",
  not_sure: "Not sure",
};

const recordsLabels: Record<string, string> = {
  ready: "Records ready",
  some_missing: "Some records missing",
  mostly_missing: "Most records missing",
  not_sure: "Not sure yet",
};

export default function TaxCatchupIntakePage() {
  const [intakes, setIntakes] = useState<CatchupIntake[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "NEW_LEAD">("all");

  useEffect(() => {
    async function fetchIntakes() {
      try {
        const res = await fetch("/api/admin/catchup-intakes");
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        setIntakes(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load Catch-Up 1040 intakes");
        setIntakes([]);
      }
    }
    fetchIntakes();
  }, []);

  async function updateStatus(id: string, status: Status) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/catchup-intakes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Update failed (${res.status})`);
      }
      setIntakes((prev) =>
        (prev ?? []).map((i) => (i.id === id ? { ...i, status } : i)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const shown = (intakes ?? []).filter(
    (i) => filter === "all" || i.status === "NEW_LEAD",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="pk-heading text-2xl font-semibold">Catch-Up 1040 intake</h1>
          <p className="mt-1 text-sm text-muted-gray">
            Public screening intake from pkservices.business/tax. Non-sensitive
            by design: no SSNs, DOBs, bank details, or tax documents are
            collected here. Quote final pricing only after review.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { value: "all", label: "All" },
              { value: "NEW_LEAD", label: "New leads" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={
                filter === tab.value
                  ? "rounded-lg bg-charcoal px-3 py-1.5 text-sm font-semibold text-ivory"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {intakes === null ? (
        <p className="text-sm text-muted-gray">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-gray">
          No Catch-Up 1040 intakes{filter === "NEW_LEAD" ? " in new-lead status" : ""} yet.
        </p>
      ) : (
        <div className="space-y-4">
          {shown.map((intake) => (
            <article
              key={intake.id}
              className="rounded-2xl border border-border bg-cream p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-charcoal">{intake.fullName}</p>
                  <p className="text-sm text-muted-gray">
                    {intake.email}
                    {intake.phone ? ` · ${intake.phone}` : ""} · contact by{" "}
                    {intake.contactMethod === "phone" ? "phone" : "email"}
                    {intake.contactTime ? ` (${intake.contactTime})` : ""}
                  </p>
                  <p className="text-xs text-muted-gray">
                    {new Date(intake.createdAt).toLocaleString()}
                    {intake.emailSent ? " · emails sent" : " · email not sent"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "rounded-full px-3 py-1 text-xs font-semibold " +
                      (STATUS_STYLES[intake.status] ?? "bg-border text-charcoal")
                    }
                  >
                    {STATUS_OPTIONS.find((s) => s.value === intake.status)?.label ?? intake.status}
                  </span>
                  <select
                    aria-label={`Update status for ${intake.fullName}`}
                    value={intake.status}
                    disabled={busyId === intake.id}
                    onChange={(e) => updateStatus(intake.id, e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-charcoal">Years requested</p>
                  <ul className="mt-1 space-y-1 text-muted-gray">
                    {intake.taxYears.map((year) => (
                      <li key={year}>
                        {year}: {filingStatusLabels[intake.filingStatuses[year] ?? "unknown"] ?? "?"} ·{" "}
                        {alreadyFiledLabels[intake.alreadyFiled[year] ?? "not_sure"] ?? "?"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-charcoal">Screening</p>
                  <p className="mt-1 text-muted-gray">
                    Income: {intake.complexity.join(", ")}
                  </p>
                  <p className="mt-1 text-muted-gray">
                    States: {intake.states.join(", ")}
                  </p>
                  <p className="mt-1 text-muted-gray">
                    Notices: {intake.hasNotices ? "Yes" : "No"} · Records:{" "}
                    {recordsLabels[intake.recordsStatus] ?? intake.recordsStatus}
                  </p>
                  <p className="mt-1 text-muted-gray">
                    Screened as $99-eligible for every selected year:{" "}
                    {intake.simpleEligible ? "Yes (confirm at review)" : "No — quote after review"}
                  </p>
                </div>
              </div>

              {intake.notes ? (
                <div className="mt-4 rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-gray">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-gray">
                    {intake.notes}
                  </p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
