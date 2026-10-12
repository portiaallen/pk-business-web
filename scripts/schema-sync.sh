#!/bin/bash
# Deploy-time additive-only schema sync. Builds the current-schema DDL into a
# throwaway local sqlite, then syncs ONLY missing tables/columns/indexes to the
# hosted database. Never destructive: unsafe drift fails the build instead of
# being applied. See scripts/schema-sync.mjs for the guarantees.
OUT="public/diag-schema-sync-1012.txt"
if [ -z "$DATABASE_URL" ]; then
  echo "schema-sync: no DATABASE_URL in build environment, skipping"
  exit 0
fi
rm -f /tmp/schema-target.db
if ! npx prisma db push --url="file:/tmp/schema-target.db" > /tmp/pushlog 2>&1; then
  sed -E 's/authToken=[^&"]+/authToken=REDACTED/g' /tmp/pushlog | tee "$OUT"
  echo "schema-sync: could not build target schema"
  exit 1
fi
TARGET_DDL_DB=/tmp/schema-target.db node scripts/schema-sync.mjs 2>&1 | sed -E 's/authToken=[^&"]+/authToken=REDACTED/g' | tee "$OUT"
exit ${PIPESTATUS[0]}
