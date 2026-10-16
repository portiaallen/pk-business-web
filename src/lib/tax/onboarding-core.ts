// PK Tax Division - conditional intake & due-diligence core.
// Implements the approved intake specification v1.0 rules for the PK website
// backend (founder-approved architecture correction, October 16, 2026): PK's
// own website and validated restricted backend/vault run client onboarding
// and secure document intake; TaxSmart Pro is return preparation and
// e-filing only.
//
// Sensitive identifiers are NEVER stored here. They are screened out before
// persistence (see ./intake-screen) and recorded only as a SECURE_ROUTE
// requirement. This module is logic-only: no I/O, no database, no network.
"use strict";

export type Severity = "review" | "documents" | "secure";

export interface Flag {
  code: string;
  message: string;
  severity: Severity;
}

export interface DdTrigger {
  form: string;
  credit: string;
  subject: string;
  reason: string;
}

export interface ChecklistItem {
  item: string;
  tag: string;
  detail?: string;
}

export interface UploadRecord {
  name?: string;
  ts: string;
}

export interface Access {
  verified: boolean;
  granted: boolean;
  closed: boolean;
  attested: boolean;
}

export interface Gates {
  engagement_agreement_signed: boolean;
  form_8879_signed: boolean;
  preparer_review_cleared: boolean;
  final_return_approval: boolean;
  client_attestation_uploaded: boolean;
  upload_access_closed: boolean;
}

export interface AuditEntry {
  ts: string;
  event: string;
  detail: Record<string, unknown> | string;
}

export interface Dependent {
  label?: string;
  relationship?: string;
  dob_year?: number;
  dob_month?: number;
  dob_day?: number;
  residency_evidence?: string;
  student_enrolled?: boolean;
  full_time_student?: boolean;
  "1098_t_issued"?: boolean;
  education_expense_records?: boolean;
  other_claimant?: boolean;
  custody_split?: boolean;
  _ageAtYearEnd?: number;
  _ctcEligibleAge?: boolean;
  _nameRequired?: string;
  _qualifyingChildStudentRule?: boolean;
}

export interface Session {
  taxYear: number;
  sessionId: string;
  answers: Record<string, unknown>;
  dependents: Dependent[];
  audit: AuditEntry[];
  flags: Flag[];
  ddTriggers: DdTrigger[];
  checklist: ChecklistItem[];
  pending: string[];
  gates: Gates;
  uploads: UploadRecord[];
  access: Access;
}

export const TAG = {
  IRS: "IRS-required-in-context",
  PK: "PK internal policy",
  COND: "conditional evidence",
} as const;

export const NS = "Not Sure";

// Fields that must never persist in intake answers; they are logged only as
// secure-route requirements.
export const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  "taxpayer_ssn", "spouse_ssn", "dependent_ssns", "ip_pin", "ip_pin_value",
  "bank_routing_account", "id_documents", "tax_source_documents",
  "taxpayer_dob_identity", "dependent_identity",
]);

export const UNIVERSAL_QUESTIONS: readonly string[] = [
  "taxpayer_and_spouse_legal_identity", "dob", "taxpayer_ids", "contact", "address",
  "marital_status_dec31", "filing_history", "income_screening", "dependents",
  "household_living_arrangements", "irs_correspondence", "prior_return_and_carryforwards",
  "estimated_payments", "digital_assets", "foreign_multistate", "bank_refund_or_payment_election",
  "marketplace_coverage_per_household_member", "ip_pin_status", "blindness_taxpayer", "blindness_spouse",
];

