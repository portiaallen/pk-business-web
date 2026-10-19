// Synthetic-only test battery for the PK Tax Division onboarding backend.
// No real taxpayer data; no network, no database. Mirrors the approved
// 25-case Python reference battery plus server-side screening negative paths.
// Run: npm run test:tax:onboarding
import test from "node:test";
import assert from "node:assert/strict";
import {
  ageAtYearEnd,
  attest,
  canTransmit,
  closeAccess,
  compute,
  createSession,
  clearPreparerGate,
  preparerGrantAccess,
  submitIdentityDocuments,
  NS,
  recordAnswer,
  uploadDocument,
  requestIdentityVerification,
} from "../src/lib/tax/onboarding-core";
import { rejectIfSensitive } from "../src/lib/tax/intake-screen";

test("dependents Yes opens branch", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{ label: "kidA", dob_year: 2015, relationship: "daughter" }];
  compute(s);
  assert(s.pending.includes("dependent_details"));
});

test("dependents No skips branch, keeps DD", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "No");
  compute(s);
  assert(!s.pending.includes("dependent_details"));
  assert.equal(s.flags.length, 0);
});

test("dependents Not Sure routes to preparer", () => {
  const s = createSession();
  recordAnswer(s, "dependents", NS);
  compute(s);
  assert(s.flags.some((f) => f.code === "DEPENDENTS_NOT_SURE"));
});

test("child 16 CTC-eligible", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{ label: "kidA", dob_year: 2010, relationship: "son", residency_evidence: "school records" }];
  compute(s);
  assert.equal(s.dependents[0]._ctcEligibleAge, true);
  assert(s.ddTriggers.some((t) => t.credit === "CTC/ACTC/ODC"));
});

test("child 17 CTC cutoff + ODC + PK evidence", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{ label: "kidB", dob_year: 2009, relationship: "son" }];
  compute(s);
  assert.equal(s.dependents[0]._ctcEligibleAge, false);
  assert(s.ddTriggers.some((t) => t.credit === "ODC"));
  assert(s.flags.some((f) => f.code === "CTC_AGE_CUTOFF"));
  assert(s.flags.some((f) => f.code === "PK_RESIDENCY_EVIDENCE"));
});

test("college student 23 AOTC + 1098-T name", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{
    label: "kidC", dob_year: 2003, relationship: "daughter",
    full_time_student: true, student_enrolled: true, "1098_t_issued": true,
    education_expense_records: true,
  }];
  compute(s);
  assert(s.ddTriggers.some((t) => t.credit === "AOTC"));
  assert(s.flags.some((f) => f.code === "1098T_NAME_CHECK"));
  assert(s.checklist.some((c) => c.item.includes("STUDENT's name")));
});

test("college student 24 age limit", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{
    label: "kidD", dob_year: 2002, relationship: "son",
    full_time_student: true, student_enrolled: true, "1098_t_issued": true,
    education_expense_records: true,
  }];
  compute(s);
  assert(s.flags.some((f) => f.code === "STUDENT_AGE_LIMIT"));
});

test("other dependent over 24 (qualifying relative)", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{ label: "momE", dob_year: 1954, relationship: "mother" }];
  compute(s);
  assert(s.pending.some((p) => p.startsWith("qualifying_relative_")));
  assert(s.flags.some((f) => f.code === "QUALIFYING_RELATIVE_RECORDS"));
});

test("divorced parents / custody + 8332", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{ label: "kidF", dob_year: 2014, relationship: "daughter", custody_split: true }];
  compute(s);
  assert(s.flags.some((f) => f.code === "CUSTODY_CONFLICT"));
  assert(s.pending.includes("form_8332"));
});

test("HOH without dependents response", () => {
  const s = createSession();
  recordAnswer(s, "hoh_considering", true);
  compute(s);
  assert(s.ddTriggers.some((t) => t.credit === "HOH"));
  assert(s.pending.includes("hoh_qualifying_person"));
});

test("blindness follow-up + evidence", () => {
  const s = createSession();
  recordAnswer(s, "blindness_taxpayer", "Yes");
  compute(s);
  assert(s.pending.includes("blindness_followup_taxpayer"));
  assert(s.checklist.some((c) => c.item.toLowerCase().includes("blindness")));
});

test("65th birthday rule (incl. Jan 1 IRS convention)", () => {
  assert.equal(ageAtYearEnd(createSession(), 1961), 65);
  assert.equal(ageAtYearEnd(createSession(), 1962), 64);
  assert.equal(ageAtYearEnd(createSession(), 1962, 1, 1), 65);
  const s = createSession();
  recordAnswer(s, "taxpayer_dob_year", 1961);
  compute(s);
  assert(s.pending.includes("senior_deductions"));
});

test("missing IP PIN retrieval path", () => {
  const s = createSession();
  recordAnswer(s, "ip_pin_status", NS);
  compute(s);
  assert(s.flags.some((f) => f.code === "IP_PIN_NOT_SURE"));
  assert(s.pending.includes("ip_pin_assistance"));
});

