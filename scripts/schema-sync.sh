#!/bin/bash
# Deploy-time additive-only schema sync (diagnostic mode).
# Builds the current-schema DDL into a throwaway local sqlite, then syncs ONLY
# missing tables/columns/indexes to the hosted database. Never destructive.
# THIS INCARNATION IS DIAGNOSTIC: it captures every step's full output to
# public/diag-schema-sync-1012.txt and NEVER fails the build, so a successful
# deploy always serves the diagnostics. The failing-step answer comes from the
# served file. Restore the strict exit-on-unsafe-drift behavior after diagnosis.
OUT="public/diag-schema-sync-1012.txt"
{
  echo "schema-sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "cwd: $(pwd)"
  echo "node: $(node -v)"
  echo "DATABASE_URL present: $([ -n "$DATABASE_URL" ] && echo yes || echo no)"
  echo "DATABASE_AUTH_TOKEN present: $([ -n "$DATABASE_AUTH_TOKEN" ] && echo yes || echo no)"
  echo "target: $(echo "$DATABASE_URL" | sed -E 's/authToken=[^&"]+/authToken=REDACTED/g')"
  echo "--- scripts dir ---"
  ls -la scripts/ 2>&1
  echo "--- @libsql/client import test ---"
  node -e "import('@libsql/client').then(() => console.log('client import OK')).catch(e => console.log('client import FAIL:', e.message))" 2>&1
  echo "--- target push (throwaway local db) ---"
  rm -f /tmp/schema-target.db
  npx prisma db push --url="file:/tmp/schema-target.db" 2>&1
  echo "push exit: $?"
  echo "--- sync against hosted db ---"
  TARGET_DDL_DB=/tmp/schema-target.db node scripts/schema-sync.mjs 2>&1
  echo "sync exit: $?"
  echo "--- grant admin enrollment window ---"
  node scripts/grant-admin-enrollment.mjs 2>&1
  echo "grant exit: $?"
} 2>&1 | sed -E 's/authToken=[^&"]+/authToken=REDACTED/g' > "$OUT"
cat "$OUT"
exit 0
