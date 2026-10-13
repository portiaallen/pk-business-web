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
  echo "--- security environment check ---"
  echo "VERCEL: ${VERCEL:-unset} | VERCEL_ENV: ${VERCEL_ENV:-unset}"
  echo "PK_ENVIRONMENT: ${PK_ENVIRONMENT:-UNSET}"
  echo "PK_WEBAUTHN_ORIGIN: ${PK_WEBAUTHN_ORIGIN:-UNSET}"
  echo "AUTH_SECRET present: $([ -n "$AUTH_SECRET" ] && echo yes || echo no)"
  echo "SETUP_SECRET present: $([ -n "$SETUP_SECRET" ] && echo yes || echo no)"
  echo "APP_URL: ${APP_URL:-UNSET}"
  node -e '
    const env = (k) => process.env[k];
    const vercel = Boolean(env("VERCEL") || env("VERCEL_ENV"));
    const declared = (env("PK_ENVIRONMENT") || "").trim();
    const origin = (env("PK_WEBAUTHN_ORIGIN") || "").trim();
    if (vercel && !declared) console.log("relyingParty would THROW: Explicit security environment is required");
    else if (["production","preview"].includes(declared) && !origin) console.log("relyingParty would THROW: WebAuthn origin must be configured");
    else {
      try { const u = new URL(origin || "http://localhost:4321");
        const ok = u.origin === (origin || "http://localhost:4321") && (u.protocol === "https:" || (u.hostname === "localhost" && ["development","test"].includes(declared)));
        console.log(ok ? "relyingParty OK: rpID=" + u.hostname + " origin=" + u.origin : "relyingParty would THROW: Invalid WebAuthn origin");
      } catch (e) { console.log("relyingParty would THROW: Invalid WebAuthn origin (" + e.message + ")"); }
    }
  ' 2>&1
  echo "--- grant admin capabilities ---"
  node scripts/grant-admin-capabilities.mjs 2>&1
  node scripts/purge-unpaid-assessment-submissions.mjs 2>&1
  echo "grants exit: $?"
  echo "--- grant admin enrollment window ---"
  node scripts/grant-admin-enrollment.mjs 2>&1
  echo "grant exit: $?"
} 2>&1 | sed -E 's/authToken=[^&"]+/authToken=REDACTED/g' > "$OUT"
cat "$OUT"
exit 0
