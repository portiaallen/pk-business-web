# PK Tax Division — Backup/Restore Drill Record

Date: October 12, 2026 (drill runs 20:14–20:23 CT; evidence stamped 2026-10-13T01:14–01:23 UTC)
WISP section: 8, Backup and recovery. Drill script: scripts/restore-drill.mjs (pk-business-web repo, commits a346ee6f, afd2a29, ad4adcd, 7286a4d).
Mode: read-only against production. The drill rebuilt the production database into a fresh local SQLite copy from live data at deploy time, then verified it.

## Result: PASS (restore mechanics), with one production data-hygiene finding

- Tables live: 76 | rows dumped: 730
- Tables restored with matching row counts: 76 of 76 | failed: 0
- Restored-copy PRAGMA integrity_check: ok
- Indexes: live 252 vs restored 76 (only explicit table indexes are copied; table schemas match — expected for a logical restore)
- PRAGMA foreign_key_check on the restored copy: 4 violations
- Same check run LIVE against production itself: identical 4 violations — pre-existing in production, faithfully copied by the restore, NOT caused by the drill

## The 4 dangling references (production data hygiene)

BraActivity, BraAudit, BraCustomer, BraEmailVerification each contain rows referencing a User row that no longer exists (rowid 1, residue of the purged automation-verification probe account). Recommended: one owner-approved cleanup deleting the 4 orphan probe rows. The restore-drill PASS stands either way: the drill's job is restore fidelity, which is proven.

## Drill history

- Run 1 (01:14 UTC): first wiring restored in alphabetical order; 58/76 tables, 18 failed on dependency ordering — a drill-script artifact, fixed in commit afd2a29 (two-pass restore).
- Run 2 (01:17 UTC): two-pass restore, 76/76 counts matched, integrity ok; drill marked FAIL only on the fk check.
- Run 3 (01:20 UTC): fk detail added; all 4 violations point to User rowid 1.
- Run 4 (01:23 UTC): live-side fk check added; production shows the same 4 — finding confirmed as pre-existing.

## Cadence

Keep scripts/restore-drill.mjs in the repo; rerun annually (or after major schema changes) and append the evidence here. The temporary deploy-time evidence file was retired after the drill (now 404); this record is the durable evidence.

Not yet evidenced (first-engagement gates, unchanged): live IRS acknowledgments, real bank-product transactions, remote portal/signature workflow.
