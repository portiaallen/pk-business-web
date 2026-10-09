"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BOOKKEEPING_OPTIONS, CONCERNS } from "@/lib/readiness/policy";
import { currentClient, readinessFetch, human, date } from "./client";

type Assessment = {
  id: string;
  clientId: string;
  status: string;
  paymentStatus: string;
  version: number;
  intake: Record<string, string | string[]>;
  acknowledgment: string;
  policyVersion: string;
  acknowledgmentAcceptedAt: string | null;
  submittedAt: string | null;
  documents: {
    id: string;
    kind: string;
    status: string;
    instruction: string;
    required: boolean;
  }[];
  reports: { id: string; version: number; deliveredAt: string | null }[];
  eligibleServices: { id: string; name: string }[];
  credit: {
    status: string;
    claimDeadline: string;
    redeemDeadline: string;
    requestedServiceId: string | null;
    decisionReason: string | null;
    amountAppliedCents: number;
    invoiceId: string | null;
  } | null;
};
export function PortalAssessment({ id }: { id: string }) {
  const [a, setA] = useState<Assessment | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [accepted, setAccepted] = useState(false);
  const load = useCallback(async () => {
    try {
      const client = await currentClient();
      setA(await readinessFetch(`/api/portal/readiness/${id}`, client));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function mutate(input: object) {
    if (!a) return;
    setBusy(true);
    setMessage("");
    try {
      await readinessFetch(`/api/portal/readiness/${id}`, a.clientId, {
        ...input,
        expectedVersion: a.version,
      });
      setMessage("Saved.");
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!a)
    return (
      <section className="p-6">
        <h1 className="text-2xl font-semibold">Readiness Assessment</h1>
        <p role="status">{message || "Loading your assessment…"}</p>
        <Link href="/security" className="underline">
          Choose client context
        </Link>
      </section>
    );
  const editable = ["PAID", "INTAKE_IN_PROGRESS", "READY_TO_SUBMIT"].includes(
    a.status,
  );
  const field = (name: string, label: string, values: readonly string[]) => (
    <label className="block" key={name}>
      {label}
      <select
        className="mt-1 block min-h-12 w-full rounded border p-3"
        name={name}
        defaultValue={String(a.intake[name] || values[0])}
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {human(value)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl font-semibold">Your PK Readiness Assessment</h1>
      <p>
        {human(a.status)} · Payment: {human(a.paymentStatus)}
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>
        Use readiness-level answers only. Do not enter SSNs, ITINs, bank logins,
        card numbers, tax forms or document contents here.
      </p>
      {editable && (
        <form
          key={a.version}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            const intake = Object.fromEntries(f.entries());
            void mutate({
              action: "SAVE_INTAKE",
              intake: { ...intake, incomeStreams: f.getAll("incomeStreams") },
            });
          }}
        >
          <label className="block">
            Business or professional name
            <input
              className="mt-1 block min-h-12 w-full rounded border p-3"
              name="businessName"
              maxLength={100}
              defaultValue={String(a.intake.businessName || "")}
              required
            />
          </label>
          <label className="block">
            Review period through (month)
            <input
              className="mt-1 block min-h-12 w-full rounded border p-3"
              type="month"
              name="reviewPeriod"
              defaultValue={String(a.intake.reviewPeriod || "")}
              required
            />
          </label>
          {field("bookkeepingSystem", "Bookkeeping system", [
            "QUICKBOOKS",
            "OTHER_SOFTWARE",
            "SPREADSHEET",
            "PAPER",
            "NONE",
            "UNSURE",
          ])}
          {field(
            "bookkeepingStatus",
            "Are your books current?",
            BOOKKEEPING_OPTIONS,
          )}
          {field("reconciliationStatus", "Reconciliation status", [
            "CURRENT",
            "PARTIAL",
            "NOT_RECONCILED",
            "UNSURE",
            "NOT_APPLICABLE",
          ])}
          {field("incomeExpenseOrganization", "Income & expense organization", [
            "ORGANIZED",
            "PARTIAL",
            "UNORGANIZED",
            "UNSURE",
          ])}
          <fieldset className="space-y-2 rounded border p-3">
            <legend>Business income sources (select at least one)</legend>
            {[
              "CLIENTS",
              "PLATFORMS",
              "ONLINE_SALES",
              "CASH",
              "OTHER_BUSINESS",
            ].map((value) => (
              <label className="flex min-h-10 items-center gap-3" key={value}>
                <input
                  type="checkbox"
                  name="incomeStreams"
                  value={value}
                  defaultChecked={(
                    a.intake.incomeStreams as string[] | undefined
                  )?.includes(value)}
                />
                {human(value)}
              </label>
            ))}
          </fieldset>
          {field("recordsStatus", "Business records", [
            "ORGANIZED",
            "SCATTERED",
            "MISSING",
            "UNSURE",
          ])}
          {field("taxPreparationStatus", "Tax-season preparation", [
            "PREPARER_SELECTED",
            "NOT_STARTED",
            "NEED_PROFESSIONAL",
            "UNSURE",
          ])}
          {field("priority", "Your priority concern", CONCERNS)}
          <button
            className="min-h-12 rounded bg-pink-700 px-5 py-3 text-white sm:col-span-2"
            disabled={busy}
          >
            Save completed intake
          </button>
        </form>
      )}
      {a.status === "READY_TO_SUBMIT" && (
        <div className="space-y-4 rounded border-2 border-pink-700 p-5">
          <h2 className="text-xl font-semibold">
            Final submission for PK review
          </h2>
          <p>
            Review your saved answers before submitting. This starts the
            non-refundable assessment review stage.
          </p>
          <label className="flex items-start gap-3">
            <input
              className="mt-1 size-5 shrink-0"
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>{a.acknowledgment}</span>
          </label>
          <button
            className="rounded bg-pink-700 px-4 py-3 text-white"
            disabled={busy || !accepted}
            onClick={() =>
              void mutate({
                action: "SUBMIT",
                acknowledgment: a.acknowledgment,
                accepted: true,
                policyVersion: a.policyVersion,
              })
            }
          >
            Submit my Assessment for PK review
          </button>
        </div>
      )}
      {a.submittedAt && (
        <p>
          Submitted {date(a.submittedAt)}. Required policy acknowledgment
          recorded {date(a.acknowledgmentAcceptedAt)}.
        </p>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Secure document requests</h2>
        {a.documents.length ? (
          a.documents.map((d) => (
            <div key={d.id} className="rounded border p-4">
              <h3>
                {human(d.kind)}
                {d.required ? " — required" : " — optional"}
              </h3>
              <p>{human(d.status)}</p>
              <p>{d.instruction}</p>
            </div>
          ))
        ) : (
          <p>
            No document requests yet. PK will request information securely if
            needed.
          </p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Your delivered Readiness Reports
        </h2>
        {a.reports.map((r) => (
          <button
            key={r.id}
            className="block rounded border px-4 py-3"
            onClick={() => {
              void (async () => {
                try {
                  const response = await fetch(
                    `/api/portal/readiness/${id}/report?reportId=${r.id}`,
                    {
                      headers: { "x-pk-client-context": a.clientId },
                      cache: "no-store",
                    },
                  );
                  if (!response.ok)
                    throw new Error("Report unavailable; check secure access");
                  setReport(await response.text());
                } catch (error) {
                  setMessage((error as Error).message);
                }
              })();
            }}
          >
            View report version {r.version} · {date(r.deliveredAt)}
          </button>
        ))}
        {report && (
          <div>
            <button
              className="rounded border px-4 py-3"
              onClick={() => setReport("")}
            >
              Close report
            </button>
            <iframe
              className="mt-3 h-[70vh] w-full rounded border bg-white"
              title="Your secure PK Readiness Report"
              sandbox="allow-popups"
              srcDoc={report}
            />
          </div>
        )}
      </section>
      {a.credit && (
        <section className="space-y-4 rounded border p-5">
          <h2 className="text-xl font-semibold">Your $99 service credit</h2>
          <p>{human(a.credit.status)}</p>
          <p>
            Claim by {date(a.credit.claimDeadline)}. Redeem after PK approval by{" "}
            {date(a.credit.redeemDeadline)}. Both deadlines start at final
            report delivery.
          </p>
          <p>
            One qualifying PK service, up to $99 total. No split, transfer, cash
            value, unrelated service or outside-provider credit. It cannot
            exceed the qualifying invoice amount.
          </p>
          {a.credit.status === "ELIGIBLE_UNCLAIMED" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void mutate({
                  action: "CLAIM_CREDIT",
                  serviceId: new FormData(event.currentTarget).get("serviceId"),
                });
              }}
            >
              <label className="block">
                Service related to a need in your report
                <select
                  className="my-3 block min-h-12 w-full rounded border p-3"
                  name="serviceId"
                >
                  {a.eligibleServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy}
                className="rounded bg-pink-700 px-4 py-3 text-white"
              >
                Express interest & claim for PK review
              </button>
            </form>
          )}
          {a.credit.status === "CLAIMED_PENDING_REVIEW" && (
            <p>
              Your expression of interest is awaiting PK approval. It has not
              been applied to an invoice.
            </p>
          )}
          {a.credit.decisionReason && (
            <p>PK decision: {human(a.credit.decisionReason)}</p>
          )}
          {a.credit.amountAppliedCents > 0 && (
            <p>
              ${(a.credit.amountAppliedCents / 100).toFixed(2)} applied once to
              your qualifying invoice.{" "}
              <Link className="underline" href="/portal/invoices">
                View invoices
              </Link>
            </p>
          )}
        </section>
      )}
      <Link className="underline" href="/portal/readiness">
        All assessments
      </Link>
    </section>
  );
}
