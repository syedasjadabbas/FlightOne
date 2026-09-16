#!/usr/bin/env bash
# Migration hygiene check for FlightOne server.
#
# Run this after touching anything under prisma/migrations/ (especially after
# hand-editing a migration.sql, like the 2026-07-23 knowledge-migration trim —
# see docs/MIGRATION_NOTES.md) and before merging, to catch the class of bug
# that motivated this script: a migration re-creating a type/table that
# another, earlier migration already owns, which breaks `prisma migrate
# deploy` shadow-DB replay on a brand-new database even though it's invisible
# on an already-applied dev DB.
#
# Usage: npm run db:verify-migrations   (or) bash scripts/verify-migrations.sh
#
# What it does:
#   1. `npx prisma validate`      — schema.prisma + all *.prisma files parse
#                                    and are internally consistent.
#   2. Duplicate-CREATE-TYPE scan — greps every migration.sql for
#                                    `CREATE TYPE "Foo"` and fails if the same
#                                    enum name is created in more than one
#                                    migration (the exact bug this script
#                                    exists to catch; checks EscalationStatus
#                                    specifically per the 2026-07-23 incident,
#                                    plus a general scan across all enums).
#   3. Duplicate-CREATE-TABLE scan — same idea, for tables.
#
# What it deliberately does NOT do:
#   - It does NOT spin up a temporary shadow database and replay migrations
#     end-to-end here. The real, authoritative fresh-install check is:
#
#       createdb flight_one_fresh_check
#       DATABASE_URL="postgresql://flight:flight@localhost:5432/flight_one_fresh_check?schema=public" \
#         npx prisma migrate deploy
#       dropdb flight_one_fresh_check
#
#     (or the docker-compose equivalent — see README.md "Verifying a fresh
#     install"). That requires a live Postgres server, which this script does
#     not assume is available (e.g. in a plain lint/CI step), so it's kept as
#     a documented manual/CI step rather than baked in here. `db:setup` in
#     package.json already runs `prisma migrate deploy` against whatever
#     DATABASE_URL points at, so pointing that at a scratch DB IS the fresh
#     deploy test.
set -euo pipefail

cd "$(dirname "$0")/.."

MIGRATIONS_DIR="prisma/migrations"
FAILED=0

echo "==> [1/3] npx prisma validate"
npx prisma validate

echo
echo "==> [2/3] Fresh-deploy reminder"
echo "    This script does not create a scratch database itself. To verify a"
echo "    truly fresh install replays cleanly, run:"
echo '      createdb flight_one_fresh_check && \'
echo '      DATABASE_URL="postgresql://flight:flight@localhost:5432/flight_one_fresh_check?schema=public" npx prisma migrate deploy && \'
echo '      dropdb flight_one_fresh_check'
echo "    (or use docker-compose.yml to spin up a disposable Postgres — see README.md)."

echo
echo "==> [3/3] Duplicate CREATE TYPE / CREATE TABLE scan across migration.sql files"

check_duplicates () {
  local kind="$1" # "TYPE" or "TABLE"
  local pattern="CREATE ${kind} \"([A-Za-z0-9_]+)\""

  # name -> list of files, via a temp file (portable, no assoc arrays needed).
  local tmp
  tmp="$(mktemp)"
  # shellcheck disable=SC2044
  for f in $(find "$MIGRATIONS_DIR" -name migration.sql | sort); do
    matches="$(grep -oE "$pattern" "$f" | sed -E "s/CREATE ${kind} \"([A-Za-z0-9_]+)\"/\1/" || true)"
    [ -z "$matches" ] && continue
    while IFS= read -r name; do
      [ -z "$name" ] && continue
      echo "${name}|${f}" >>"$tmp"
    done <<<"$matches"
  done

  local dupes
  dupes="$(cut -d'|' -f1 "$tmp" 2>/dev/null | sort | uniq -d || true)"

  if [ -n "$dupes" ]; then
    echo "  !! Duplicate CREATE ${kind} name(s) found across multiple migrations:"
    while read -r name; do
      [ -z "$name" ] && continue
      echo "     - \"${name}\" defined in:"
      grep "^${name}|" "$tmp" | cut -d'|' -f2 | sed 's/^/         /'
    done <<<"$dupes"
    FAILED=1
  else
    echo "  OK — no duplicate CREATE ${kind} names across migration.sql files."
  fi

  rm -f "$tmp"
}

check_duplicates "TYPE"
check_duplicates "TABLE"

# Explicit named check for the exact regression this script was written for
# (kept in addition to the general scan above, so it fails loudly with a
# specific message even if the general scan's output format ever changes).
ESCALATION_STATUS_FILES=$(grep -rl 'CREATE TYPE "EscalationStatus"' "$MIGRATIONS_DIR"/*/migration.sql || true)
ESCALATION_STATUS_COUNT=0
if [ -n "$ESCALATION_STATUS_FILES" ]; then
  ESCALATION_STATUS_COUNT=$(printf '%s\n' "$ESCALATION_STATUS_FILES" | grep -c .)
fi
if [ "$ESCALATION_STATUS_COUNT" -gt 1 ]; then
  echo "  !! CREATE TYPE \"EscalationStatus\" found in ${ESCALATION_STATUS_COUNT} migrations (expected exactly 1):"
  printf '%s\n' "$ESCALATION_STATUS_FILES" | sed 's/^/       /'
  FAILED=1
fi

echo
if [ "$FAILED" -ne 0 ]; then
  echo "verify-migrations: FAILED"
  exit 1
fi

echo "verify-migrations: OK"
