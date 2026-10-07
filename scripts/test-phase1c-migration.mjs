// Additive migration test against accepted Phase 1B schema; never connects to a deployed database.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
const directory = mkdtempSync(
  join(tmpdir(), "pk-phase1c-migration-synthetic-"),
);
let sqlite;
try {
  const schema = join(directory, "baseline.prisma");
  writeFileSync(
    schema,
    execFileSync("git", [
      "show",
      "ba7a0f12db3f8b50201e693090c01291786cba36:prisma/schema.prisma",
    ]),
  );
  const sql = execFileSync(
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
  sqlite = new Database(join(directory, "synthetic.db"));
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(sql);
  sqlite.exec(`INSERT INTO User (id,email,name,passwordHash,role,securityVersion,updatedAt) VALUES ('synthetic','synthetic@example.test','Synthetic','synthetic-only','STAFF',7,CURRENT_TIMESTAMP);
    INSERT INTO Client (id,name,updatedAt) VALUES ('synthetic-client','Synthetic',CURRENT_TIMESTAMP);
    INSERT INTO Service (id,slug,name,shortName,description,shortDescription,priceDisplay,updatedAt) VALUES ('synthetic-service','synthetic','Synthetic','Synthetic','Synthetic','Synthetic','$1',CURRENT_TIMESTAMP);
    INSERT INTO VerificationRequest (id,clientId,serviceId,requestType,updatedAt) VALUES ('synthetic-request','synthetic-client','synthetic-service','Synthetic',CURRENT_TIMESTAMP);
    INSERT INTO Document (id,requestId,category,fileName,mimeType,fileSizeBytes,storageKey,updatedAt) VALUES ('ordinary','synthetic-request','OTHER','synthetic.txt','text/plain',1,'synthetic',CURRENT_TIMESTAMP);`);
  const before = sqlite.prepare("SELECT * FROM Document").all();
  const migration = readFileSync(
    "prisma/security-migrations/phase1c.sql",
    "utf8",
  );
  assert.doesNotMatch(
    migration,
    /DROP TABLE|DELETE FROM|UPDATE "(?:User|Session|Document|Client)"/,
  );
  sqlite.exec(migration);
  assert.deepEqual(sqlite.prepare("SELECT * FROM Document").all(), before);
  assert.equal(
    sqlite.prepare("SELECT securityVersion FROM User").get().securityVersion,
    7,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) AS n FROM VaultDocument").get().n,
    0,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) AS n FROM VaultRetentionPolicy").get().n,
    0,
  );
  assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  console.log(
    "6 additive synthetic migration checks passed; baseline documents/security preserved; no deployed database touched.",
  );
} finally {
  sqlite?.close();
  rmSync(directory, { recursive: true, force: true });
}
