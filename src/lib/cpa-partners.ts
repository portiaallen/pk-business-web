// Pure validation and normalization for the PK Practice Partners CPA firm
// application. Paid B2B outsourcing intake, strictly non-sensitive: the form
// never accepts taxpayer files, SSNs, client data, or bank details, and
// server-side sensitive-data screening rejects any sensitive content typed
// into free text BEFORE persistence. Allowlists mirror the catch-up intake
// pattern so a public submission cannot smuggle unexpected fields into
// storage.
import {
  CPA_ACKNOWLEDGEMENT_LABEL,
  CPA_PARTNERSHIP_MODEL_VALUES,
  CPA_SERVICE_NEED_VALUES,
} from "@/content/cpa-partners";
import { detectSensitiveData } from "@/lib/sensitive-data";

export const CPA_INTAKE_INVALID_MESSAGE =
  "Please complete the highlighted fields with valid information.";

export interface CpaPartnerPayload {
  firmName: string;
  contactName: string;
  email: string;
  phone: string | null;
  serviceNeeds: string[];
  partnershipModel: string;
  scopeNotes: string;
  acknowledgement: true;
}

export type CpaPartnerResult =
  | { ok: true; payload: CpaPartnerPayload }
  | { ok: false; error: string; honeypot?: boolean };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Founder retains approval authority: only the ADMIN role may approve,
 * decline, or complete onboarding. STAFF may work an application up to a
 * sent quote but may never approve, decline, or onboard a firm. Exported as
 * a pure guard so the pipeline is testable without a server.
 */
export const ADMIN_ONLY_CPA_STATUS_TRANSITIONS = new Set([
  "APPROVED",
  "DECLINED",
  "ONBOARDED",
]);

export function assertCpaStatusTransition(
  isAdmin: boolean,
  from: string,
  to: string,
): { ok: true } | { ok: false; error: string } {
  if (to === from) {
    return { ok: false, error: "The application is already in that status." };
  }
  if (ADMIN_ONLY_CPA_STATUS_TRANSITIONS.has(to) && !isAdmin) {
    return {
      ok: false,
      error: "Founder approval is required for approval, decline, and onboarding decisions.",
    };
  }
  return { ok: true };
}

/**
 * Parse and validate a raw submission body. Returns a fully normalized
 * payload or a single generic error message. The honeypot field ("website")
 * returns a honeypot result so the caller can accept without persisting.
 */
export function parseCpaPartnerApplication(body: unknown): CpaPartnerResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: CPA_INTAKE_INVALID_MESSAGE };
  }
  const data = body as Record<string, unknown>;

  if (asTrimmedString(data.website) !== "") {
    return { ok: false, error: CPA_INTAKE_INVALID_MESSAGE, honeypot: true };
  }

  const firmName = asTrimmedString(data.firmName).slice(0, 160);
  const contactName = asTrimmedString(data.contactName).slice(0, 120);
  const email = asTrimmedString(data.email).slice(0, 200).toLowerCase();
  const phoneRaw = digitsOnly(asTrimmedString(data.phone)).slice(0, 15);
  const scopeNotes = asTrimmedString(data.scopeNotes).slice(0, 1000);
  const partnershipModel = asTrimmedString(data.partnershipModel);
  const serviceNeeds = [
    ...new Set(
      (Array.isArray(data.serviceNeeds) ? data.serviceNeeds : [])
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => CPA_SERVICE_NEED_VALUES.includes(v as (typeof CPA_SERVICE_NEED_VALUES)[number])),
    ),
  ];
  const acknowledgement = data.acknowledgement === true;

  if (!firmName) return { ok: false, error: "Please enter your firm's name." };
  if (!contactName) return { ok: false, error: "Please enter the authorized contact's name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid business email address." };
  }
  if (phoneRaw && phoneRaw.length < 10) {
    return { ok: false, error: "Please enter a valid phone number." };
  }
  if (serviceNeeds.length === 0) {
    return { ok: false, error: "Please select at least one service need." };
  }
  if (!CPA_PARTNERSHIP_MODEL_VALUES.includes(partnershipModel as (typeof CPA_PARTNERSHIP_MODEL_VALUES)[number])) {
    return { ok: false, error: "Please choose a partnership model." };
  }
  if (!scopeNotes) {
    return { ok: false, error: "Please give a brief, non-sensitive description of the work you need." };
  }
  if (!acknowledgement) {
    return { ok: false, error: `Please confirm: ${CPA_ACKNOWLEDGEMENT_LABEL}` };
  }

  return {
    ok: true,
    payload: {
      firmName,
      contactName,
      email,
      phone: phoneRaw || null,
      serviceNeeds,
      partnershipModel,
      scopeNotes,
      acknowledgement: true,
    },
  };
}

/**
 * Screen the free-text fields a public CPA application accepts. Returns the
 * detected sensitive-data categories (empty when clean). Reuses the shared
 * public-form screening so the existing taxpayer-data protections apply.
 */
export function screenCpaPartnerApplication(fields: {
  firmName: string;
  contactName: string;
  scopeNotes: string;
}): { category: string }[] {
  const scanned = [fields.firmName, fields.contactName, fields.scopeNotes];
  const findings: { category: string }[] = [];
  for (const value of scanned) {
    for (const finding of detectSensitiveData(value)) {
      if (!findings.some((f) => f.category === finding.category)) {
        findings.push({ category: finding.category });
      }
    }
  }
  return findings;
}
