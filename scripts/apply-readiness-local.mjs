// Forward-only migration runner for disposable LOCAL files. Never deploys or alters a remote database.
import Database from "better-sqlite3";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const target = process.argv[2];
if (
  !target ||
  process.env.PK_ALLOW_SCHEMA_CHANGE !== "true" ||
  process.env.NODE_ENV === "production" ||
  process.env.NETLIFY ||
  process.env.VERCEL ||
  !["test", "development"].includes(process.env.PK_ENVIRONMENT || "")
)
  throw Error("EXPLICIT_LOCAL_SCHEMA_ACTION_REQUIRED");
const path = resolve(target);
if (!existsSync(path)) throw Error("EXISTING_LOCAL_DATABASE_REQUIRED");
const db = new Database(path);
const migration =
  process.argv[3] === "--recovery" ? "readiness-recovery-v1" : "readiness-v1";
const sql = readFileSync(
  new URL(`../prisma/readiness-migrations/${migration}.sql`, import.meta.url),
  "utf8",
);
const digest = createHash("sha256").update(sql).digest("hex");
try {
  db.exec(
    "CREATE TABLE IF NOT EXISTS PKFeatureMigration(name TEXT PRIMARY KEY,digest TEXT NOT NULL,appliedAt TEXT NOT NULL)",
  );
  const previous = db
    .prepare("SELECT digest FROM PKFeatureMigration WHERE name=?")
    .get(migration);
  if (previous) {
    if (previous.digest !== digest) throw Error("MIGRATION_DIGEST_CHANGED");
    console.log("Readiness migration already applied; digest verified.");
  } else {
    await db.backup(path + ".before-readiness-" + Date.now() + ".sqlite");
    db.transaction(() => {
      db.exec(sql);
      if (db.prepare("PRAGMA foreign_key_check").all().length)
        throw Error("FOREIGN_KEY_CHECK_FAILED");
      if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
        throw Error("INTEGRITY_CHECK_FAILED");
      db.prepare("INSERT INTO PKFeatureMigration VALUES(?,?,?)").run(
        migration,
        digest,
        new Date().toISOString(),
      );
    })();
    console.log(
      "Forward local Readiness migration applied; backup and integrity checks complete.",
    );
  }
} finally {
  db.close();
}
