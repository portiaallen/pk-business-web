"use client";
import { useCallback, useEffect, useState } from "react";
import { readinessFetch, human } from "@/components/readiness/client";
import {
  RecommendationEditor,
  blankRecommendation,
} from "@/components/readiness/RecommendationEditor";
import type { LibraryInput } from "@/lib/readiness/policy";
type Entry = LibraryInput & {
  id: string;
  version: number;
  assignments: {
    assessmentId: string;
    sourceVersion: number;
    active: boolean;
  }[];
};
export default function LibraryPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        q: query,
        category,
        type,
        active: String(activeOnly),
      });
      const result = await readinessFetch(
        `/api/admin/readiness/recommendations?${params}`,
      );
      setEntries(result.entries);
      setCanWrite(result.canWrite);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }, [query, category, type, activeOnly]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function mutate(input: object) {
    setBusy(true);
    setMessage("");
    try {
      await readinessFetch(
        "/api/admin/readiness/recommendations",
        undefined,
        input,
      );
      setSelected(null);
      setMessage(
        "Recommendation saved. Delivered reports retain their snapshots.",
      );
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl font-semibold">Outside Recommendation Library</h1>
      <p>
        Manage reusable professional types, services, resources and
        intentionally selected named providers. Changes affect future selection;
        delivered report snapshots stay unchanged.
      </p>
      <p role="status">{message}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          Search title or category
          <input
            className="mt-1 block min-h-12 w-full rounded border p-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Category
          <input
            className="mt-1 block min-h-12 w-full rounded border p-3"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        <label>
          Type
          <select
            className="mt-1 block min-h-12 w-full rounded border p-3"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All types</option>
            {[
              "PROFESSIONAL_TYPE",
              "SERVICE_TYPE",
              "NAMED_PROVIDER",
              "RESOURCE",
            ].map((value) => (
              <option key={value} value={value}>
                {human(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(event) => setActiveOnly(event.target.checked)}
        />
        Active only
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {entries.map((entry) => (
            <article className="space-y-2 rounded border p-4" key={entry.id}>
              <h2 className="text-xl font-semibold">{entry.title}</h2>
              <p>
                {entry.category} · {human(entry.recommendationType)} · v
                {entry.version}
              </p>
              <p>
                {human(entry.relationshipClassification)} ·{" "}
                {entry.archived
                  ? "Archived"
                  : entry.active
                    ? "Active"
                    : "Inactive"}
              </p>
              <p>{entry.clientFacingDescription}</p>
              <p>
                {entry.disclosureText ||
                  "Informational resource only. PK has not verified this resource. No outcome is guaranteed."}
              </p>
              <p>{entry.assignments.length} historical assignment(s)</p>
              <details>
                <summary>Usage history</summary>
                {entry.assignments.map((usage, i) => (
                  <p key={`${usage.assessmentId}-${i}`}>
                    Assessment {usage.assessmentId} · source v
                    {usage.sourceVersion} ·{" "}
                    {usage.active ? "In current draft" : "Historical"}
                  </p>
                ))}
              </details>
              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border px-3 py-2"
                    onClick={() => setSelected(entry)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded border px-3 py-2"
                    disabled={busy}
                    onClick={() =>
                      void mutate({ action: "DUPLICATE", id: entry.id })
                    }
                  >
                    Duplicate
                  </button>
                  <button
                    className="rounded border px-3 py-2"
                    disabled={busy}
                    onClick={() =>
                      void mutate({
                        action: "ARCHIVE",
                        id: entry.id,
                        expectedVersion: entry.version,
                      })
                    }
                  >
                    Archive
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="space-y-3">
          {canWrite ? (
            <>
              <h2 className="text-xl font-semibold">
                {selected ? "Edit recommendation" : "Create recommendation"}
              </h2>
              {selected && (
                <button
                  className="rounded border px-3 py-2"
                  onClick={() => setSelected(null)}
                >
                  Create a new entry instead
                </button>
              )}
              <RecommendationEditor
                key={selected?.id + ":" + selected?.version}
                initial={
                  selected
                    ? ({
                        ...blankRecommendation,
                        ...Object.fromEntries(
                          Object.keys(blankRecommendation).map((key) => [
                            key,
                            selected[key as keyof LibraryInput],
                          ]),
                        ),
                      } as LibraryInput)
                    : blankRecommendation
                }
                busy={busy}
                onSave={(entry) =>
                  void mutate(
                    selected
                      ? {
                          action: "UPDATE",
                          id: selected.id,
                          expectedVersion: selected.version,
                          entry,
                        }
                      : { action: "CREATE", entry },
                  )
                }
              />
            </>
          ) : (
            <p>
              View-only access. A recent passkey session and explicit
              library-write permission are required to mutate entries.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
