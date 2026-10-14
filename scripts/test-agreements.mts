// Disposable local data, synthetic transport only. No real charge or client data.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
const root = mkdtempSync(join(tmpdir(), "pk-agreements-"));
for (const key of [
  "NETLIFY",
  "CONTEXT",
  "VERCEL",
  "VERCEL_ENV",
  "TURSO_DATABASE_URL",
  "DATABASE_AUTH_TOKEN",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
])
  delete process.env[key];
Object.assign(process.env, {
  NODE_ENV: "test",
  PK_ENVIRONMENT: "test",
  PK_AUTH_ENVIRONMENT: "test",
  AUTH_SECRET: "agreements-synthetic-only-not-credential",
  PK_ALLOW_SYNTHETIC_SETUP: "true",
  PK_READINESS_ENABLED: "true",
  PK_READINESS_MAIL_MODE: "synthetic",
  PK_STRIPE_ENVIRONMENT: "test",
  DATABASE_URL: `file:${join(root, "test.db")}`,
});
let ddl: string;
try {
  ddl = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (e) {
  const err = e as { stderr?: unknown };
  console.error("migrate diff failed:", err.stderr);
  throw e;
}
const sqlite = new Database(join(root, "test.db"));
sqlite.exec(ddl);
execFileSync("npx", ["tsx", "scripts/seed-agreements.ts"], { stdio: "inherit" });
const { prisma } = await import("../src/lib/prisma");
const ag = await import("../src/lib/agreements");

after(async () => {
  await prisma.$disconnect();
  sqlite.close();
  rmSync(root, { recursive: true, force: true });
});

test("approved assessment policy is published and served; drafts are parked unpublished", async () => {
  const bundle = await ag.getPublishedBundle(prisma, ag.SERVICE_KEYS.READINESS_ASSESSMENT);
  assert.equal(bundle.policies.length, 1, "only the approved assessment policy is published");
  assert.equal(bundle.policies[0].docKey, "ASSESSMENT_REFUND_POLICY");
  assert.equal(bundle.policies[0].version, "v1.0");
  assert.ok(ag.isPublished(bundle.policies[0]));
  // The readiness service has no published service agreement yet (draft pending Founder approval).
  assert.equal(bundle.agreement, null);

  const drafts = await ag.getDraftSummaries(prisma);
  const keys = drafts.map((d) => d.docKey).sort();
  assert.deepEqual(keys, [
    "ASSESSMENT_SERVICE_AGREEMENT",
    "GENERAL_SERVICES_REFUND_POLICY",
    "GENERAL_SERVICE_AGREEMENT",
    "TAX_DIVISION_REFUND_POLICY",
    "TAX_SERVICE_AGREEMENT",
  ]);
  // Draft summaries never leak body text.
  for (const d of drafts) assert.equal("body" in (d as object), false);
});

test("draft refund policies are never served to any service bundle", async () => {
  for (const key of [ag.SERVICE_KEYS.TAX_PREPARATION, ag.SERVICE_KEYS.GENERAL_SERVICES]) {
    const bundle = await ag.getPublishedBundle(prisma, key);
    assert.equal(bundle.policies.length, 0, `no effective policy for ${key}`);
    assert.equal(bundle.agreement, null);
  }
});

test("recordAcceptance refuses a draft policy and never writes an acceptance", async () => {
  await assert.rejects(
    () =>
      ag.recordAcceptance(prisma, {
        subjectType: ag.SUBJECT_TYPES.TAX_ENGAGEMENT,
        subjectId: "synthetic-engagement-1",
        clientName: "Synthetic Client",
        clientEmail: "synthetic.client@example.test",
        signatureName: "Synthetic Client",
        policyDocKey: "TAX_DIVISION_REFUND_POLICY",
        policyDocVersion: "v1.0",
        acknowledgmentText: "I agree to the draft",
      }),
    /REFUND_POLICY_NOT_EFFECTIVE/,
  );
  assert.equal(
    await prisma.agreementAcceptance.count({ where: { subjectId: "synthetic-engagement-1" } }),
    0,
  );
  assert.equal(
    await prisma.auditLog.count({ where: { resource: "TAX_ENGAGEMENT", resourceId: "synthetic-engagement-1" } }),
    0,
  );
});

test("recordAcceptance stores version, timestamp, signature, audit entry and event history", async () => {
  const syntheticActor = await prisma.user.create({
    data: {
      email: "actor@example.test",
      name: "Synthetic Actor",
      passwordHash: "synthetic-not-a-real-password",
    },
  });
  const acceptance = await ag.recordAcceptance(
    prisma,
    {
      subjectType: ag.SUBJECT_TYPES.READINESS_ASSESSMENT,
      subjectId: "synthetic-assessment-1",
      clientName: "Synthetic Client",
      clientEmail: "synthetic.client@example.test",
      signatureName: "Synthetic Client",
      policyDocKey: "ASSESSMENT_REFUND_POLICY",
      policyDocVersion: "v1.0",
      acknowledgmentText: ag.ASSESSMENT_ACKNOWLEDGMENT_TEXT,
    },
    { actorId: syntheticActor.id },
  );
  assert.ok(acceptance.createdAt instanceof Date);
  assert.equal(acceptance.policyDocVersion, "v1.0");
  assert.equal(acceptance.signatureName, "Synthetic Client");
  assert.equal(acceptance.acknowledgmentText, ag.ASSESSMENT_ACKNOWLEDGMENT_TEXT);
  const auditEntry = await prisma.auditLog.findFirstOrThrow({
    where: { action: "AGREEMENT_ACCEPTED", resourceId: "synthetic-assessment-1" },
  });
  assert.equal(auditEntry.actorId, syntheticActor.id);
  const parsed = JSON.parse(auditEntry.metadata) as Record<string, string>;
  assert.equal(parsed.policyDocKey, "ASSESSMENT_REFUND_POLICY");
  const events = await ag.eventHistory(
    prisma,
    ag.SUBJECT_TYPES.READINESS_ASSESSMENT,
    "synthetic-assessment-1",
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, ag.ACKNOWLEDGMENT_EVENTS.AGREEMENT_ACCEPTED);
});

test("late-document fee hook is configurable and non-automatic by configuration", () => {
  assert.equal(ag.LATE_DOCUMENT_FEE.CENTS, 500);
  assert.equal(ag.LATE_DOCUMENT_FEE.DISCRETIONARY, true);
  assert.equal(ag.LATE_DOCUMENT_FEE.REQUIRES_ADVANCE_NOTICE, true);
  assert.equal(ag.LATE_DOCUMENT_FEE.CONFIGURABLE, true);
});
