#!/bin/bash
# Deploy-time additive-only schema sync (STRICT mode).
# Syncs ONLY missing tables/columns/indexes to the hosted database. Never
# destructive: unsafe drift (a missing PK column, or a NOT NULL column with
# no default) is left unapplied and FAILS the build. Any sync, bootstrap, or
# environment failure fails the build. No diagnostics are written to public/.
set -u
fail() { echo "schema-sync FAILED: $1" >&2; exit 1; }

# Security environment check first: a production/preview deploy without a
# valid WebAuthn relying-party configuration 500s on every sign-in.
node -e '
const env = (k) => process.env[k];
const vercel = Boolean(env("VERCEL") || env("VERCEL_ENV"));
const declared = (env("PK_ENVIRONMENT") || "").trim();
const origin = (env("PK_WEBAUTHN_ORIGIN") || "").trim();
const bad = (m) => { console.error("environment check FAILED: " + m); process.exit(1); };
if (vercel && !declared) bad("PK_ENVIRONMENT is required on Vercel");
if (["production","preview"].includes(declared) && !origin) bad("PK_WEBAUTHN_ORIGIN is required");
try {
  const u = new URL(origin || "http://localhost:4321");
  const ok = u.origin === (origin || "http://localhost:4321") && (u.protocol === "https:" || (u.hostname === "localhost" && ["development","test"].includes(declared)));
  if (!ok) bad("PK_WEBAUTHN_ORIGIN is not a valid https origin for this environment");
} catch { bad("PK_WEBAUTHN_ORIGIN is not a valid URL"); }
console.log("environment check OK: rpID=" + new URL(origin || "http://localhost:4321").hostname);
' || fail "security environment check failed"

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set"
[ -n "${DATABASE_AUTH_TOKEN:-}" ] || fail "DATABASE_AUTH_TOKEN is not set"

rm -f /tmp/schema-target.db
npx prisma db push --url="file:/tmp/schema-target.db" >/dev/null 2>&1 || fail "could not build the target schema (prisma db push failed)"

TARGET_DDL_DB=/tmp/schema-target.db node scripts/schema-sync.mjs || fail "schema sync failed or unsafe drift was left unapplied"

# The admin bootstrap seeds the sole ADMIN account's capability grants. It
# requires the hosted User table to contain that account, so a CI run against
# a disposable synthetic database (PK_CI_SYNTHETIC=1) skips it explicitly;
# every hosted build still runs it and still fails hard when it cannot.
if [ "${PK_CI_SYNTHETIC:-0}" = "1" ]; then
  echo "admin bootstrap skipped: CI synthetic database"
else
  node scripts/grant-admin-capabilities.mjs || fail "admin capability bootstrap failed"
  node scripts/grant-admin-enrollment.mjs || fail "admin enrollment bootstrap failed"
fi

echo "schema-sync OK"
