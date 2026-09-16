#!/usr/bin/env bash
# Create local Postgres role + database for FlightOne (Homebrew Postgres — no Docker).
# Usage: npm run db:create
set -euo pipefail

DB_NAME="${FLIGHT_DB_NAME:-flight_one}"
DB_USER="${FLIGHT_DB_USER:-flight}"
DB_PASS="${FLIGHT_DB_PASS:-flight}"
# Superuser connection for admin DDL (Homebrew default is your OS user, no password).
ADMIN_URL="${FLIGHT_DB_ADMIN_URL:-postgresql:///postgres}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' CREATEDB;
    RAISE NOTICE 'Created role %', '${DB_USER}';
  ELSE
    RAISE NOTICE 'Role % already exists', '${DB_USER}';
  END IF;
END
\$\$;
SQL

if psql "$ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "Database ${DB_NAME} already exists"
else
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "Created database ${DB_NAME} (owner ${DB_USER})"
fi

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
# Schema privileges (needed on Postgres 15+)
psql "postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" -v ON_ERROR_STOP=1 <<'SQL'
GRANT ALL ON SCHEMA public TO CURRENT_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO CURRENT_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO CURRENT_USER;
SQL

echo "OK — DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
