// Additive-only schema sync for the hosted database.
// Never destructive: only CREATE TABLE for missing tables, ADD COLUMN for
// missing columns, CREATE INDEX for missing indexes. Destructive or unsafe
// drift is reported and fails the run instead of being applied.
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

try {
  const targetTables = await q(target, TABLES);
  const liveTables = new Map((await q(live, TABLES)).map(r => [r.name, r.sql]));
  let created = 0, added = 0, indexed = 0; const issues = [];

  for (const t of targetTables) {
    if (!liveTables.has(t.name)) {
      await live.execute({ sql: t.sql });
      console.log(`created table ${t.name}`); created++;
      continue;
    }
    const tcols = await q(target, `PRAGMA table_info("${t.name}")`);
    const lnames = new Set((await q(live, `PRAGMA table_info("${t.name}")`)).map(c => c.name));
    for (const col of tcols) {
      if (lnames.has(col.name)) continue;
      if (col.pk) { issues.push(`${t.name}.${col.name}: primary-key column missing, cannot add safely`); continue; }
      if (col.notnull && col.dflt_value == null) { issues.push(`${t.name}.${col.name}: NOT NULL without default, cannot add safely`); continue; }
      let ddl = `ALTER TABLE "${t.name}" ADD COLUMN "${col.name}" ${col.type}`;
      if (col.notnull) ddl += ` NOT NULL DEFAULT ${col.dflt_value}`;
      else if (col.dflt_value != null) ddl += ` DEFAULT ${col.dflt_value}`;
      await live.execute({ sql: ddl });
      console.log(`added column ${t.name}.${col.name}`); added++;
    }
  }

  const IDX = "SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name";
  const lIdx = new Set((await q(live, IDX)).map(r => r.name));
  for (const i of await q(target, IDX)) {
    if (!lIdx.has(i.name)) { await live.execute({ sql: i.sql }); console.log(`created index ${i.name}`); indexed++; }
  }

  console.log(`schema-sync complete: ${created} tables created, ${added} columns added, ${indexed} indexes created`);
  if (issues.length) {
    console.error("UNSAFE DRIFT left unchanged (needs a human):");
    for (const i of issues) console.error("  " + i);
    process.exit(1);
  }
  const post = new Set((await q(live, TABLES)).map(r => r.name));
  const missing = targetTables.filter(t => !post.has(t.name)).map(t => t.name);
  if (missing.length) { console.error("post-check failed, still missing: " + missing.join(", ")); process.exit(1); }
  console.log("post-check: all target tables present");
} catch (e) {
  console.error("schema-sync FAILED:", e.message);
  process.exit(1);
}