test("IP PIN never stored (secure route)", () => {
  const s = createSession();
  recordAnswer(s, "ip_pin", "123456");
  compute(s);
  assert(!("ip_pin" in s.answers));
  assert(s.flags.some((f) => f.code === "SECURE_ROUTE"));
});

test("Marketplace 1095-A + 8962 path", () => {
  const s = createSession();
  recordAnswer(s, "marketplace_coverage", [{ who: "taxpayer", had_marketplace: "Yes", "1095_a_available": false }]);
  compute(s);
  assert(s.flags.some((f) => f.code === "MISSING_1095A"));
  assert(s.pending.includes("form_1095_a"));
  assert(s.checklist.some((c) => c.item.includes("1095-A")));
});

test("self-employed cash / 1099-K", () => {
  const s = createSession();
  recordAnswer(s, "self_employed", true);
  recordAnswer(s, "cash_or_1099k", true);
  compute(s);
  assert(s.flags.some((f) => f.code === "SE_1099K"));
  assert(s.pending.includes("schedule_c_details"));
});

test("conflicting information flag", () => {
  const s = createSession();
  recordAnswer(s, "marital_status_dec31", "married");
  recordAnswer(s, "hoh_considering", true);
  compute(s);
  assert(s.flags.some((f) => f.code === "CONTRADICTION_STATUS"));
});

test("identity and access are preparer-gated (fail closed)", () => {
  const s = createSession();
  assert.equal(preparerGrantAccess(s, "pk"), false); // no identity request yet
  assert.equal(submitIdentityDocuments(s), false); // no secure access yet
  assert.equal(requestIdentityVerification(s), true); // client can only ask
  assert.equal(requestIdentityVerification(s), false); // no duplicate requests
  assert.equal(preparerGrantAccess(s, "pk"), true); // preparer opens access
  closeAccess(s);
  assert.equal(uploadDocument(s, { name: "w2.pdf" }), false);
});

test("attestation requires at least one upload; closure after", () => {
  const s = createSession();
  requestIdentityVerification(s);
  preparerGrantAccess(s, "pk");
  assert.equal(attest(s), false);
  assert.equal(uploadDocument(s, { name: "w2.pdf" }), true);
  assert.equal(attest(s), true);
  assert.equal(s.gates.client_attestation_uploaded, true);
  closeAccess(s);
  assert.equal(uploadDocument(s, { name: "x.pdf" }), false);
});

test("audit trail recorded", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "Yes");
  compute(s);
  const events = s.audit.map((a) => a.event);
  assert(events.includes("session_start"));
  assert(events.includes("compute_end"));
  assert(events.includes("answer_recorded"));
});

test("preparer review + transmission hold", () => {
  const s = createSession();
  recordAnswer(s, "dependents", NS);
  compute(s);
  assert.equal(canTransmit(s).allowed, false);
  s.flags = [];
  for (const g of Object.keys(s.gates) as Array<keyof typeof s.gates>) s.gates[g] = true;
  const tx = canTransmit(s);
  assert.equal(tx.allowed, true, JSON.stringify(tx.reasons));
  clearPreparerGate(s, "preparer");
});

test("8867 fires despite dependents No", () => {
  const s = createSession();
  recordAnswer(s, "dependents", "No");
  recordAnswer(s, "earned_income", true);
  recordAnswer(s, "hoh_considering", true);
  compute(s);
  assert(s.ddTriggers.some((t) => t.credit === "EITC"));
  assert(s.ddTriggers.some((t) => t.credit === "HOH"));
});

// ---- server-side screening negative paths

test("SSN rejected before persistence", () => {
  const r = rejectIfSensitive({ note: "my ssn is 123-45-6789" });
  assert.equal(r.allowed, false);
  assert(r.findings.length > 0);
});

test("SSN-format value rejected", () => {
  assert.equal(rejectIfSensitive({ anything: "123-45-6789" }).allowed, false);
});

test("ITIN-format value rejected", () => {
  assert.equal(rejectIfSensitive({ v: "900-70-1234" }).allowed, false);
});

test("sensitive key name rejected even with innocuous value", () => {
  assert.equal(rejectIfSensitive({ ssn: "none" }).allowed, false);
  assert.equal(rejectIfSensitive({ routing_number: "021000021" }).allowed, false);
  assert.equal(rejectIfSensitive({ bank_account: "x" }).allowed, false);
  assert.equal(rejectIfSensitive({ dob: "2000-01-01" }).allowed, false);
});

test("IP PIN in pin context rejected", () => {
  assert.equal(rejectIfSensitive({ ip_pin: "123456" }).allowed, false);
});

test("benign payload passes screening", () => {
  const r = rejectIfSensitive({ dependents: "Yes", notes: "two school-age children, records to follow" });
  assert.equal(r.allowed, true, JSON.stringify(r.findings));
});

test("screening catches nested payload fields", () => {
  const r = rejectIfSensitive({ form: { contact: { ssn: "" } }, list: ["routing info: 021000021"] });
  assert.equal(r.allowed, false);
});
