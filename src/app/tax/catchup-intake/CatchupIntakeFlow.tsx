"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ALREADY_FILED_OPTIONS,
  CATCHUP_EFILE_FEE,
  CATCHUP_SIMPLE_PRICE,
  CATCHUP_TAX_YEARS,
  COMPLEXITY_OPTIONS,
  CONTACT_TIME_OPTIONS,
  FILING_STATUS_OPTIONS,
  RECORDS_STATUS_OPTIONS,
  US_STATE_CODES,
  screenCatchupYears,
} from "@/content/catchup-1040";

interface IntakeData {
  fullName: string;
  email: string;
  phone: string;
  contactMethod: "email" | "phone";
  contactTime: string;
  taxYears: string[];
  filingStatuses: Record<string, string>;
  alreadyFiled: Record<string, string>;
  complexity: string[];
  states: string[];
  hasNotices: boolean | null;
  recordsStatus: string;
  notes: string;
  consentContact: boolean;
  consentQuote: boolean;
  website: string; // honeypot — must stay empty
}

const initialData: IntakeData = {
  fullName: "",
  email: "",
  phone: "",
  contactMethod: "email",
  contactTime: "anytime",
  taxYears: [],
  filingStatuses: {},
  alreadyFiled: {},
  complexity: [],
  states: [],
  hasNotices: null,
  recordsStatus: "not_sure",
  notes: "",
  consentContact: false,
  consentQuote: false,
  website: "",
};

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const stepLabels = ["Contact details", "Your tax years", "Final details"];

