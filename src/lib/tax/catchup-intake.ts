// Pure validation and normalization for the public Catch-Up 1040 intake.
// The public form never accepts sensitive taxpayer data (SSN, ITIN, IP PIN,
// bank details, tax documents). This module enforces strict allowlists so a
// public submission cannot smuggle unexpected fields into storage, and runs
// server-side sensitive-data screening before anything persists.
import {
  ALREADY_FILED_OPTIONS,
  CATCHUP_TAX_YEARS,
  COMPLEXITY_OPTIONS,
  CONTACT_TIME_OPTIONS,
  FILING_STATUS_OPTIONS,
  RECORDS_STATUS_OPTIONS,
  US_STATE_CODES,
  screenCatchupYears,
  type CatchupYearScreening,
} from "@/content/catchup-1040";
import { detectSensitiveData } from "@/lib/sensitive-data";

export type { CatchupYearScreening };

const filingStatusValues = new Set<string>(FILING_STATUS_OPTIONS.map((o) => o.value));
const alreadyFiledValues = new Set<string>(ALREADY_FILED_OPTIONS.map((o) => o.value));
const complexityValues = new Set<string>(COMPLEXITY_OPTIONS.map((o) => o.value));
const contactTimeValues = new Set<string>(CONTACT_TIME_OPTIONS.map((o) => o.value));
const recordsValues = new Set<string>(RECORDS_STATUS_OPTIONS.map((o) => o.value));
const stateValues = new Set<string>(US_STATE_CODES);
const yearValues = new Set<string>(CATCHUP_TAX_YEARS);

export interface CatchupIntakePayload {
  fullName: string;
  email: string;
  phone: string | null;
  contactMethod: "email" | "phone";
  contactTime: string | null;
  taxYears: string[];
  filingStatuses: Record<string, string>;
  alreadyFiled: Record<string, string>;
  complexity: string[];
  notes: string | null;
  states: string[];
  hasNotices: boolean;
  recordsStatus: string;
  consent: true;
}

export type CatchupIntakeFailure = { error: string };
export type CatchupIntakeResult =
  | { ok: true; payload: CatchupIntakePayload; screening: CatchupYearScreening[] }
  | { ok: false; error: string; honeypot?: boolean };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function asYearMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [year, status] of Object.entries(value as Record<string, unknown>)) {
    if (typeof status === "string") out[year] = status;
  }
  return out;
}

export const CATCHUP_INTAKE_INVALID_MESSAGE =
  "Please complete the highlighted fields with valid information.";

/**
 * Parse and validate a raw submission body. Returns a fully normalized
 * payload or a single generic error message. The honeypot field ("website")
 * returns a honeypot result so the caller can accept without persisting.
 */
export function parseCatchupIntake(body: unknown): CatchupIntakeResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: CATCHUP_INTAKE_INVALID_MESSAGE };
  }
  const data = body as Record<string, unknown>;

  if (asTrimmedString(data.website) !== "") {
    return { ok: false, error: CATCHUP_INTAKE_INVALID_MESSAGE, honeypot: true };
  }

  const fullName = asTrimmedString(data.fullName).slice(0, 120);
  const email = asTrimmedString(data.email).slice(0, 200).toLowerCase();
  const phoneRaw = digitsOnly(asTrimmedString(data.phone));
  const notesRaw = asTrimmedString(data.notes).slice(0, 1000);

  const contactMethod = asTrimmedString(data.contactMethod);
  const contactTime = asTrimmedString(data.contactTime);
  const recordsStatus = asTrimmedString(data.recordsStatus);
  const taxYears = [...new Set(asStringArray(data.taxYears))].filter((y) => yearValues.has(y));
  const complexity = [...new Set(asStringArray(data.complexity))].filter((c) => complexityValues.has(c));
  const states = [...new Set(asStringArray(data.states).map((s) => s.toUpperCase()))].filter((s) =>
    stateValues.has(s),
  );
  const filingStatuses = asYearMap(data.filingStatuses);
  const alreadyFiled = asYearMap(data.alreadyFiled);
  const hasNotices = data.hasNotices === true;
  const consent = data.consent === true;

  if (!fullName) return { ok: false, error: "Please enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (contactMethod !== "email" && contactMethod !== "phone") {
    return { ok: false, error: "Please choose how PK should contact you." };
  }
  if (contactMethod === "phone" && (phoneRaw.length < 10 || phoneRaw.length > 15)) {
    return { ok: false, error: "Please enter a valid phone number so PK can reach you." };
  }
  if (contactTime && !contactTimeValues.has(contactTime)) {
    return { ok: false, error: CATCHUP_INTAKE_INVALID_MESSAGE };
  }
  if (taxYears.length === 0) {
    return { ok: false, error: "Please select at least one tax year (2023, 2024, or 2025)." };
  }
  for (const year of taxYears) {
    if (!filingStatusValues.has(filingStatuses[year] ?? "")) {
      return { ok: false, error: `Please choose a filing status for ${year}.` };
    }
    if (!alreadyFiledValues.has(alreadyFiled[year] ?? "")) {
      return { ok: false, error: `Please say whether ${year} was already filed.` };
    }
  }
  if (complexity.length === 0) {
    return { ok: false, error: "Please select the income types that apply to you." };
  }
  if (states.length === 0) {
    return { ok: false, error: "Please select at least one state." };
  }
  if (recordsStatus && !recordsValues.has(recordsStatus)) {
    return { ok: false, error: CATCHUP_INTAKE_INVALID_MESSAGE };
  }
  if (!consent) {
    return { ok: false, error: "Please confirm the two checkboxes so PK can contact you about this quote." };
  }

  const payload: CatchupIntakePayload = {
    fullName,
    email,
    phone: phoneRaw || null,
    contactMethod,
    contactTime: contactTime || null,
    taxYears,
    filingStatuses,
    alreadyFiled,
    complexity,
    notes: notesRaw || null,
    states,
    hasNotices,
    recordsStatus: recordsStatus || "not_sure",
    consent,
  };

  const screening = screenCatchupYears({
    complexity: payload.complexity,
    hasNotices: payload.hasNotices,
    years: payload.taxYears.map((year) => ({
      year,
      filingStatus: payload.filingStatuses[year],
      alreadyFiled: payload.alreadyFiled[year],
    })),
  });

  // Defense in depth: the form collects no sensitive fields, but any
  // sensitive content typed into free-text or name fields is rejected before
  // persistence rather than stored.
  const sensitiveFindings = detectSensitiveData(fullName);
  if (notesRaw) sensitiveFindings.push(...detectSensitiveData(notesRaw));
  if (sensitiveFindings.length > 0) {
    return {
      ok: false,
      error:
        "Please remove sensitive information such as Social Security numbers, tax forms, or bank details and resubmit, or contact us directly to share it securely.",
    };
  }

  return { ok: true, payload, screening };
}

export function simpleEligibleFromScreening(screening: CatchupYearScreening[]): boolean {
  return screening.length > 0 && screening.every((s) => s.simpleEligible);
}
