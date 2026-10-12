#!/bin/sh
# Non-destructive schema sync during deploy. Never destructive: prisma db push
# refuses destructive drift without --accept-data-loss, which we never pass.
if [ -z "$DATABASE_URL" ]; then
  exit 0
fi
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
npx prisma db push --url="$URL"
