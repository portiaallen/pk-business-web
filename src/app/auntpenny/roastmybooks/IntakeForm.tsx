"use client";

import { useMemo, useState } from "react";
import { buildReport, nextThreeSteps } from "@/lib/auntpenny/report";
import { validateIntake, type IntakeAnswers } from "@/lib/auntpenny/roast-engine";
import { ReportView } from "./ReportView";

const SOFTWARE_OPTIONS = [
  "QuickBooks",
  "Xero",
  "Wave",
  "FreshBooks",
  "Zoho Books",
  "Something else",
];

type FormState = Omit<IntakeAnswers, "recordsMethod" | "softwareName" | "firstName"> & {
  recordsMethod: "" | IntakeAnswers["recordsMethod"];
  softwareName: string;
  firstName: string;
};

const EMPTY: FormState = {
  recordsMethod: "",
  softwareName: "",
  monthlyRevenue: NaN,
  monthlyExpenses: NaN,
  cashOnHand: NaN,
  monthsSinceReconciliation: NaN,
  uncategorizedPercent: NaN,
  uncategorizedTransactions: NaN,
  overdueInvoicesTotal: NaN,
  softwareSubscriptions: NaN,
  headcount: NaN,
  ownerDraws3mo: NaN,
  netIncome3mo: NaN,
  cardBalanceCarried: NaN,
  monthsCarryingCard: NaN,
  monthsWithoutProfessional: NaN,
  firstName: "",
};

const MONEY_LABELS: Array<{ key: keyof FormState; label: string; hint?: string }> = [
  { key: "monthlyRevenue", label: "Average monthly revenue" },
  { key: "monthlyExpenses", label: "Average monthly expenses" },
  { key: "cashOnHand", label: "Cash on hand today" },
  { key: "monthsSinceReconciliation", label: "Months since your last full reconciliation", hint: "Be honest. Aunt Penny already knows." },
  { key: "uncategorizedPercent", label: "Percent of transactions sitting uncategorized (0-100)" },
  { key: "uncategorizedTransactions", label: "Roughly how many transactions are sitting uncategorized" },
  { key: "overdueInvoicesTotal", label: "Total in overdue customer invoices" },
  { key: "softwareSubscriptions", label: "Active software subscriptions you pay for" },
  { key: "headcount", label: "People working in the business, including you" },
  { key: "ownerDraws3mo", label: "Owner draws taken over the last 3 months" },
  { key: "netIncome3mo", label: "Net income over the last 3 months" },
  { key: "cardBalanceCarried", label: "Business credit card balance you carry month to month" },
  { key: "monthsCarryingCard", label: "Months you have carried that card balance" },
  { key: "monthsWithoutProfessional", label: "Months these books have gone without a professional's eyes" },
];

export function IntakeForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const answers = useMemo<IntakeAnswers | null>(() => {
    if (form.recordsMethod === "") return null;
    const parsed: IntakeAnswers = {
      ...Object.fromEntries(
        MONEY_LABELS.map(({ key }) => [key, Number(form[key])]),
      ) as unknown as Pick<IntakeAnswers, keyof IntakeAnswers>,
      recordsMethod: form.recordsMethod,
      softwareName: form.softwareName,
      firstName: form.firstName,
    };
    return parsed;
  }, [form]);

  const issues = useMemo(() => (answers ? validateIntake(answers) : []), [answers]);

  const set = (key: keyof FormState, value: string | IntakeAnswers["recordsMethod"]) => {
    setSubmitted(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted && answers && issues.length === 0) {
    const report = buildReport(answers);
    return <ReportView report={report} steps={nextThreeSteps(report.triggered)} firstName={answers.firstName.trim()} />;
  }

  return (
    <form className="ap-card mt-8 p-6" onSubmit={onSubmit} noValidate>
      <fieldset className="border-0 p-0">
        <legend className="text-lg font-semibold">How do you keep your books?</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {(["software", "spreadsheet", "shoebox"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recordsMethod"
                value={m}
                checked={form.recordsMethod === m}
                onChange={() => set("recordsMethod", m)}
              />
              {m === "software" ? "Bookkeeping software" : m === "spreadsheet" ? "A spreadsheet" : "Shoebox-and-vibes"}
            </label>
          ))}
        </div>
        {form.recordsMethod === "software" && (
          <label className="mt-3 block text-sm">
            Which one?
            <select
              className="mt-1 block w-full rounded-md border border-[#d8b9c8] bg-white text-[#3d1c36] p-2 text-base"
              value={form.softwareName}
              onChange={(e) => set("softwareName", e.target.value)}
            >
              <option value="">Select software</option>
              {SOFTWARE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {MONEY_LABELS.map(({ key, label, hint }) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              className="mt-1 block w-full rounded-md border border-[#d8b9c8] bg-white text-[#3d1c36] p-2 text-base"
              inputMode="decimal"
              type="number"
              step="any"
              value={Number.isNaN(form[key] as number) ? "" : String(form[key])}
              onChange={(e) => set(key, e.target.value)}
            />
            {hint && <span className="mt-1 block text-xs opacity-70">{hint}</span>}
          </label>
        ))}
      </div>

      <label className="mt-6 block text-sm">
        First name for the share card <span className="opacity-70">(optional, never required)</span>
        <input
          className="mt-1 block w-full rounded-md border border-[#d8b9c8] bg-white text-[#3d1c36] p-2 text-base"
          type="text"
          maxLength={20}
          value={form.firstName}
          onChange={(e) => set("firstName", e.target.value)}
        />
      </label>

      {submitted && issues.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm" style={{ color: "var(--ap-rose)" }}>
          {issues.map((i) => (
            <li key={i.field}>{i.message}</li>
          ))}
        </ul>
      )}

      <button className="ap-cta mt-6" type="submit">
        Roast these books
      </button>
      <p className="mt-3 text-xs opacity-75">
        Figures only. Everything is scored in your browser and nothing is uploaded, stored, or sent anywhere.
      </p>
    </form>
  );
}
