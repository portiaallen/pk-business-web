// Backup/restore drill (WISP section 8): proves the production database can be
// rebuilt from a fresh logical backup. READ-ONLY against production: it dumps
// every table's rows into a brand-new local SQLite file, then verifies the
// restored copy (row counts per table + PRAGMA integrity_check) against the
// live counts. Never writes to the production database. Run manually or wired
// into a deploy once; record the evidence in the PK security folder.
// Output contains counts and statuses only, never row data or credentials.
import { createClient } from "@libsql/client";

const url = (process.env.DATABASE_URL ?? "").trim();
const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim();
if (!url || !token) { console.error("drill: no database credentials in environment"); process.exit(2); }

const live = createClient({ url, authToken: token });
const RESTORE_DB = process.env.DRILL_RESTORE_DB ?? "file:/tmp/pk-restore-drill.db";
const restored = createClient({ url: RESTORE_DB });

const tables = (await live.execute(
  "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '_libsql_%'"
)).rows.map((r) => String(r.name)).sort();

const quote = (id) => '"' + id.replace(/"/g, '""') + '"';
let tablesOk = 0, tablesFailed = 0, totalRows = 0;
const failures = [];
const perTable = [];

for (const table of tables) {
  try {
    const cols = (await live.execute(`PRAGMA table_info(${quote(table)})`)).rows
      .map((r) => String(r.name));
    const srcCount = Number((await live.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`)).rows[0].n);
    totalRows += srcCount;

    if (srcCount > 0) {
      await restored.execute(`DROP TABLE IF EXISTS ${quote(table)}`);
      const createSql = String((await live.execute(
        "SELECT sql FROM sqlite_schema WHERE type='table' AND name = ?", [table]
      )).rows[0].sql);
      await restored.execute(createSql);
      const batchSize = 200;
      for (let offset = 0; offset < srcCount; offset += batchSize) {
        const rows = (await live.execute(`SELECT * FROM ${quote(table)} LIMIT ${batchSize} OFFSET ${offset}`)).rows;
        for (const row of rows) {
          const placeholders = cols.map(() => "?").join(",");
          await restored.execute({
            sql: `INSERT INTO ${quote(table)} (${cols.map(quote).join(",")}) VALUES (${placeholders})`,
            args: cols.map((c) => {
              const v = row[c];
              if (typeof v === "bigint") return Number(v);
              if (v instanceof Uint8Array) return Array.from(v);
              return v;
            }),
          });
        }
      }
    } else {
      // empty table: still verify the schema exists in the restore target
      await restored.execute(`DROP TABLE IF EXISTS ${quote(table)}`);
      const createSql = String((await live.execute(
        "SELECT sql FROM sqlite_schema WHERE type='table' AND name = ?", [table]
      )).rows[0].sql);
      await restored.execute(createSql);
    }

    const dstCount = Number((await restored.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`)).rows[0].n);
    if (dstCount !== srcCount) throw new Error(`count mismatch ${srcCount} -> ${dstCount}`);
    perTable.push(`${table}: ${srcCount} rows restored+verified`);
    tablesOk++;
  } catch (e) {
    tablesFailed++;
    failures.push(`${table}: FAILED ${e.message}`);
  }
}

const integrity = String((await restored.execute("PRAGMA integrity_check")).rows[0].integrity_check ?? "unknown");
const idxLive = Number((await live.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='index'")).rows[0].n);
const idxRestored = Number((await restored.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='index'")).rows[0].n);

console.log("=== RESTORE DRILL EVIDENCE ===");
console.log("date:", new Date().toISOString());
console.log("source:", url.replace(/libsql:\/\//, "libsql://[redacted-host]") , "(token redacted)");
console.log("tables live:", tables.length);
console.log("rows dumped:", totalRows);
console.log("tables restored+verified:", tablesOk, "| failed:", tablesFailed);
console.log("indexes live:", idxLive, "| indexes in restored copy:", idxRestored);
console.log("restored-copy integrity_check:", integrity);
for (const line of perTable) console.log(" ", line);
for (const line of failures) console.log("  !", line);
const pass = tablesFailed === 0 && integrity === "ok";
console.log("RESTORE DRILL:", pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
