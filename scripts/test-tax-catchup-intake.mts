// Synthetic-only test battery for the public Catch-Up 1040 intake.
// No real taxpayer data; runs against a disposable temp SQLite database that
// is deleted after the run. Mirrors the storage policy: the public intake
// never collects or persists SSNs, DOBs, bank details, or tax documents.
// Run: npm run test:tax:catchup
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "pk-tax-catchup-"));
const dbFile = join(tmp, "catchup.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.PK_ENVIRONMENT = "test";
Object.assign(process.env, { NODE_ENV: "test" });

execFileSync(
  process.execPath,
  [join("node_modules", "prisma", "build", "index.js"), "db", "push", `--url=file:${dbFile}`],
  { stdio: "pipe" },
);

const { parseCatchupIntake, simpleEligibleFromScreening } = await import(
  "../src/lib/tax/catchup-intake"
);
const { screenCatchupYears } = await import("@/content/catchup-1040");
const { prisma } = await import("@/lib/prisma");

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Synthetic Test Lead",
    email: "synthetic.lead@example.com",
    phone: "555 201 8890",
    contactMethod: "email",
    contactTime: "weekday_evening",
    taxYears: ["2024", "2025"],
    filingStatuses: { 2024: "single", 2025: "married_jointly" },
    alreadyFiled: { 2024: "no", 2025: "no" },
    complexity: ["w2"],
    notes: "",
    states: ["TX"],
    hasNotices: false,
    recordsStatus: "ready",
    consent: true,
    website: "",
    ...overrides,
  };
}

test("valid submission parses and normalizes", () => {
  const result = parseCatchupIntake(validBody());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.payload.email, "synthetic.lead@example.com");
  assert.equal(result.payload.contactTime, "weekday_evening");
  assert.equal(result.payload.recordsStatus, "ready");
  assert.deepEqual(result.payload.taxYears, ["2024", "2025"]);
  assert.equal(result.screening.length, 2);
  assert.equal(result.screening.every((s) => s.simpleEligible), true);
});

test("missing consent is rejected", () => {
  const result = parseCatchupIntake(validBody({ consent: false }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /checkbox/);
});

test("no tax years is rejected", () => {
  const result = parseCatchupIntake(validBody({ taxYears: [] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /tax year/i);
});

test("unknown year values are filtered out", () => {
  const result = parseCatchupIntake(validBody({ taxYears: ["2022", "2024"] }));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.payload.taxYears, ["2024"]);
});

test("phone contact without a valid phone is rejected", () => {
  const result = parseCatchupIntake(validBody({ contactMethod: "phone", phone: "123" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /phone/i);
});

test("SSN typed into notes is rejected before persistence", () => {
  const result = parseCatchupIntake(
    validBody({ notes: "my ssn is 123-45-6789 please hold it" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /sensitive/i);
});

test("tax document keyword in notes is rejected", () => {
  const result = parseCatchupIntake(validBody({ notes: "I have attached my w2" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /sensitive/i);
});

test("honeypot fill returns the honeypot result", () => {
  const result = parseCatchupIntake(validBody({ website: "http://spam.example" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.honeypot, true);
});

test("filing status must come from the allowlist per year", () => {
  const result = parseCatchupIntake(
    validBody({ filingStatuses: { 2024: "bogus", 2025: "single" } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /filing status for 2024/);
});

test("eligibility screen: other income types disqualify", () => {
  const screening = screenCatchupYears({
    complexity: ["w2", "rental"],
    hasNotices: false,
    years: [{ year: "2024", filingStatus: "single", alreadyFiled: "no" }],
  });
  assert.equal(screening[0].simpleEligible, false);
  assert.equal(simpleEligibleFromScreening(screening), false);
});

test("eligibility screen: notices disqualify", () => {
  const screening = screenCatchupYears({
    complexity: ["w2"],
    hasNotices: true,
    years: [{ year: "2023", filingStatus: "single", alreadyFiled: "no" }],
  });
  assert.equal(screening[0].simpleEligible, false);
});

test("eligibility screen: already-filed and unknown statuses disqualify", () => {
  const filed = screenCatchupYears({
    complexity: ["w2"],
    hasNotices: false,
    years: [{ year: "2023", filingStatus: "single", alreadyFiled: "yes" }],
  });
  assert.equal(filed[0].simpleEligible, false);
  const unknown = screenCatchupYears({
    complexity: ["w2"],
    hasNotices: false,
    years: [{ year: "2023", filingStatus: "unknown", alreadyFiled: "no" }],
  });
  assert.equal(unknown[0].simpleEligible, false);
  const separated = screenCatchupYears({
    complexity: ["w2"],
    hasNotices: false,
    years: [{ year: "2023", filingStatus: "married_separately", alreadyFiled: "no" }],
  });
  assert.equal(separated[0].simpleEligible, false);
});

test("per-year eligibility is independent", () => {
  const screening = screenCatchupYears({
    complexity: ["w2"],
    hasNotices: false,
    years: [
      { year: "2023", filingStatus: "single", alreadyFiled: "yes" },
      { year: "2024", filingStatus: "single", alreadyFiled: "no" },
    ],
  });
  assert.equal(screening[0].simpleEligible, false);
  assert.equal(screening[1].simpleEligible, true);
  assert.equal(simpleEligibleFromScreening(screening), false);
});

test("submission persists with ciphertext-free plain fields and status pipeline default", async () => {
  const parsed = parseCatchupIntake(validBody());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const created = await prisma.taxCatchupIntake.create({
    data: {
      fullName: parsed.payload.fullName,
      email: parsed.payload.email,
      phone: parsed.payload.phone,
      contactMethod: parsed.payload.contactMethod,
      contactTime: parsed.payload.contactTime,
      taxYears: JSON.stringify(parsed.payload.taxYears),
      filingStatuses: JSON.stringify(parsed.payload.filingStatuses),
      alreadyFiled: JSON.stringify(parsed.payload.alreadyFiled),
      complexity: JSON.stringify(parsed.payload.complexity),
      notes: parsed.payload.notes,
      states: JSON.stringify(parsed.payload.states),
      hasNotices: parsed.payload.hasNotices,
      recordsStatus: parsed.payload.recordsStatus,
      simpleEligible: simpleEligibleFromScreening(parsed.screening),
    },
  });
  assert.ok(created.id);
  assert.equal(created.status, "NEW_LEAD");
  const stored = await prisma.taxCatchupIntake.findUnique({ where: { id: created.id } });
  assert.ok(stored);
  assert.deepEqual(JSON.parse(stored.taxYears), ["2024", "2025"]);
  assert.equal(JSON.parse(stored.filingStatuses)[2024], "single");
  assert.equal(stored.simpleEligible, true);

  // Pipeline transition like the admin PATCH applies.
  const updated = await prisma.taxCatchupIntake.update({
    where: { id: created.id },
    data: { status: "QUOTE_SENT" },
  });
  assert.equal(updated.status, "QUOTE_SENT");
});

test("rate-limit counting queries behave on the temp store", async () => {
  const count = await prisma.taxCatchupIntake.count({
    where: { email: "synthetic.lead@example.com", createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  assert.equal(count, 1);
});

test("cleanup", async () => {
  await prisma.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});
