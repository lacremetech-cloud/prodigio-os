#!/usr/bin/env bash
# Rejoue TOUTES les migrations versionnées sur une base LOCALE vierge.
# Sert à valider une migration hors ligne, avant toute proposition.
# N'atteint jamais un projet distant : hôte, port et base sont locaux.
set -euo pipefail

export PGHOST="${PGHOST:-/var/run/postgresql}"
export PGPORT="${PGPORT:-55432}"
export PGUSER="${PGUSER:-postgres}"
DB="${DB:-prodigio}"

cd "$(dirname "$0")/.."

dropdb --if-exists "$DB"
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/local-schema-harness.sql >/dev/null

fail=0
for f in supabase/migrations/*.sql; do
  if err=$(psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 | grep -Ev '^(NOTICE|psql:.*NOTICE)' || true); [ -n "$err" ]; then
    echo "✗ $(basename "$f")"
    echo "$err" | head -20
    fail=1
    break
  else
    echo "✓ $(basename "$f")"
  fi
done
exit $fail