const complexityLabels = new Map<string, string>(COMPLEXITY_OPTIONS.map((o) => [o.value, o.label]));
const filingStatusLabels = new Map<string, string>(FILING_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const alreadyFiledLabels = new Map<string, string>(ALREADY_FILED_OPTIONS.map((o) => [o.value, o.label]));
const recordsLabels = new Map<string, string>(RECORDS_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const contactTimeLabels = new Map<string, string>(CONTACT_TIME_OPTIONS.map((o) => [o.value, o.label]));

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function CatchupIntakeFlow() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeData>(initialData);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [referenceId, setReferenceId] = useState("");

  function update<K extends keyof IntakeData>(field: K, value: IntakeData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
    setErrors([]);
    setServerError("");
  }

  function toggleYear(year: string) {
    setData((prev) => {
      const selected = prev.taxYears.includes(year);
      const taxYears = selected
        ? prev.taxYears.filter((y) => y !== year)
        : [...prev.taxYears, year];
      const filingStatuses = { ...prev.filingStatuses };
      const alreadyFiled = { ...prev.alreadyFiled };
      if (selected) {
        delete filingStatuses[year];
        delete alreadyFiled[year];
      } else {
        filingStatuses[year] = "unknown";
        alreadyFiled[year] = "no";
      }
      return { ...prev, taxYears, filingStatuses, alreadyFiled };
    });
    setErrors([]);
  }

  function toggleComplexity(value: string) {
    setData((prev) => ({
      ...prev,
      complexity: prev.complexity.includes(value)
        ? prev.complexity.filter((c) => c !== value)
        : [...prev.complexity, value],
    }));
    setErrors([]);
  }

  function toggleState(code: string) {
    setData((prev) => ({
      ...prev,
      states: prev.states.includes(code)
        ? prev.states.filter((s) => s !== code)
        : [...prev.states, code],
    }));
    setErrors([]);
  }

  const screening = useMemo(
    () =>
      screenCatchupYears({
        complexity: data.complexity,
        hasNotices: data.hasNotices === true,
        years: data.taxYears.map((year) => ({
          year,
          filingStatus: data.filingStatuses[year] ?? "unknown",
          alreadyFiled: data.alreadyFiled[year] ?? "not_sure",
        })),
      }),
    [data.complexity, data.hasNotices, data.taxYears, data.filingStatuses, data.alreadyFiled],
  );

  function validateStep(current: number): string[] {
    const found: string[] = [];
    if (current === 0) {
      if (!data.fullName.trim()) found.push("Please enter your full name.");
      if (!validateEmail(data.email)) found.push("Please enter a valid email address.");
      if (data.contactMethod === "phone" && !isValidPhone(data.phone)) {
        found.push("Please enter a valid phone number so PK can reach you.");
      }
    }
    if (current === 1) {
      if (data.taxYears.length === 0) {
        found.push("Select at least one tax year: 2023, 2024, or 2025.");
      }
      if (data.complexity.length === 0) {
        found.push("Select the income types that apply to you.");
      }
    }
    if (current === 2) {
      if (data.states.length === 0) found.push("Select at least one state.");
      if (data.hasNotices === null) {
        found.push("Tell PK whether IRS or state notices are involved.");
      }
      if (!data.consentContact || !data.consentQuote) {
        found.push("Please confirm both checkboxes so PK can contact you about this quote.");
      }
    }
    return found;
  }

  function goNext() {
    const found = validateStep(step);
    setErrors(found);
    if (found.length === 0) setStep(step + 1);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validateStep(2);
    setErrors(found);
    if (found.length > 0) return;

    setSubmitting(true);
    setServerError("");
    try {
      const response = await fetch("/api/tax/catchup-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          contactMethod: data.contactMethod,
          contactTime: data.contactTime,
          taxYears: data.taxYears,
          filingStatuses: data.filingStatuses,
          alreadyFiled: data.alreadyFiled,
          complexity: data.complexity,
          notes: data.notes,
          states: data.states,
          hasNotices: data.hasNotices === true,
          recordsStatus: data.recordsStatus,
          consent: data.consentContact && data.consentQuote,
          website: data.website,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        id?: string;
        error?: string;
      };
      if (!response.ok || !result.success) {
        setServerError(result.error || "We could not send your request right now. Please try again shortly.");
        return;
      }
      setReferenceId(result.id ?? "");
      setStep(3);
    } catch {
      setServerError("We could not send your request right now. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 3) {
    return (
      <div role="status" className="rounded-2xl border border-gold/40 bg-gold/5 p-8">
        <h2 className="pk-heading text-2xl font-semibold text-charcoal">
          Request received.
        </h2>
        {referenceId ? (
          <p className="mt-2 text-sm text-muted-gray">
            Your reference number: <span className="font-semibold text-charcoal">{referenceId}</span>
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-muted-gray">
          PK reviews every request personally and will follow up using the
          contact method you chose.
        </p>
        <h3 className="pk-heading mt-6 text-lg font-semibold text-charcoal">
          What happens next
        </h3>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed text-muted-gray">
          <li>
            <strong className="text-charcoal">1. PK reviews and confirms pricing.</strong>{" "}
            Qualifying simple returns start at {CATCHUP_SIMPLE_PRICE} per tax
            year. A {CATCHUP_EFILE_FEE} federal e-filing fee applies per
            eligible return only, and federal e-file eligibility is confirmed
            by year. Other return types and multi-year bundles are quoted
            after review.
          </li>
          <li>
            <strong className="text-charcoal">2. You accept the quote.</strong>{" "}
            Then PK collects what is needed for the engagement through its
            secure client process.
          </li>
          <li>
            <strong className="text-charcoal">3. Nothing is filed</strong>{" "}
            until you have reviewed and approved it.
          </li>
        </ol>
        <p className="mt-6 rounded-xl border border-border bg-cream p-4 text-sm leading-relaxed text-muted-gray">
          For your safety: never email tax documents, Social Security numbers,
          ITINs, or bank details. Sensitive information moves only through
          PK&apos;s secure client process after you become a client.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div aria-hidden="true" className="flex items-center gap-2">
        {stepLabels.map((label, index) => (
          <div key={label} className="flex flex-1 flex-col gap-1">
            <div
              className={cn(
                "h-1.5 rounded-full",
                index <= step ? "bg-gold" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-xs",
                index === step ? "font-semibold text-charcoal" : "text-muted-gray",
              )}
            >
              Step {index + 1} of 3
            </span>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <ul className="list-inside list-disc space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {serverError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              className="mt-1.5 min-h-11"
              value={data.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1.5 min-h-11"
              value={data.email}
              onChange={(e) => update("email", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              className="mt-1.5 min-h-11"
              value={data.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-gray">
              Required if PK should reach you by phone.
            </p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">How should PK contact you?</legend>
            <div className="mt-2 flex gap-3">
              {(
                [
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <input
                    type="radio"
                    name="contactMethod"
                    value={option.value}
                    checked={data.contactMethod === option.value}
                    onChange={() => update("contactMethod", option.value)}
                    className="accent-[var(--gold,theme(colors.charcoal))]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="contactTime">Best time to reach you</Label>
            <select
              id="contactTime"
              className={cn(selectClassName, "mt-1.5")}
              value={data.contactTime}
              onChange={(e) => update("contactTime", e.target.value)}
            >
              {CONTACT_TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs leading-relaxed text-muted-gray">
            This request is for a quote. It is not an engagement, and no
            return is filed from it.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium">
              Which tax years do you need filed? (2023, 2024, 2025)
            </legend>
            <div className="mt-2 flex gap-3">
              {CATCHUP_TAX_YEARS.map((year) => (
                <label
                  key={year}
                  className={cn(
                    "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold",
                    data.taxYears.includes(year)
                      ? "border-gold bg-gold/10 text-charcoal"
                      : "border-border bg-background",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={data.taxYears.includes(year)}
                    onChange={() => toggleYear(year)}
                  />
                  {year}
                </label>
              ))}
            </div>
          </fieldset>

          {data.taxYears.map((year) => (
            <div key={year} className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-charcoal">Tax year {year}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`status-${year}`}>Filing status</Label>
                  <select
                    id={`status-${year}`}
                    className={cn(selectClassName, "mt-1.5")}
                    value={data.filingStatuses[year] ?? "unknown"}
                    onChange={(e) =>
                      update("filingStatuses", {
                        ...data.filingStatuses,
                        [year]: e.target.value,
                      })
                    }
                  >
                    {FILING_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor={`filed-${year}`}>Was a return already filed for {year}?</Label>
                  <select
                    id={`filed-${year}`}
                    className={cn(selectClassName, "mt-1.5")}
                    value={data.alreadyFiled[year] ?? "no"}
                    onChange={(e) =>
                      update("alreadyFiled", {
                        ...data.alreadyFiled,
                        [year]: e.target.value,
                      })
                    }
                  >
                    {ALREADY_FILED_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <fieldset>
            <legend className="text-sm font-medium">
              Income types across those years (select all that apply)
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {COMPLEXITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={data.complexity.includes(option.value)}
                    onChange={() => toggleComplexity(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {data.taxYears.length > 0 && data.complexity.length > 0 && (
            <div className="rounded-xl border border-gold-light/60 bg-cream p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-gray">
                Screening preview (final pricing is confirmed by PK after review)
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {screening.map((entry) => (
                  <li key={entry.year} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-charcoal">{entry.year}:</span>
                    {entry.simpleEligible ? (
                      <span className="text-charcoal">
                        {CATCHUP_SIMPLE_PRICE} Simple 1040 preparation applies
                        {data.taxYears.length > 1 ? " for this year" : ""}.
                      </span>
                    ) : (
                      <span className="text-muted-gray">{entry.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-muted-gray">
                If a qualifying year is eligible for federal e-file, a{" "}
                {CATCHUP_EFILE_FEE} federal e-filing fee applies to that
                return. PK confirms e-file eligibility by year; some years may
                need to be paper-filed. No refund transfers, no bank products,
                and no refund guarantees — customers pay PK directly.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium">
              State(s) where you lived or need to file (select all that apply)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {US_STATE_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={data.states.includes(code)}
                  onClick={() => toggleState(code)}
                  className={cn(
                    "min-h-11 min-w-14 rounded-lg border px-3 text-sm font-semibold",
                    data.states.includes(code)
                      ? "border-gold bg-gold/10 text-charcoal"
                      : "border-border bg-background text-muted-gray",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">
              Are IRS or state notices, or filing deadlines, involved right now?
            </legend>
            <div className="mt-2 flex gap-3">
              {(
                [
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ] as const
              ).map((option) => (
                <label
                  key={String(option.value)}
                  className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <input
                    type="radio"
                    name="hasNotices"
                    checked={data.hasNotices === option.value}
                    onChange={() => update("hasNotices", option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="recordsStatus">Where are your records?</Label>
            <select
              id="recordsStatus"
              className={cn(selectClassName, "mt-1.5")}
              value={data.recordsStatus}
              onChange={(e) => update("recordsStatus", e.target.value)}
            >
              {RECORDS_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-gray">
              Missing-record cleanup is quoted separately after review.
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Anything else PK should know? (optional)</Label>
            <textarea
              id="notes"
              className={cn(selectClassName, "mt-1.5 min-h-24 py-2")}
              maxLength={1000}
              value={data.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-gray">
              Keep it general. Do not enter Social Security numbers, tax
              documents, or bank details here.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-cream p-4">
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                className="mt-1"
                checked={data.consentContact}
                onChange={(e) => update("consentContact", e.target.checked)}
              />
              <span>
                I consent to PK Business Services contacting me about this
                quote using the contact method I chose.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                className="mt-1"
                checked={data.consentQuote}
                onChange={(e) => update("consentQuote", e.target.checked)}
              />
              <span>
                I understand this request is for a quote, not an engagement,
                and that no return has been filed on my behalf. Any submitted
                information is used to prepare that quote.
              </span>
            </label>
          </div>

          {/* Honeypot: humans never see or fill this. */}
          <div aria-hidden="true" className="hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={data.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-gray">
            <p className="font-semibold text-charcoal">Review</p>
            <p className="mt-2">
              {data.fullName || "—"} · {data.email || "—"}
              {data.phone ? ` · ${data.phone}` : ""} · contact by{" "}
              {data.contactMethod}
              {data.contactTime ? ` (${contactTimeLabels.get(data.contactTime)})` : ""}
            </p>
            <p className="mt-1">
              Years:{" "}
              {data.taxYears
                .map(
                  (year) =>
                    `${year} (${filingStatusLabels.get(data.filingStatuses[year] ?? "unknown")}, ${alreadyFiledLabels.get(data.alreadyFiled[year] ?? "no")})`,
                )
                .join(", ") || "—"}
            </p>
            <p className="mt-1">
              Income:{" "}
              {data.complexity.map((c) => complexityLabels.get(c)).join(", ") || "—"}
            </p>
            <p className="mt-1">
              States: {data.states.join(", ") || "—"} · Notices:{" "}
              {data.hasNotices === null ? "—" : data.hasNotices ? "Yes" : "No"} ·
              Records: {recordsLabels.get(data.recordsStatus)}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setErrors([]);
              setStep(step - 1);
            }}
            disabled={submitting}
          >
            ← Back
          </Button>
        )}
        {step < 2 ? (
          <Button type="button" className="min-h-11" onClick={goNext}>
            Continue →
          </Button>
        ) : (
          <Button type="submit" className="min-h-11" disabled={submitting}>
            {submitting ? "Sending…" : "Submit my Catch-Up 1040 intake"}
          </Button>
        )}
      </div>
    </form>
  );
}
