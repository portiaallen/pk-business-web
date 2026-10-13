// Backup/restore drill (WISP section 8): proves the production database can be
// rebuilt from a fresh logical backup. READ-ONLY against production: it dumps
// every table into a brand-new local SQLite file (pass 1: schemas, pass 2:
// rows, foreign keys off during the rebuild), then verifies the restored copy
// (row counts per table, PRAGMA integrity_check, PRAGMA foreign_key_check)
// against the live counts. Never writes to the production database. Run
// manually for the annual WISP drill; evidence output holds counts/statuses
// only, never row data or credentials.
import { createClient } from "@libsql/client";

const url = (process.env.DATABASE_URL ?? "").trim();
const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim();
if (!url || !token) { console.error("drill: no database credentials in environment"); process.exit(2); }

const live = createClient({ url, authToken: token });
const RESTORE_DB = process.env.DRILL_RESTORE_DB ?? "file:/tmp/pk-restore-drill.db";
const restored = createClient({ url: RESTORE_DB });

const tables = (await live.execute(
  "SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '_libsql_%' ORDER BY name"
)).rows;

const quote = (id) => '"' + String(id).replace(/"/g, '""') + '"';
let tablesOk = 0, tablesFailed = 0, totalRows = 0;
const failures = [], perTable = [];
const plan = [];

// pass 1: schemas
for (const t of tables) {
  const name = String(t.name);
  try {
    const srcCount = Number((await live.execute(`SELECT COUNT(*) AS n FROM ${quote(name)}`)).rows[0].n);
    totalRows += srcCount;
    await restored.execute(`DROP TABLE IF EXISTS ${quote(name)}`);
    await restored.execute(String(t.sql));
    plan.push({ name, srcCount, cols: null });
  } catch (e) {
    tablesFailed++; failures.push(`${name}: SCHEMA FAILED ${e.message}`);
  }
}

// pass 2: rows (foreign keys deferred to the verification step)
await restored.execute("PRAGMA foreign_keys = OFF");
for (const { name, srcCount } of plan) {
  try {
    if (srcCount > 0) {
      const cols = (await live.execute(`PRAGMA table_info(${quote(name)})`)).rows.map((r) => String(r.name));
      const batchSize = 200;
      for (let offset = 0; offset < srcCount; offset += batchSize) {
        const rows = (await live.execute(`SELECT * FROM ${quote(name)} LIMIT ${batchSize} OFFSET ${offset}`)).rows;
        for (const row of rows) {
          await restored.execute({
            sql: `INSERT INTO ${quote(name)} (${cols.map(quote).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
            args: cols.map((c) => {
              const v = row[c];
              if (typeof v === "bigint") return Number(v);
              if (v instanceof Uint8Array) return Array.from(v);
              return v;
            }),
          });
        }
      }
    }
    const dstCount = Number((await restored.execute(`SELECT COUNT(*) AS n FROM ${quote(name)}`)).rows[0].n);
    if (dstCount !== srcCount) throw new Error(`count mismatch ${srcCount} -> ${dstCount}`);
    perTable.push(`${name}: ${srcCount} rows restored+verified`);
    tablesOk++;
  } catch (e) {
    tablesFailed++; failures.push(`${name}: RESTORE FAILED ${e.message}`);
  }
}

const integrity = String((await restored.execute("PRAGMA integrity_check")).rows[0].integrity_check ?? "unknown");
const fkRows = (await restored.execute("PRAGMA foreign_key_check")).rows;
const fkViolations = fkRows.length;
for (const v of fkRows) console.log("  ~ fk violation in", String(v.table), "->", String(v.parent), "rowid", String(v.rowid));
const idxLive = Number((await live.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='index'")).rows[0].n);
const idxRestored = Number((await restored.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='index'")).rows[0].n);

console.log("=== RESTORE DRILL EVIDENCE ===");
console.log("date:", new Date().toISOString());
console.log("source: (host and token redacted)");
console.log("tables live:", tables.length);
console.log("rows dumped:", totalRows);
console.log("tables restored+verified:", tablesOk, "| failed:", tablesFailed);
console.log("indexes live:", idxLive, "| indexes in restored copy:", idxRestored);
console.log("restored-copy integrity_check:", integrity);
console.log("restored-copy foreign_key_check violations:", fkViolations);
for (const line of perTable) console.log(" ", line);
for (const line of failures) console.log("  !", line);
const pass = tablesFailed === 0 && integrity === "ok" && fkViolations === 0;
console.log("RESTORE DRILL:", pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
