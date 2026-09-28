"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Building2, CheckCircle2, Circle } from "lucide-react";

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
  createdAt: string;
};

export default function ConsultationsPage() {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new">("all");

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

      {subs === null ? (
        <p className="text-sm text-muted-gray">Loading consultations…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="font-medium text-charcoal">No {filter === "new" ? "new " : ""}consultations yet</p>
          <p className="mt-1 text-sm text-muted-gray">
            Website consultation requests will appear here the moment they're submitted.
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
                </div>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
