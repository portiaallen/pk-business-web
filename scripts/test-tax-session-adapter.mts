// Synthetic-only test battery for the PK Tax Division encrypted session
// storage adapter. No real taxpayer data; runs against a disposable temp
// SQLite database that is deleted after the run. Mirrors the storage policy:
// no SSN/ITIN/IP PIN/bank details may persist in any form.
// Run: npm run test:tax:adapter
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// Containment guard: this battery manages its own disposable synthetic
// database. It must never run with PK_CI_SYNTHETIC=1 (that mode forces the
// in-memory store) and never against a configured production database.
if ((process.env.PK_CI_SYNTHETIC ?? "").trim() === "1") {
  console.error("refusing to run: PK_CI_SYNTHETIC=1 forces the synthetic store");
  process.exit(1);
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")) {
  console.error("refusing to run: DATABASE_URL must point at a disposable file: database");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "pk-tax-adapter-"));
const dbFile = join(tmp, "sessions.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.PK_ENVIRONMENT = "test";
Object.assign(process.env, { NODE_ENV: "test" });
process.env.PK_SESSION_ENC_KEY = randomBytes(32).toString("hex");
process.env.PK_SESSION_ENC_KEY_VERSION = "1";

execFileSync(
  process.execPath,
  [join("node_modules", "prisma", "build", "index.js"), "db", "push", `--url=file:${dbFile}`],
  { stdio: "pipe" },
);

const { createSession, recordAnswer, compute } = await import("../src/lib/tax/onboarding-core");
const { rejectIfSensitive } = await import("../src/lib/tax/intake-screen");
const {
  encryptedTaxSessionStore,
  EncryptedSessionCorrupt,
  SensitiveSessionRejected,
  loadSessionEncryptionKey,
  SessionStoreMisconfigured,
} = await import("../src/lib/tax/encrypted-session-store");
const { resolveTaxSessionStore } = await import("../src/lib/tax/session-storage");
const { prisma } = await import("@/lib/prisma");

function freshSession(): ReturnType<typeof createSession> {
  const s = createSession(2026);
  recordAnswer(s, "dependents", "Yes");
  s.dependents = [{ label: "kidA", dob_year: 2015, relationship: "daughter" }];
  compute(s);
  return s;
}

test("selector: PK_CI_SYNTHETIC=1 forces the synthetic store", () => {
  const store = resolveTaxSessionStore({ PK_CI_SYNTHETIC: "1", PK_SESSION_ENC_KEY: "x" }, true);
  assert.equal(store.mode, "synthetic");
});

test("selector: misconfigured (no key) refuses fail-closed", () => {
  assert.throws(() => resolveTaxSessionStore({}, false), SessionStoreMisconfigured);
});

test("selector: key without configured database refuses fail-closed", () => {
  assert.throws(
    () => resolveTaxSessionStore({ PK_SESSION_ENC_KEY: randomBytes(32).toString("hex") }, false),
    SessionStoreMisconfigured,
  );
});

test("selector: key + configured database resolves the encrypted store", () => {
  const store = resolveTaxSessionStore(
    { PK_SESSION_ENC_KEY: randomBytes(32).toString("hex") },
    true,
  );
  assert.equal(store.mode, "encrypted");
});

test("key loader: rejects empty config and invalid key version", () => {
  assert.throws(() => loadSessionEncryptionKey({}), SessionStoreMisconfigured);
  assert.throws(
    () => loadSessionEncryptionKey({ PK_SESSION_ENC_KEY: "ab", PK_SESSION_ENC_KEY_VERSION: "0" }),
    SessionStoreMisconfigured,
  );
  const loaded = loadSessionEncryptionKey({ PK_SESSION_ENC_KEY: randomBytes(32).toString("hex") });
  assert.equal(loaded.key.length, 32);
});

test("encrypted round-trip: put then get returns the same session", async () => {
  const s = freshSession();
  await encryptedTaxSessionStore.put(s);
  const loaded = await encryptedTaxSessionStore.get(s.sessionId);
  assert.ok(loaded);
  assert.equal(loaded.sessionId, s.sessionId);
  assert.equal(loaded.taxYear, s.taxYear);
  assert.deepEqual(loaded.dependents, s.dependents);
  assert.deepEqual(loaded.checklist, s.checklist);
});

test("at-rest inspection: the persisted row is ciphertext only", async () => {
  const s = freshSession();
  await encryptedTaxSessionStore.put(s);
  const row = await prisma.taxOnboardingSession.findUnique({ where: { sessionId: s.sessionId } });
  assert.ok(row);
  const rawCiphertext = Buffer.from(row.ciphertext, "base64").toString("utf8");
  assert.ok(!rawCiphertext.includes("kidA"));
  assert.ok(!rawCiphertext.includes("daughter"));
  assert.ok(!rawCiphertext.includes("sessionId"));
  assert.throws(() => JSON.parse(rawCiphertext));
  // base64 columns only; no plaintext column exists on the model
  for (const value of [row.nonce, row.authTag, row.ciphertext]) {
    assert.equal(typeof value, "string");
    assert.match(value, /^[A-Za-z0-9+/=]+$/);
  }
});

test("tamper detection: a flipped ciphertext byte fails authentication", async () => {
  const s = freshSession();
  await encryptedTaxSessionStore.put(s);
  const row = await prisma.taxOnboardingSession.findUnique({ where: { sessionId: s.sessionId } });
  const tampered = Buffer.from(row!.ciphertext, "base64");
  tampered[0] ^= 0xff;
  await prisma.taxOnboardingSession.update({
    where: { sessionId: s.sessionId },
    data: { ciphertext: tampered.toString("base64") },
  });
  await assert.rejects(() => encryptedTaxSessionStore.get(s.sessionId), EncryptedSessionCorrupt);
});

test("key rotation: a row sealed under a different key version is refused", async () => {
  const s = freshSession();
  await encryptedTaxSessionStore.put(s);
  await prisma.taxOnboardingSession.update({
    where: { sessionId: s.sessionId },
    data: { keyVersion: (await import("../src/lib/tax/encrypted-session-store")).loadSessionEncryptionKey().keyVersion + 1 },
  });
  await assert.rejects(() => encryptedTaxSessionStore.get(s.sessionId), EncryptedSessionCorrupt);
});

test("storage policy: recordAnswer refuses sensitive keys upstream", async () => {
  const s = freshSession();
  recordAnswer(s, "taxpayer_ssn", "123-45-6789");
  assert.ok(!("taxpayer_ssn" in s.answers));
});

test("storage policy: a sensitive key present through any other path is rejected before persistence", async () => {
  const s = freshSession();
  // Simulate data that bypassed the route screening (a bug or another writer).
  (s.answers as Record<string, unknown>)["taxpayer_ssn"] = "123-45-6789";
  await assert.rejects(() => encryptedTaxSessionStore.put(s), SensitiveSessionRejected);
  const row = await prisma.taxOnboardingSession.findUnique({ where: { sessionId: s.sessionId } });
  assert.equal(row, null);
});

test("storage policy: an SSN-pattern value under a benign key is rejected before persistence", async () => {
  const s = freshSession();
  (s.answers as Record<string, unknown>)["notes"] = "SSN 123-45-6789 on file";
  await assert.rejects(() => encryptedTaxSessionStore.put(s), SensitiveSessionRejected);
  const row = await prisma.taxOnboardingSession.findUnique({ where: { sessionId: s.sessionId } });
  assert.equal(row, null);
});

test("delete and reset leave nothing behind", async () => {
  const a = freshSession();
  const b = freshSession();
  await encryptedTaxSessionStore.put(a);
  await encryptedTaxSessionStore.put(b);
  await encryptedTaxSessionStore.delete(a.sessionId);
  assert.equal(await encryptedTaxSessionStore.get(a.sessionId), null);
  assert.ok(await encryptedTaxSessionStore.get(b.sessionId));
  await encryptedTaxSessionStore.reset();
  assert.equal(await encryptedTaxSessionStore.get(b.sessionId), null);
  const rows = await prisma.taxOnboardingSession.findMany();
  assert.equal(rows.length, 0);
});

test.after(() => {
  rmSync(tmp, { recursive: true, force: true });
});
