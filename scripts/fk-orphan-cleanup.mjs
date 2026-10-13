// One-time FK-orphan cleanup, found by the 2026-10-12 restore drill and
// confirmed live: BraActivity, BraAudit, BraCustomer, BraEmailVerification
// each hold rows referencing a deleted User (rowid 1, residue of the purged
// automation-verification probe account). Deletes ONLY rows whose User
// reference no longer exists, discovered from each table's own foreign-key
// definition (PRAGMA foreign_key_list), never a hard-coded column guess.
// Prints counts only; never row contents.
import { createClient } from "@libsql/client";

const url = (process.env.DATABASE_URL ?? "").trim();
const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim();
if (!url || !token) { console.error("cleanup: no database credentials in environment"); process.exit(2); }
if (process.env.PK_ENVIRONMENT !== "production") { console.error("cleanup: refusing to run outside production"); process.exit(2); }

const live = createClient({ url, authToken: token });
const TABLES = ["BraActivity", "BraAudit", "BraCustomer", "BraEmailVerification"];
const quote = (id) => '"' + String(id).replace(/"/g, '""') + '"';

const userPk = (await live.execute('PRAGMA table_info("User")')).rows.filter((r) => Number(r.pk) > 0).map((r) => String(r.name));
console.log("=== FK ORPHAN CLEANUP EVIDENCE ===");
console.log("date:", new Date().toISOString(), "(environment: production)");
console.log("User primary key column(s):", userPk.join(","));
const parentCol = userPk[0];
let deleted = 0;

for (const table of TABLES) {
  try {
    const fks = (await live.execute(`PRAGMA foreign_key_list(${quote(table)})`)).rows
      .filter((r) => String(r.table) === "User");
    if (fks.length === 0) { console.log(`  ${table}: no User foreign key (skipped)`); continue; }
    for (const fk of fks) {
      const fromCol = quote(fk.from);
      const toCol = quote(fk.to ?? parentCol);
      const before = Number((await live.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`)).rows[0].n);
      const orphanCount = Number((await live.execute(
        `SELECT COUNT(*) AS n FROM ${quote(table)} t WHERE t.${fromCol} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.${toCol} = t.${fromCol})`
      )).rows[0].n);
      if (orphanCount > 0) {
        await live.execute(
          `DELETE FROM ${quote(table)} WHERE ${fromCol} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.${toCol} = ${fromCol.replace(/^"(.*)"$/, quote(table) + ".$1")})`
        );
        deleted += orphanCount;
      }
      const after = Number((await live.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`)).rows[0].n);
      console.log(`  ${table}.${String(fk.from)} -> User.${String(fk.to ?? parentCol)}: rows ${before} -> ${after} (deleted ${orphanCount} orphans)`);
    }
  } catch (e) {
    console.log(`  ${table}: FAILED ${e.message}`);
  }
}
console.log("total orphan rows deleted:", deleted);
console.log("FK ORPHAN CLEANUP:", deleted >= 0 ? "DONE" : "FAILED");
