// Synthetic-only test battery for the PK Practice Partners CPA application.
// No real firm or taxpayer data; runs against a disposable temp SQLite
// database that is deleted after the run. Mirrors the storage policy: the
// public application never collects or persists SSNs, taxpayer files, or
// sensitive client data. Run: npm run test:cpa:partners
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "pk-cpa-partners-"));
const dbFile = join(tmp, "cpa-partners.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.PK_ENVIRONMENT = "test";
Object.assign(process.env, { NODE_ENV: "test" });

execFileSync(
  process.execPath,
  [join("node_modules", "prisma", "build", "index.js"), "db", "push", `--url=file:${dbFile}`],
  { stdio: "pipe" },
);

const {
  parseCpaPartnerApplication,
  screenCpaPartnerApplication,
  assertCpaStatusTransition,
  ADMIN_ONLY_CPA_STATUS_TRANSITIONS,
} = await import("../src/lib/cpa-partners");
const { prisma } = await import("@/lib/prisma");

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firmName: "Synthetic CPA Associates",
    contactName: "Synthetic Test Partner",
    email: "synthetic.firm@example.com",
    phone: "555 201 8890",
    serviceNeeds: ["monthly_bookkeeping", "tax_ready_books"],
    partnershipModel: "white_label",
    scopeNotes: "Twelve monthly bookkeeping clients on QuickBooks Online needing close support.",
    acknowledgement: true,
    website: "",
    ...overrides,
  };
}

test("valid application parses and normalizes", () => {
  const result = parseCpaPartnerApplication(validBody());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.payload.email, "synthetic.firm@example.com");
  assert.equal(result.payload.phone, "5552018890");
  assert.deepEqual(result.payload.serviceNeeds, ["monthly_bookkeeping", "tax_ready_books"]);
  assert.equal(result.payload.partnershipModel, "white_label");
  assert.equal(result.payload.acknowledgement, true);
});

test("honeypot is detected without leaking the response", () => {
  const result = parseCpaPartnerApplication(validBody({ website: "http://spam.example" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.honeypot, true);
});

test("missing acknowledgement is rejected", () => {
  const result = parseCpaPartnerApplication(validBody({ acknowledgement: false }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /confirm/);
});

test("empty service needs is rejected", () => {
  const result = parseCpaPartnerApplication(validBody({ serviceNeeds: [] }));
  assert.equal(result.ok, false);
});

test("unknown service needs and models are dropped or rejected", () => {
  const filtered = parseCpaPartnerApplication(
    validBody({ serviceNeeds: ["monthly_bookkeeping", "not_a_real_service"] }),
  );
  assert.equal(filtered.ok, true);
  if (!filtered.ok) return;
  assert.deepEqual(filtered.payload.serviceNeeds, ["monthly_bookkeeping"]);

  const badModel = parseCpaPartnerApplication(validBody({ partnershipModel: "not_a_real_model" }));
  assert.equal(badModel.ok, false);
});

test("invalid email is rejected", () => {
  const result = parseCpaPartnerApplication(validBody({ email: "not-an-email" }));
  assert.equal(result.ok, false);
});

test("sensitive data in free text is screened", () => {
  const findings = screenCpaPartnerApplication({
    firmName: "Clean Firm",
    contactName: "Clean Contact",
    scopeNotes: "Our client SSN 123-45-6789 needs cleanup.",
  });
  assert.equal(findings.length > 0, true);
  assert.deepEqual(
    screenCpaPartnerApplication({
      firmName: "Clean Firm",
      contactName: "Clean Contact",
      scopeNotes: "Monthly bookkeeping for 15 QBO clients.",
    }),
    [],
  );
});

test("application persists as an identifiable intake submission with partner record", async () => {
  const parsed = parseCpaPartnerApplication(validBody());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const payload = parsed.payload;

  const submission = await prisma.intakeSubmission.create({
    data: {
      fullName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      businessName: payload.firmName,
      serviceSlug: "cpa-partner-application",
      description: payload.scopeNotes,
      contactMethod: "email",
    },
  });

  const application = await prisma.cpaPartnerApplication.create({
    data: {
      intakeSubmissionId: submission.id,
      firmName: payload.firmName,
      contactName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      serviceNeeds: JSON.stringify(payload.serviceNeeds),
      partnershipModel: payload.partnershipModel,
      scopeNotes: payload.scopeNotes,
      acknowledgement: payload.acknowledgement,
    },
  });

  assert.equal(application.status, "NEW_APPLICATION");
  assert.equal(application.intakeSubmissionId, submission.id);

  const linked = await prisma.intakeSubmission.findUnique({
    where: { id: application.intakeSubmissionId ?? "" },
  });
  assert.equal(linked?.serviceSlug, "cpa-partner-application");
});

test("duplicate window query finds a live duplicate", async () => {
  const existing = await prisma.cpaPartnerApplication.findFirst({
    where: {
      email: "synthetic.firm@example.com",
      status: { not: "DECLINED" },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  assert.ok(existing);
});

test("declined applications fall outside the duplicate window", async () => {
  await prisma.cpaPartnerApplication.update({
    where: { id: (await prisma.cpaPartnerApplication.findFirstOrThrow()).id },
    data: { status: "DECLINED", declinedAt: new Date() },
  });
  const existing = await prisma.cpaPartnerApplication.findFirst({
    where: {
      email: "synthetic.firm@example.com",
      status: { not: "DECLINED" },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  assert.equal(existing, null);
});

test("staff cannot approve, decline, or onboard; admin can", () => {
  const staffApprove = assertCpaStatusTransition(false, "QUOTE_SENT", "APPROVED");
  assert.equal(staffApprove.ok, false);
  const staffDecline = assertCpaStatusTransition(false, "NEW_APPLICATION", "DECLINED");
  assert.equal(staffDecline.ok, false);
  const staffOnboard = assertCpaStatusTransition(false, "APPROVED", "ONBOARDED");
  assert.equal(staffOnboard.ok, false);

  const adminApprove = assertCpaStatusTransition(true, "QUOTE_SENT", "APPROVED");
  assert.equal(adminApprove.ok, true);
  const adminDecline = assertCpaStatusTransition(true, "NEW_APPLICATION", "DECLINED");
  assert.equal(adminDecline.ok, true);
  const staffReview = assertCpaStatusTransition(false, "NEW_APPLICATION", "IN_REVIEW");
  assert.equal(staffReview.ok, true);
  const staffQuote = assertCpaStatusTransition(false, "IN_REVIEW", "QUOTE_SENT");
  assert.equal(staffQuote.ok, true);
  const same = assertCpaStatusTransition(true, "APPROVED", "APPROVED");
  assert.equal(same.ok, false);
});

test("admin-only transition set is exactly the founder decisions", () => {
  assert.deepEqual(
    [...ADMIN_ONLY_CPA_STATUS_TRANSITIONS].sort(),
    ["APPROVED", "DECLINED", "ONBOARDED"],
  );
});

test("temp database cleaned up", () => {
  rmSync(tmp, { recursive: true, force: true });
  assert.equal(true, true);
});
