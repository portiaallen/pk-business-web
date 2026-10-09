import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const root = mkdtempSync(join(tmpdir(), "pk-readiness-migration-"));
const schema = join(root, "baseline.prisma");
writeFileSync(
  schema,
  execFileSync("git", [
    "show",
    "cdbca2e5c1b41ab36c2c827962f7c4b274d19281:prisma/schema.prisma",
  ]),
);
const baseline = execFileSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema",
    schema,
    "--script",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
);
const env = {
  ...process.env,
  PK_ENVIRONMENT: "test",
  PK_ALLOW_SCHEMA_CHANGE: "true",
  NODE_ENV: "test",
};
for (const k of ["NETLIFY", "VERCEL", "CONTEXT", "VERCEL_ENV"]) delete env[k];
const run = (path, ...args) =>
  execFileSync(
    process.execPath,
    ["scripts/apply-readiness-local.mjs", path, ...args],
    {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
test("forward migration preserves ordinary notification rows; backup and replay verified", () => {
  const path = join(root, "good.db");
  let db = new Database(path);
  db.exec(baseline);
  db.prepare("INSERT INTO Notification(id,subject,body) VALUES(?,?,?)").run(
    "existing",
    "Synthetic ordinary notice",
    "Synthetic ordinary content",
  );
  db.close();
  run(path);
  run(path);
  db = new Database(path);
  assert.equal(
    db.prepare("SELECT body FROM Notification WHERE id=?").get("existing").body,
    "Synthetic ordinary content",
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM PKFeatureMigration").get().n,
    1,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'readiness_%'",
      )
      .get().n,
    6,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(
    readdirSync(root).filter((n) => n.includes("before-readiness")).length,
    1,
  );
  db.close();
});
test("migration error rolls back all feature tables; rejects hosted/automatic action", () => {
  const path = join(root, "bad.db");
  let db = new Database(path);
  db.exec(baseline);
  db.exec("DROP TABLE Notification");
  db.close();
  assert.throws(() => run(path));
  db = new Database(path);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM sqlite_master WHERE name='ReadinessAssessment'",
      )
      .get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM PKFeatureMigration").get().n,
    0,
  );
  db.close();
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ["scripts/apply-readiness-local.mjs", path],
      { env: { ...env, NETLIFY: "true" }, stdio: "ignore" },
    ),
  );
});
test("recovery addition preserves the base migration, triggers and data; replay is safe", () => {
  const path = join(root, "recovery.db");
  let db = new Database(path);
  db.exec(baseline);
  db.prepare("INSERT INTO Notification(id,subject,body) VALUES(?,?,?)").run(
    "preserved",
    "Synthetic",
    "Preserved",
  );
  db.close();
  run(path);
  db = new Database(path);
  db.exec(`
    INSERT INTO Client(id,name,updatedAt) VALUES('client','Synthetic',CURRENT_TIMESTAMP);
    INSERT INTO Service(id,slug,name,shortName,description,shortDescription,priceDisplay,updatedAt)
      VALUES('service','readiness-assessment','Synthetic','Synthetic','Synthetic','Synthetic','$99',CURRENT_TIMESTAMP);
    INSERT INTO VerificationRequest(id,clientId,serviceId,requestType,updatedAt)
      VALUES('request','client','service','READINESS_ASSESSMENT',CURRENT_TIMESTAMP);
    INSERT INTO IntakeSubmission(id,fullName,email,serviceSlug,description)
      VALUES('intake','Synthetic','synthetic@example.test','readiness-assessment','Synthetic');
    INSERT INTO Invoice(id,invoiceNumber,clientId,requestId,amountCents,status,updatedAt)
      VALUES('invoice','SYNTHETIC-1','client','request',9900,'PAID',CURRENT_TIMESTAMP);
    INSERT INTO Payment(id,clientId,invoiceId,requestId,amountCents,status,method,updatedAt)
      VALUES('payment','client','invoice','request',9900,'PAID','STRIPE',CURRENT_TIMESTAMP);
    INSERT INTO ReadinessAssessment(id,clientId,requestId,intakeSubmissionId,invoiceId,paymentId,paymentStatus,status,purchaseTokenHash,purchaseExpiresAt,updatedAt)
      VALUES('assessment','client','request','intake','invoice','payment','PAID','PAID','synthetic-hash',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO AuditLog(id,clientId,action,resource,resourceId,metadata)
      VALUES('audit','client','ADMIN_ACTION','readiness','assessment','{"action":"PAYMENT_VERIFIED"}');
  `);
  const assessmentBefore = db
    .prepare("SELECT * FROM ReadinessAssessment")
    .get();
  const paymentBefore = db.prepare("SELECT * FROM Payment").get();
  const auditBefore = db.prepare("SELECT * FROM AuditLog").get();
  db.close();
  run(path, "--recovery");
  run(path, "--recovery");
  db = new Database(path);
  assert.equal(
    db.prepare("SELECT count(*) n FROM PKFeatureMigration").get().n,
    2,
  );
  assert.equal(
    db.prepare("SELECT body FROM Notification WHERE id='preserved'").get().body,
    "Preserved",
  );
  const columns = db
    .prepare('PRAGMA table_info("ReadinessAssessment")')
    .all()
    .map((c) => c.name);
  assert.ok(columns.includes("recoveryCodeHash"));
  assert.ok(columns.includes("recoveryCodeExpiresAt"));
  const after = db.prepare("SELECT * FROM ReadinessAssessment").get();
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(assessmentBefore).map((key) => [key, after[key]]),
    ),
    assessmentBefore,
  );
  assert.equal(after.recoveryCodeHash, null);
  assert.equal(after.recoveryCodeExpiresAt, null);
  assert.deepEqual(db.prepare("SELECT * FROM Payment").get(), paymentBefore);
  assert.deepEqual(db.prepare("SELECT * FROM AuditLog").get(), auditBefore);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'readiness_%'",
      )
      .get().n,
    6,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});
test.after(() => rmSync(root, { recursive: true, force: true }));