const IS_CHILD = [
  "son", "daughter", "child", "stepchild", "foster child",
  "grandchild", "sibling", "brother", "sister",
];

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function itemId(): string {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

function log(s: Session, event: string, detail: Record<string, unknown> | string): void {
  s.audit.push({ ts: nowIso(), event, detail });
}

function flag(s: Session, code: string, message: string, severity: Severity = "review"): void {
  s.flags.push({ code, message, severity });
  log(s, "flag_raised", { code, message });
}

// Small typed accessors over the open answer record.
function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function asRecordArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

export function createSession(taxYear?: number, id?: string): Session {
  const s: Session = {
    taxYear: taxYear ?? 2026,
    sessionId: id ?? `SYN-${itemId()}`,
    answers: {},
    dependents: [],
    audit: [],
    flags: [],
    ddTriggers: [],
    checklist: [],
    pending: [],
    gates: {
      engagement_agreement_signed: false,
      form_8879_signed: false,
      preparer_review_cleared: false,
      final_return_approval: false,
      client_attestation_uploaded: false,
      upload_access_closed: false,
    },
    uploads: [],
    access: { verified: false, granted: false, closed: false, attested: false },
  };
  log(s, "session_start", { sessionId: s.sessionId, taxYear: s.taxYear, mode: "synthetic-only" });
  return s;
}

// IRS convention: a January 1 birth counts one year older at year end.
export function ageAtYearEnd(s: Session, birthYear: number, birthMonth?: number, birthDay?: number): number {
  let age = s.taxYear - birthYear;
  if (birthMonth === 1 && birthDay === 1) age += 1;
  return age;
}

export function recordAnswer(s: Session, key: string, value: unknown): void {
  if (SENSITIVE_FIELDS.has(key)) {
    log(s, "secure_route_required", {
      field: key,
      value: "<redacted: approved secure process only>",
    });
    flag(
      s,
      "SECURE_ROUTE",
      `${key} must be collected only through PK's approved secure document workflow into the restricted backend/vault; never stored in this engine.`,
      "secure",
    );
    return;
  }
  s.answers[key] = value;
  log(s, "answer_recorded", { field: key, value });
}

export function compute(s: Session): Session {
  const a = s.answers;
  log(s, "compute_start", { answers: Object.keys(a).sort() });
  s.pending = [...UNIVERSAL_QUESTIONS];

  // Marketplace / 1095-A per household member.
  for (const m of asRecordArray(a.marketplace_coverage)) {
    if (m.had_marketplace === "Yes" || m.had_marketplace === NS) {
      s.pending.push("form_1095_a");
      if (m["1095_a_available"] === false) {
        flag(
          s,
          "MISSING_1095A",
          "Marketplace coverage reported but no Form 1095-A on file; obtain it before Form 8962 reconciliation.",
          "documents",
        );
      }
    }
  }

  // IP PIN states.
  const ipPin = asString(a.ip_pin_status);
  if (ipPin === NS) {
    s.pending.push("ip_pin_assistance");
    flag(s, "IP_PIN_NOT_SURE", "Client unsure whether IRS issued an IP PIN; run IP PIN retrieval assistance and verify before transmission.");
  } else if (ipPin === "Yes") {
    flag(s, "IP_PIN_SECURE_ROUTE", "IP PIN exists; collect only via restricted approved secure process and check prior to transmission.", "secure");
  }

  // Blindness.
  if (a.blindness_taxpayer === "Yes" || a.blindness_taxpayer === NS) {
    s.pending.push("blindness_followup_taxpayer");
    if (a.blindness_taxpayer === "Yes") {
      s.checklist.push({ item: "Legal blindness evidence (physician or benefit statement)", tag: TAG.COND });
    }
  }
  if (a.blindness_spouse === "Yes" || a.blindness_spouse === NS) {
    s.pending.push("blindness_followup_spouse");
  }

  // 65+ rule.
  const dobYear = asNumber(a.taxpayer_dob_year);
  if (dobYear !== undefined) {
    const age = ageAtYearEnd(s, dobYear, asNumber(a.taxpayer_dob_month), asNumber(a.taxpayer_dob_day));
    if (age >= 65) s.pending.push("senior_deductions");
    log(s, "age_gate", { ageAtYearEnd: age });
  }

  // Dependents.
  const dep = asString(a.dependents) ?? (a.dependents === undefined ? NS : String(a.dependents));
  if (dep === "Yes") {
    s.pending.push("dependent_details");
    s.dependents.forEach((d, i) => dependentRules(s, i, d));
  } else if (dep === NS) {
    flag(s, "DEPENDENTS_NOT_SURE", "Dependent status uncertain: route to preparer review before any filing-status or credit determination.");
  } else {
    log(s, "dependent_branch", "No dependents: branch skipped; due diligence still evaluated.");
  }

  // Independent Form 8867 due-diligence triggers.
  if (asBool(a.earned_income)) {
    s.ddTriggers.push({ form: "8867", credit: "EITC", subject: "taxpayer", reason: "earned income present; full due diligence required" });
  }
  if (asBool(a.hoh_considering) || ["unmarried", "divorced", "legally separated", NS].includes(asString(a.marital_status_dec31) ?? "")) {
    s.pending.push("hoh_qualifying_person");
    s.ddTriggers.push({
      form: "8867",
      credit: "HOH",
      subject: "taxpayer",
      reason: "filing status may be Head of Household; qualifying person and cost-of-home due diligence required even when the dependents answer is No",
    });
  }
  if (dep === "Yes" && s.dependents.length === 0) {
    flag(s, "DEPENDENT_DETAIL_MISSING", "Dependents reported Yes but no dependent records collected.", "documents");
  }

  // Special cases.
  if (asBool(a.childcare_payments)) {
    s.pending.push("childcare_provider_details");
    s.ddTriggers.push({ form: "8867", credit: "Form 2441", subject: "taxpayer", reason: "childcare payments reported" });
  }
  if (asBool(a.self_employed)) {
    s.pending.push("schedule_c_details", "1099_k_details", "estimated_taxes");
    if (asBool(a.cash_or_1099k)) {
      flag(s, "SE_1099K", "Self-employment income includes cash or Form 1099-K receipts; record gross receipts reconciliation and estimated-tax status.", "documents");
    }
  }
  for (const k of ["prior_irs_notices", "identity_theft_history", "rejected_or_unfiled_returns", "loss_or_carryover"]) {
    if (asBool(a[k])) {
      flag(s, `PRIOR_ISSUE_${k.toUpperCase()}`, `${k.replace(/_/g, " ")} reported: preparer review required.`);
    }
  }

  buildChecklist(s);
  detectContradictions(s);
  log(s, "compute_end", { flags: s.flags.length, ddTriggers: s.ddTriggers.length, checklist: s.checklist.length });
  return s;
}

function dependentRules(s: Session, i: number, d: Dependent): void {
  const label = d.label ?? `dependent_${i + 1}`;
  log(s, "dependent_branch", { index: i, label });
  if (d.dob_year === undefined) {
    flag(s, "DEPENDENT_RECORDS_MISSING", `${label}: date of birth missing; dependency and credit age rules cannot be applied.`, "documents");
    return;
  }
  const age = ageAtYearEnd(s, d.dob_year, d.dob_month, d.dob_day);
  d._ageAtYearEnd = age;
  const isChild = IS_CHILD.includes((d.relationship ?? "").toLowerCase());
  if (isChild) {
    if (age < 17) {
      d._ctcEligibleAge = true;
      s.ddTriggers.push({ form: "8867", credit: "CTC/ACTC/ODC", subject: label, reason: "qualifying child under 17 at year end" });
    } else if (age === 17) {
      d._ctcEligibleAge = false;
      s.ddTriggers.push({ form: "8867", credit: "ODC", subject: label, reason: "child is 17: CTC age cutoff passed; other-dependent credit only" });
      flag(s, "CTC_AGE_CUTOFF", `${label} is 17 at year end: NOT eligible for the child tax credit; evaluate the other-dependent credit instead.`);
    } else {
      d._ctcEligibleAge = false;
      s.ddTriggers.push({ form: "8867", credit: "ODC", subject: label, reason: "child over 17: other-dependent credit path only" });
    }
    if (age <= 17 && (!d.residency_evidence || ["none", "mail only"].includes(d.residency_evidence))) {
      flag(
        s,
        "PK_RESIDENCY_EVIDENCE",
        `${label} age ${age}: PK policy requires third-party evidence of residential address (school, medical/childcare records, or qualifying official mail). Mail alone does not establish time lived with the taxpayer.`,
        "documents",
      );
    }
  }
  if ((isChild ? age <= 24 : false) || d.full_time_student) {
    if (d.student_enrolled) {
      s.pending.push(`college_branch_${label}`);
      if (d["1098_t_issued"]) {
        d._nameRequired = "student";
        flag(
          s,
          "1098T_NAME_CHECK",
          `${label}: Form 1098-T is ordinarily issued in the student's name, not the parent's; verify whose 1098-T is on file and whose education expenses are claimed.`,
          "documents",
        );
      }
      if (!d.education_expense_records) {
        flag(
          s,
          "EDUCATION_RECORDS_MISSING",
          `${label}: enrollment dates, full/half-time status, tuition, required materials, scholarships/grants and support must be documented before any education credit is considered.`,
          "documents",
        );
      }
      s.ddTriggers.push({ form: "8867", credit: "AOTC", subject: label, reason: "education credit possible; full due diligence; no automatic eligibility" });
      if (d.full_time_student && isChild && age < 24) {
        d._qualifyingChildStudentRule = true;
      } else if (isChild && age >= 24) {
        flag(
          s,
          "STUDENT_AGE_LIMIT",
          `${label} is ${age} at year end: the qualifying-child full-time-student age rule generally ends under 24 at year end; a 24-year-old may still qualify under other dependency rules. Preparer evaluation required, no automatic classification.`,
        );
      }
    }
  }
  if (!isChild) {
    s.pending.push(`qualifying_relative_${label}`);
    for (const req of ["gross_income", "support_pct", "relationship_test"]) {
      if (!(req in d)) {
        flag(s, "QUALIFYING_RELATIVE_RECORDS", `${label}: qualifying-relative determination needs ${req.replace(/_/g, " ")} evidence; dependent logic is not restricted to children.`, "documents");
      }
    }
  }
  if (d.other_claimant || d.custody_split) {
    s.pending.push("form_8332");
    flag(s, "CUSTODY_CONFLICT", `${label}: another household or custody split reported; evaluate Form 8332, potential duplicate claim and tiebreaker rules. Preparer review required.`);
  }
}

function buildChecklist(s: Session): void {
  const a = s.answers;
  s.checklist.push({ item: "W-2s (all employers)", tag: TAG.IRS });
  if (asBool(a.income_1099) || asBool(a.self_employed)) {
    s.checklist.push({ item: "Forms 1099 (all types, incl. 1099-K)", tag: TAG.IRS });
  }
  if (a.dependents === "Yes" || a.dependents === NS) {
    s.checklist.push({ item: "Dependent identity verification (SSN/ITIN, DOB) - secure channel only", tag: TAG.IRS });
    s.checklist.push({ item: "Third-party residency evidence for children 17 and under (school, medical/childcare records or qualifying official mail)", tag: TAG.PK });
  }
  for (const d of s.dependents) {
    if (d.student_enrolled && d["1098_t_issued"]) {
      s.checklist.push({ item: "Form 1098-T (must be in the STUDENT's name)", detail: `dependent: ${d.label ?? "unlabeled"}`, tag: TAG.IRS });
    }
    if (d.other_claimant || d.custody_split) {
      s.checklist.push({ item: "Form 8332 (release of claim) if the noncustodial parent claims", tag: TAG.IRS });
    }
  }
  if (a.marketplace_coverage !== undefined) {
    s.checklist.push({ item: "Form 1095-A for each covered household member", tag: TAG.IRS });
  }
  if (asBool(a.childcare_payments)) {
    s.checklist.push({ item: "Childcare provider name, address and taxpayer ID (Form 2441)", tag: TAG.IRS });
  }
  if (asBool(a.self_employed)) {
    s.checklist.push({ item: "Business income and expense records, mileage log, inventory records", tag: TAG.IRS });
  }
  if (asBool(a.estimated_payments_made)) {
    s.checklist.push({ item: "Estimated tax payment records", tag: TAG.IRS });
  }
  if (asBool(a.digital_assets)) {
    s.checklist.push({ item: "Digital asset transaction records", tag: TAG.IRS });
  }
  if (asBool(a.foreign_or_multistate)) {
    s.checklist.push({ item: "Foreign income/account and multistate records", tag: TAG.IRS });
  }
  s.checklist.push({ item: "Prior-year return (for carryforwards and continuity)", tag: TAG.PK });
}

function detectContradictions(s: Session): void {
  const a = s.answers;
  if (a.dependents === "No" && asBool(a.hoh_via_qualifying_child)) {
    flag(s, "CONTRADICTION_HOH", "Dependents answered No while Head of Household is based on a qualifying child: resolve before filing status is set.");
  }
  if (a.marital_status_dec31 === "married" && asBool(a.hoh_considering)) {
    flag(s, "CONTRADICTION_STATUS", "Married as of Dec 31 but Head of Household indicated: residency and cost-of-home facts must be resolved by the preparer.");
  }
  if (s.flags.some((f) => f.severity === "review" || f.severity === "documents")) {
    log(s, "gate_hold", {
      unresolvedFlags: s.flags.length,
      note: "transmission remains blocked until the preparer resolves and explicitly clears the review gate",
    });
  }
}

// ---- secure upload workflow (client identity -> limited access -> uploads ->
//      attestation -> preparer notification -> manual closure)

export function verifyIdentity(s: Session, ok: boolean): boolean {
  s.access.verified = !!ok;
  log(s, "identity_verified", { verified: s.access.verified });
  return s.access.verified;
}

export function grantAccess(s: Session): boolean {
  if (!s.access.verified) {
    log(s, "access_denied", "unverified client");
    return false;
  }
  s.access.granted = true;
  log(s, "access_granted", "restricted intake folder, verified client only");
  return true;
}

export function uploadDocument(s: Session, docMeta?: { name?: string }): boolean {
  if (!s.access.granted || s.access.closed) {
    log(s, "upload_blocked", "fail closed");
    flag(s, "UPLOAD_BLOCKED", "Upload attempt rejected: access not granted or already closed.");
    return false;
  }
  s.uploads.push({ name: docMeta?.name, ts: nowIso() });
  log(s, "upload_recorded", { name: docMeta?.name });
  return true;
}

export function attest(s: Session): boolean {
  if (s.uploads.length === 0) {
    log(s, "attestation_refused", "nothing uploaded");
    return false;
  }
  s.access.attested = true;
  s.gates.client_attestation_uploaded = true;
  log(s, "client_attestation", "I've Finished Uploading; preparer notified");
  return true;
}

export function closeAccess(s: Session): void {
  s.access.closed = true;
  s.gates.upload_access_closed = true;
  log(s, "access_closed", "manual revocation; archive copies verified per storage policy");
}

export function canTransmit(s: Session): { allowed: boolean; reasons: string[] } {
  const reasons = Object.keys(s.gates).filter((g) => !s.gates[g as keyof Gates]);
  if (s.flags.some((f) => f.severity === "review" || f.severity === "documents" || f.severity === "secure")) {
    reasons.push("unresolved_flags");
  }
  return { allowed: reasons.length === 0, reasons };
}

export function clearPreparerGate(s: Session, preparer: string): void {
  s.gates.preparer_review_cleared = true;
  log(s, "preparer_gate", { clearedBy: preparer, note: "explicit preparer sign-off recorded with timestamp" });
}
