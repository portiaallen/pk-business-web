"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AREAS,
  AREA_LABELS,
  AREA_STATUSES,
  DISPOSITIONS,
  DOCUMENT_KINDS,
  type LibraryInput,
} from "@/lib/readiness/policy";
import { currentClient, readinessFetch, human, date } from "./client";
import {
  RecommendationEditor,
  blankRecommendation,
} from "./RecommendationEditor";

type Finding = {
  id?: string;
  area: (typeof AREAS)[number];
  status: string;
  finding: string;
  evidenceBasis: string;
  whyItMatters: string;
  recommendedAction: string;
  priority: string;
  disposition: string;
  qualifyingServiceId: string | null;
  internalNotes: string;
  ordering: number;
};
type Data = {
  id: string;
  clientId: string;
  requestId: string;
  clientName: string;
  status: string;
  version: number;
  paymentStatus: string;
  intake: Record<string, string | string[]>;
  permissions: { edit: boolean; qa: boolean; credit: boolean };
  findings: Finding[];
  recommendations: {
    id: string;
    findingId: string;
    snapshot: string;
    ordering: number;
    sourceVersion: number | null;
    libraryEntryId: string | null;
  }[];
  summary: string;
  strengths: string;
  priorityConcerns: string;
  limitations: string;
  qaReviewedAt: string | null;
  slaDueAt: string | null;
  slaPausedAt: string | null;
  documents: { id: string; kind: string; status: string; required: boolean }[];
  reports: { id: string; version: number; deliveryState: string }[];
  credit: {
    status: string;
    claimedAt: string | null;
    claimDeadline: string;
    redeemDeadline: string;
    requestedServiceId: string | null;
    qualifyingServiceId: string | null;
    amountAppliedCents: number;
  } | null;
  eligibleServices: { id: string; name: string }[];
  audit: {
    id: string;
    metadata: string;
    createdAt: string;
    actorId: string | null;
  }[];
};
type Entry = LibraryInput & { id: string; version: number };
const blankFinding: Finding = {
  area: "BOOKS",
  status: "INSUFFICIENT_INFORMATION",
  finding: "",
  evidenceBasis: "",
  whyItMatters: "",
  recommendedAction: "",
  priority: "MEDIUM",
  disposition: "NO_ACTION_NEEDED",
  qualifyingServiceId: null,
  internalNotes: "",
  ordering: 0,
};
export function AdminAssessment({ id }: { id: string }) {
  const [a, setA] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState<Finding>(blankFinding);
  const [library, setLibrary] = useState<Entry[]>([]);
  const [source, setSource] = useState("");
  const [outsideFinding, setOutsideFinding] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [report, setReport] = useState("");
  const [customRecommendation, setCustomRecommendation] =
    useState<LibraryInput | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [recommendationSearch, setRecommendationSearch] = useState("");
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const load = useCallback(async () => {
    try {
      const clientId = await currentClient();
      const [data, choices] = await Promise.all([
        readinessFetch(`/api/admin/readiness/${id}`, clientId),
        readinessFetch(`/api/admin/readiness/${id}/services`, clientId),
      ]);
      setA(data);
      setServices(choices.services);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(load);
    void readinessFetch("/api/admin/readiness/recommendations?active=true")
      .then((result) => setLibrary(result.entries))
      .catch(() => {});
  }, [load]);
  async function mutate(input: object) {
    if (!a) return;
    setBusy(true);
    setMessage("");
    try {
      await readinessFetch(`/api/admin/readiness/${id}`, a.clientId, {
        ...input,
        expectedVersion: a.version,
      });
      setMessage("Saved. Audit evidence recorded.");
      setReport("");
      if ("action" in input && input.action === "ASSIGN_RECOMMENDATION") {
        setReplacementId("");
        setCustomRecommendation(null);
      }
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function preview(reportId?: string) {
    if (!a) return;
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/readiness/${id}/report?${reportId ? `reportId=${reportId}` : "preview=true"}`,
        { headers: { "x-pk-client-context": a.clientId }, cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          "Report preview requires all six reviewed areas and complete summary sections",
        );
      setReport(await response.text());
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  if (!a)
    return (
      <section className="p-6">
        <h1 className="text-2xl font-semibold">Readiness review</h1>
        <p role="status">{message || "Loading authorized assessment…"}</p>
        <Link className="underline" href="/security">
          Choose authorized client
        </Link>
      </section>
    );
  const editable =
    a.permissions.edit &&
    ["IN_REVIEW", "REPORT_DRAFT", "QA_REVIEW"].includes(a.status);
  const sourceEntry = library.find((entry) => entry.id === source);
  const entryFields =
    customRecommendation ||
    (sourceEntry
      ? (Object.fromEntries(
          Object.keys(blankRecommendation).map((key) => [
            key,
            sourceEntry[key as keyof LibraryInput],
          ]),
        ) as LibraryInput)
      : blankRecommendation);
  return (
    <section className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <h1 className="text-3xl font-semibold">PK Readiness Review</h1>
      <p>
        {a.clientName} · {human(a.status)} · Payment {human(a.paymentStatus)} ·
        Revision {a.version}
      </p>
      <p>
        Internal target: {date(a.slaDueAt)}{" "}
        {a.slaPausedAt ? "(paused while awaiting information)" : ""}. This is
        not a customer turnaround guarantee.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>
        Record readiness-level findings and evidence summaries. Do not copy tax
        forms, full taxpayer identifiers, credentials or raw document contents
        into these editors.
      </p>
      <details className="rounded border p-4">
        <summary className="font-semibold">Submitted intake</summary>
        <dl>
          {Object.entries(a.intake).map(([key, value]) => (
            <div key={key} className="py-2">
              <dt className="font-semibold">
                {key.replace(/([A-Z])/g, " $1")}
              </dt>
              <dd>
                {Array.isArray(value)
                  ? value.map(human).join(", ")
                  : human(value)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      {a.permissions.edit && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Lifecycle & operations</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void mutate({
                action: "TRANSITION",
                status: f.get("status"),
                reason: f.get("reason"),
              });
            }}
          >
            <label>
              Next state
              <select
                name="status"
                className="mt-1 block min-h-12 rounded border p-3"
              >
                {[
                  "IN_REVIEW",
                  "AWAITING_INFORMATION",
                  "REPORT_DRAFT",
                  "QA_REVIEW",
                  "CLOSED",
                  "CANCELLED",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Reason
              <select
                name="reason"
                className="mt-1 block min-h-12 rounded border p-3"
              >
                {[
                  "REVIEW_READY",
                  "MISSING_INFORMATION",
                  "INFORMATION_RECEIVED",
                  "DRAFT_STARTED",
                  "QA_STARTED",
                  "COMPLETED",
                  "CUSTOMER_REQUEST",
                  "DUPLICATE_PURCHASE",
                  "SERVICE_UNAVAILABLE",
                  "INCOMPLETE_INTAKE",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button className="rounded border px-4 py-3" disabled={busy}>
              Update lifecycle
            </button>
          </form>
          <button
            className="rounded border px-4 py-3"
            disabled={busy}
            onClick={() => void mutate({ action: "REMIND" })}
          >
            Queue a content-free reminder
          </button>
          {["DELIVERED", "CLOSED"].includes(a.status) && (
            <button
              className="ml-3 rounded border px-4 py-3"
              disabled={busy}
              onClick={() =>
                void mutate({
                  action: "REOPEN_CORRECTION",
                  reason: "VERIFIED_FACTUAL_ERROR",
                })
              }
            >
              Open verified factual correction
            </button>
          )}
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Six-area fulfillment rubric</h2>
        {AREAS.map((area) => (
          <article key={area} className="space-y-3 rounded border p-4">
            <h3 className="font-semibold">{AREA_LABELS[area]}</h3>
            {a.findings
              .filter((f) => f.area === area)
              .map((f) => (
                <div key={f.id} className="space-y-2 border-t py-3">
                  <p>
                    {human(f.status)} · {human(f.priority)} priority ·{" "}
                    {human(f.disposition)}
                  </p>
                  <p>{f.finding}</p>
                  <p>
                    <strong>Basis:</strong> {f.evidenceBasis}
                  </p>
                  <p>
                    <strong>Why:</strong> {f.whyItMatters}
                  </p>
                  <p>
                    <strong>Next:</strong> {f.recommendedAction}
                  </p>
                  {editable && (
                    <div className="flex gap-3">
                      <button
                        className="rounded border px-3 py-2"
                        onClick={() => setFinding(f)}
                      >
                        Edit finding
                      </button>
                      <button
                        className="rounded border px-3 py-2"
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            action: "REMOVE_FINDING",
                            findingId: f.id,
                          })
                        }
                      >
                        Remove from draft
                      </button>
                    </div>
                  )}
                </div>
              ))}
            {!a.findings.some((f) => f.area === area) && (
              <p>
                Not reviewed yet. Do not guess; record insufficient information
                or not applicable with a rationale when appropriate.
              </p>
            )}
            {editable && (
              <button
                className="rounded border px-3 py-2"
                onClick={() => setFinding({ ...blankFinding, area })}
              >
                Add finding for {AREA_LABELS[area]}
              </button>
            )}
          </article>
        ))}
      </section>
      {editable && (
        <form
          key={finding.id || finding.area}
          className="space-y-4 rounded border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            void mutate({
              action: "SAVE_FINDING",
              finding: {
                id: finding.id,
                area: finding.area,
                ...Object.fromEntries(f.entries()),
                qualifyingServiceId: f.get("qualifyingServiceId") || null,
                ordering: Number(f.get("ordering")),
              },
            });
          }}
        >
          <h2 className="text-xl font-semibold">
            {finding.id ? "Edit finding" : "New finding"} —{" "}
            {AREA_LABELS[finding.area]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Condition status
              <select
                className="mt-1 block min-h-12 w-full rounded border p-3"
                name="status"
                defaultValue={finding.status}
              >
                {AREA_STATUSES[finding.area].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Recommendation disposition
              <select
                className="mt-1 block min-h-12 w-full rounded border p-3"
                name="disposition"
                defaultValue={finding.disposition}
              >
                {DISPOSITIONS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                className="mt-1 block min-h-12 w-full rounded border p-3"
                name="priority"
                defaultValue={finding.priority}
              >
                {["HIGH", "MEDIUM", "LOW"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Qualifying PK service (PK can help only)
              <select
                className="mt-1 block min-h-12 w-full rounded border p-3"
                name="qualifyingServiceId"
                defaultValue={finding.qualifyingServiceId || ""}
              >
                <option value="">None</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(
            [
              ["finding", "What PK found"],
              ["evidenceBasis", "Evidence or basis reviewed"],
              ["whyItMatters", "Why it matters"],
              ["recommendedAction", "Recommended action"],
              ["internalNotes", "Internal notes — excluded from client report"],
            ] as const
          ).map(([key, label]) => (
            <label className="block" key={key}>
              {label}
              <textarea
                className="mt-1 block w-full rounded border p-3"
                name={key}
                defaultValue={finding[key]}
                required={key !== "internalNotes"}
                rows={3}
                maxLength={4000}
              />
            </label>
          ))}
          <label>
            Order
            <input
              className="mt-1 block min-h-12 rounded border p-3"
              name="ordering"
              type="number"
              min={0}
              max={1000}
              defaultValue={finding.ordering}
            />
          </label>
          <button
            className="rounded bg-pink-700 px-4 py-3 text-white"
            disabled={busy}
          >
            Save finding
          </button>
        </form>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Outside recommendations</h2>
        {a.recommendations.map((r) => {
          const snapshot = JSON.parse(r.snapshot) as LibraryInput;
          return (
            <article className="space-y-2 rounded border p-4" key={r.id}>
              <h3 className="font-semibold">{snapshot.title}</h3>
              <p>{snapshot.clientFacingDescription}</p>
              <p>{snapshot.clientNextStep}</p>
              <p>
                {human(snapshot.relationshipClassification)}:{" "}
                {snapshot.disclosureText}
              </p>
              <p>
                {r.libraryEntryId
                  ? `Library source version ${r.sourceVersion}`
                  : "One-off recommendation"}
              </p>
              {editable && (
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded border px-3 py-2"
                    onClick={() => {
                      setReplacementId(r.id);
                      setOutsideFinding(r.findingId);
                      setSource(
                        library.some((entry) => entry.id === r.libraryEntryId)
                          ? r.libraryEntryId || ""
                          : "",
                      );
                      setCustomRecommendation({
                        ...blankRecommendation,
                        ...snapshot,
                      });
                    }}
                  >
                    Customize wording as a new snapshot
                  </button>
                  <button
                    className="rounded border px-3 py-2"
                    disabled={busy}
                    onClick={() =>
                      void mutate({
                        action: "REMOVE_RECOMMENDATION",
                        recommendationId: r.id,
                      })
                    }
                  >
                    Remove from draft
                  </button>
                  <label>
                    Order
                    <input
                      className="ml-2 w-24 rounded border p-2"
                      type="number"
                      min={0}
                      max={1000}
                      defaultValue={r.ordering}
                      onBlur={(event) => {
                        if (Number(event.target.value) !== r.ordering)
                          void mutate({
                            action: "REORDER_RECOMMENDATION",
                            recommendationId: r.id,
                            ordering: Number(event.target.value),
                          });
                      }}
                    />
                  </label>
                </div>
              )}
            </article>
          );
        })}
        {editable && (
          <div className="space-y-4">
            <label className="block">
              Attach to outside-help finding
              <select
                className="mt-1 block min-h-12 w-full rounded border p-3"
                value={outsideFinding}
                onChange={(event) => setOutsideFinding(event.target.value)}
              >
                <option value="">Select a finding</option>
                {a.findings
                  .filter((f) => f.disposition === "OUTSIDE_HELP_RECOMMENDED")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {AREA_LABELS[f.area]} — {f.finding.slice(0, 80)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              Search library title, category or type
              <input
                className="mt-1 block min-h-12 w-full rounded border p-3"
                value={recommendationSearch}
                onChange={(event) =>
                  setRecommendationSearch(event.target.value)
                }
              />
            </label>
            <label className="block">
              Library source or one-off
              <select
                className="mt-1 block min-h-12 w-full rounded border p-3"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setCustomRecommendation(null);
                }}
              >
                <option value="">Create a one-off recommendation</option>
                {library
                  .filter((entry) =>
                    `${entry.title} ${entry.category} ${entry.recommendationType}`
                      .toLowerCase()
                      .includes(recommendationSearch.toLowerCase()),
                  )
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title} · {entry.category} ·{" "}
                      {human(entry.recommendationType)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(event) => setSaveToLibrary(event.target.checked)}
              />
              Also save this as a new library entry (requires library write
              permission)
            </label>
            {replacementId && (
              <p>
                Replacing a draft assignment; its original snapshot stays in
                history.{" "}
                <button
                  className="underline"
                  onClick={() => {
                    setReplacementId("");
                    setCustomRecommendation(null);
                  }}
                >
                  Cancel customization
                </button>
              </p>
            )}
            <RecommendationEditor
              key={`${replacementId}:${source || "one-off"}`}
              initial={entryFields}
              busy={busy || !outsideFinding}
              submitLabel="Attach recommendation snapshot"
              onSave={(wording) =>
                void mutate({
                  action: "ASSIGN_RECOMMENDATION",
                  findingId: outsideFinding,
                  ...(replacementId ? { replacementId } : {}),
                  ...(source ? { libraryEntryId: source } : {}),
                  wording,
                  saveToLibrary,
                })
              }
            />
          </div>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Report draft, preview & QA</h2>
        {editable && (
          <form
            key={a.version}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate({
                action: "SAVE_SUMMARY",
                ...Object.fromEntries(
                  new FormData(event.currentTarget).entries(),
                ),
              });
            }}
          >
            {(
              [
                ["summary", "Where the client stands"],
                ["strengths", "Strongest areas"],
                ["priorityConcerns", "Priority concerns"],
                ["limitations", "Limitations"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                {label}
                <textarea
                  className="mt-1 block w-full rounded border p-3"
                  name={key}
                  defaultValue={a[key]}
                  rows={3}
                  maxLength={4000}
                  required
                />
              </label>
            ))}
            <button className="rounded border px-4 py-3" disabled={busy}>
              Save report draft
            </button>
          </form>
        )}
        <button
          className="rounded border px-4 py-3"
          onClick={() => void preview()}
        >
          Preview current client report
        </button>
        {report && (
          <iframe
            className="h-[70vh] w-full rounded border bg-white"
            title="Readiness Report preview"
            sandbox="allow-popups"
            srcDoc={report}
          />
        )}
        {a.permissions.qa && a.status === "QA_REVIEW" && (
          <form
            className="space-y-3 rounded border-2 border-pink-700 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate({
                action: "QA_APPROVE",
                previewReviewed: true,
                evidenceReviewed: true,
                recommendationsChecked: true,
                clientSafe: true,
              });
            }}
          >
            <h3 className="font-semibold">Human QA gate</h3>
            {[
              "I reviewed the report preview.",
              "All six areas and evidence limitations have been reviewed.",
              "Recommendation dispositions, provider relationships and qualifying PK services are accurate.",
              "No internal notes or raw confidential document contents appear in the client report.",
            ].map((label) => (
              <label key={label} className="flex items-start gap-3">
                <input type="checkbox" required className="mt-1" />
                {label}
              </label>
            ))}
            <button
              className="rounded bg-pink-700 px-4 py-3 text-white"
              disabled={busy}
            >
              Approve this draft for finalization
            </button>
          </form>
        )}
        <p>Latest QA approval: {date(a.qaReviewedAt)}</p>
        {a.permissions.qa && a.status === "QA_REVIEW" && (
          <button
            className="rounded border px-4 py-3"
            disabled={busy || !a.qaReviewedAt}
            onClick={() => void mutate({ action: "FINALIZE" })}
          >
            Freeze final report version
          </button>
        )}
        {a.reports.map((r) => (
          <div
            className="flex flex-wrap items-center gap-3 rounded border p-3"
            key={r.id}
          >
            <span>
              Report v{r.version}: {human(r.deliveryState)}
            </span>
            <button
              className="rounded border px-3 py-2"
              onClick={() => void preview(r.id)}
            >
              View frozen version
            </button>
            {a.permissions.qa &&
              r.deliveryState === "PENDING" &&
              a.status === "QA_REVIEW" && (
                <button
                  className="rounded border px-3 py-2"
                  disabled={busy}
                  onClick={() =>
                    void mutate({ action: "DELIVER", reportId: r.id })
                  }
                >
                  Deliver to secure client portal
                </button>
              )}
          </div>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Secure requested information</h2>
        <p>
          Use the approved staff Vault or documented PK secure handoff. Ordinary
          uploads are not a confidential-taxpayer workflow.
        </p>
        <Link className="underline" href="/vault">
          Open staff Secure Vault
        </Link>
        {a.permissions.edit && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void mutate({
                action: "REQUEST_DOCUMENT",
                kind: f.get("kind"),
                required: f.get("required") === "on",
              });
            }}
          >
            <label>
              Information needed
              <select name="kind" className="block min-h-12 rounded border p-3">
                {DOCUMENT_KINDS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input name="required" type="checkbox" defaultChecked />
              Required
            </label>
            <button className="rounded border px-4 py-3" disabled={busy}>
              Request secure information
            </button>
          </form>
        )}
        {a.documents.map((d) => (
          <article className="space-y-4 rounded border p-4" key={d.id}>
            <h3>
              {human(d.kind)} · {human(d.status)}{" "}
              {d.required ? "(required)" : ""}
            </h3>
            {a.permissions.edit && (
              <>
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate({
                      action: "LINK_VAULT_DOCUMENT",
                      evidenceId: d.id,
                      vaultDocumentId: new FormData(event.currentTarget).get(
                        "vaultDocumentId",
                      ),
                    });
                  }}
                >
                  <label>
                    Released Vault document ID
                    <input
                      name="vaultDocumentId"
                      className="ml-2 rounded border p-3"
                      required
                    />
                  </label>
                  <button className="rounded border px-4 py-3" disabled={busy}>
                    Verify & attach
                  </button>
                </form>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const f = new FormData(event.currentTarget);
                    void mutate({
                      action: "RECORD_EXTERNAL_RECEIPT",
                      evidenceId: d.id,
                      channel: f.get("channel"),
                      externalReference: f.get("externalReference"),
                      verifiedReceived: true,
                    });
                  }}
                >
                  <label className="block">
                    Approved secure handoff
                    <select
                      name="channel"
                      className="mt-1 block min-h-12 rounded border p-3"
                    >
                      <option>TAXSMART_MYTAXOFFICE</option>
                      <option>APPROVED_PK_SECURE_HANDOFF</option>
                    </select>
                  </label>
                  <label className="block">
                    Opaque handoff reference (no URLs or taxpayer identifiers)
                    <input
                      name="externalReference"
                      className="mt-1 block rounded border p-3"
                      pattern="[A-Za-z0-9_-]{1,64}"
                      required
                    />
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" required />I verified receipt through
                    the approved secure process.
                  </label>
                  <button className="rounded border px-4 py-3" disabled={busy}>
                    Record verified secure receipt
                  </button>
                </form>
              </>
            )}
          </article>
        ))}
      </section>
      {a.credit && (
        <section className="space-y-4 rounded border p-5">
          <h2 className="text-xl font-semibold">Readiness credit management</h2>
          <p>
            {human(a.credit.status)} · Claimed {date(a.credit.claimedAt)}
          </p>
          <p>
            Claim deadline {date(a.credit.claimDeadline)} · Redeem deadline{" "}
            {date(a.credit.redeemDeadline)}
          </p>
          <p>
            Requested service{" "}
            {a.eligibleServices.find(
              (s) => s.id === a.credit?.requestedServiceId,
            )?.name || "—"}
          </p>
          {a.permissions.credit &&
            a.credit.status === "CLAIMED_PENDING_REVIEW" && (
              <div className="space-y-3">
                <button
                  className="rounded border px-4 py-3"
                  disabled={busy}
                  onClick={() =>
                    void mutate({
                      action: "DECIDE_CREDIT",
                      approved: true,
                      qualifyingServiceId: a.credit?.requestedServiceId,
                      reason: "REPORT_RELATED_SERVICE",
                    })
                  }
                >
                  Approve requested report-related PK service
                </button>
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate({
                      action: "DECIDE_CREDIT",
                      approved: false,
                      reason: new FormData(event.currentTarget).get("reason"),
                    });
                  }}
                >
                  <label>
                    Rejection reason
                    <select name="reason" className="ml-2 rounded border p-3">
                      {[
                        "UNRELATED_SERVICE",
                        "OUTSIDE_PROVIDER",
                        "INVOICE_NOT_QUALIFYING",
                        "SERVICE_UNAVAILABLE",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <button className="rounded border px-4 py-3" disabled={busy}>
                    Reject with reason
                  </button>
                </form>
              </div>
            )}
          {a.permissions.credit && a.credit.status === "APPROVED_AVAILABLE" && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void mutate({
                  action: "APPLY_CREDIT",
                  invoiceId: new FormData(event.currentTarget).get("invoiceId"),
                });
              }}
            >
              <label className="block">
                Qualifying PK invoice ID
                <input
                  name="invoiceId"
                  className="mt-1 rounded border p-3"
                  required
                />
              </label>
              <p>
                Applies once, to one report-related PK service. Server verifies
                client, service, currency, invoice status, balance and
                deadlines. Any unused portion cannot be split onto another
                invoice.
              </p>
              <button className="rounded border px-4 py-3" disabled={busy}>
                Apply up to $99 to this invoice
              </button>
            </form>
          )}
          <p>Applied: ${(a.credit.amountAppliedCents / 100).toFixed(2)}</p>
        </section>
      )}
      <details className="rounded border p-4">
        <summary className="font-semibold">Audit & history</summary>
        {a.audit.map((event) => (
          <p className="break-words border-t py-2" key={event.id}>
            {date(event.createdAt)} ·{" "}
            {human(JSON.parse(event.metadata).action || "EVENT")} · Actor{" "}
            {event.actorId || "System"}
          </p>
        ))}
      </details>
      <Link className="underline" href="/admin/readiness">
        Return to Readiness queue
      </Link>
    </section>
  );
}
