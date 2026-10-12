// Additive-only schema sync for the hosted database.
// Never destructive: only CREATE TABLE for missing tables, ADD COLUMN for
// missing columns, CREATE INDEX for missing indexes. Destructive or unsafe
// drift is reported and fails the run instead of being applied.
// SQLite refuses ALTER TABLE ADD COLUMN with a CURRENT_* or parenthesized
// default, so non-literal defaults are dropped from the DDL: the Prisma client
// generates those values on insert anyway, so application behavior is
// unchanged. Per-statement errors are collected and reported, not fatal; the
// final post-check (all target tables AND columns present) is what fails the run.
import { createClient } from "@libsql/client";

const targetDbUrl = (process.env.TARGET_DDL_DB ?? "").trim().replace(/^["']|["']$/g, "");
if (!targetDbUrl) { console.error("schema-sync: TARGET_DDL_DB not set"); process.exit(1); }

const liveUrl = process.env.SYNC_TARGET_URL || (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
if (!liveUrl) { console.error("schema-sync: no live database URL"); process.exit(1); }
const liveOpts = { url: liveUrl.startsWith("file:") || liveUrl.includes(":") ? liveUrl : "file:" + liveUrl };
if (liveUrl.startsWith("libsql:")) {
  const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim().replace(/^["']|["']$/g, "");
  if (token) liveOpts.authToken = token;
}

const target = createClient({ url: targetDbUrl.startsWith("file:") || targetDbUrl.includes(":") ? targetDbUrl : "file:" + targetDbUrl });
const live = createClient(liveOpts);
const q = (c, sql) => c.execute(sql).then(r => r.rows);
const TABLES = "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name";
// Defaults safe to inline in ADD COLUMN: numeric literals, quoted strings, NULL/TRUE/FALSE.
const isSafeLiteral = (d) => /^-?\d+(\.\d+)?$/.test(d) || /^'.*'$/.test(d) || /^(TRUE|FALSE|NULL)$/i.test(d.trim());

try {
  const targetTables = await q(target, TABLES);
  const liveTables = new Map((await q(live, TABLES)).map(r => [r.name, r.sql]));
  let created = 0, added = 0, indexed = 0;
  const issues = [], errors = [];

  for (const t of targetTables) {
    if (!liveTables.has(t.name)) {
      try {
        await live.execute({ sql: t.sql });
        console.log(`created table ${t.name}`); created++;
      } catch (e) { errors.push(`create table ${t.name}: ${e.message}`); }
      continue;
    }
    const tcols = await q(target, `PRAGMA table_info("${t.name}")`);
    const lnames = new Set((await q(live, `PRAGMA table_info("${t.name}")`)).map(c => c.name));
    for (const col of tcols) {
      if (lnames.has(col.name)) continue;
      if (col.pk) { issues.push(`${t.name}.${col.name}: primary-key column missing, cannot add safely`); continue; }
      if (col.notnull && col.dflt_value == null) { issues.push(`${t.name}.${col.name}: NOT NULL without default, cannot add safely`); continue; }
      const dflt = col.dflt_value == null ? null : String(col.dflt_value);
      let ddl = `ALTER TABLE "${t.name}" ADD COLUMN "${col.name}" ${col.type}`;
      if (dflt != null) {
        if (isSafeLiteral(dflt)) ddl += ` DEFAULT ${dflt}`;
        else console.log(`note: ${t.name}.${col.name}: default ${dflt} is not a constant literal, adding column without it (application supplies the value)`);
      }
      try {
        await live.execute({ sql: ddl });
        console.log(`added column ${t.name}.${col.name}`); added++;
      } catch (e) { errors.push(`add column ${t.name}.${col.name}: ${e.message}`); }
    }
    const tidx = await q(target, `SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name = '${t.name}'`);
    const lidx = new Set((await q(live, `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = '${t.name}'`)).map(r => r.name));
    for (const ix of tidx) {
      if (lidx.has(ix.name)) continue;
      try {
        await live.execute({ sql: ix.sql });
        console.log(`created index ${ix.name}`); indexed++;
      } catch (e) { errors.push(`create index ${ix.name}: ${e.message}`); }
    }
  }

  if (issues.length) { console.error("UNSAFE DRIFT (not applied):"); issues.forEach(i => console.error("  - " + i)); }
  if (errors.length) { console.error("statement errors:"); errors.forEach(e => console.error("  - " + e)); }
  console.log(`summary: created ${created} tables, added ${added} columns, created ${indexed} indexes`);

  const post = new Set((await q(live, TABLES)).map(r => r.name));
  const missingTables = targetTables.filter(t => !post.has(t.name)).map(t => t.name);
  if (missingTables.length) { console.error("post-check failed, still missing tables: " + missingTables.join(", ")); process.exit(1); }
  for (const t of targetTables) {
    const want = new Set((await q(target, `PRAGMA table_info("${t.name}")`)).map(c => c.name));
    const got = new Set((await q(live, `PRAGMA table_info("${t.name}")`)).map(c => c.name));
    const missingCols = [...want].filter(c => !got.has(c));
    if (missingCols.length) { console.error(`post-check failed, ${t.name} still missing columns: ` + missingCols.join(", ")); process.exit(1); }
  }
  console.log("post-check: all target tables and columns present");
} catch (e) {
  console.error("schema-sync FAILED:", e.message);
  process.exit(1);
}
