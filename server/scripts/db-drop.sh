#!/usr/bin/env bash
# Drop FlightOne local database (role kept). Usage: npm run db:drop
set -euo pipefail

DB_NAME="${FLIGHT_DB_NAME:-flight_one}"
ADMIN_URL="${FLIGHT_DB_ADMIN_URL:-postgresql:///postgres}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
SQL

echo "Dropped database ${DB_NAME} (if it existed)"
