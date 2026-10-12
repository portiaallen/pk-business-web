#!/bin/bash
# Deploy-time non-destructive schema sync with diagnostic capture.
# prisma db push is never run with --accept-data-loss: destructive drift
# fails loudly instead of silently altering the hosted database.
OUT="public/diag-schema-sync-1012.txt"
{
  echo "schema-sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "DATABASE_URL present: $([ -n "$DATABASE_URL" ] && echo yes || echo no)"
  echo "DATABASE_AUTH_TOKEN present: $([ -n "$DATABASE_AUTH_TOKEN" ] && echo yes || echo no)"
  if [ -z "$DATABASE_URL" ]; then
    echo "skipped: no DATABASE_URL in build environment"
  else
    URL="$DATABASE_URL"
    case "$URL" in
      *authToken=*) : ;;
      *)
        TOKEN=$(printf '%s' "$DATABASE_AUTH_TOKEN" | sed "s/^[\"']//;s/[\"']\$//")
        if [ -n "$TOKEN" ]; then
          case "$URL" in
            *\?*) URL="$URL&authToken=$TOKEN" ;;
            *) URL="$URL?authToken=$TOKEN" ;;
          esac
        fi
        ;;
    esac
    printf 'target: %s\n' "$(printf '%s' "$URL" | sed -E 's/authToken=[^&"]*/authToken=REDACTED/g')"
    npx prisma db push --url="$URL" 2>&1
    echo "push exit: ${PIPESTATUS[0]}"
  fi
} | sed -E 's/authToken=[^&"]*/authToken=REDACTED/g' > "$OUT" 2>&1
cat "$OUT"
exit 0
