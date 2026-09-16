# Pre-production checklist

Run through this before pointing a real deploy at production traffic. All commands assume
`cwd` is the repo root (`filght-one-server/`) with `DATABASE_URL` (and `DATABASE_URL_DIRECT`
if you're on PgBouncer) already set in the environment.

## 1. Migrate

Never use `prisma migrate dev` against a prod database — it can drop/reset data. Use the
deploy-only command, which just applies committed migrations:

```bash
npm run db:migrate:deploy
```

If you're behind PgBouncer in transaction mode, point `DATABASE_URL_DIRECT` at the direct
(non-pooled) port for this step — migrations need a real session, not a pooled one.

## 2. Seed

```bash
npm run db:seed
```

Idempotent — safe to re-run. It:
- Upserts the `Super Admin` role with every permission key any route currently checks
  (`requirePermission(...)` / `hasPermissionEff(...)` — verified against the seed list as
  part of this hardening pass; nothing referenced by a route is missing from the seed).
- Creates the bootstrap admin user only if `BOOTSTRAP_ADMIN_EMAIL` doesn't already exist.
- Upserts sample knowledge documents / visa requirements / pricing config by natural key —
  re-running never duplicates rows.

Set real `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_NAME` env
vars before the first prod seed run — don't ship the `.env.example` defaults.

## 3. Health / readiness

- `GET /api/v1/health` — **liveness**. No DB call; just "is the process up". Use for the
  container/process supervisor's restart probe.
- `GET /api/v1/health/ready` — **readiness**. Runs `SELECT 1` against Postgres; returns
  `200 {"success":true,...,"data":{"ok":true}}` when the DB connection is usable, or
  `503 {"success":false,...,"ok":false}` when it isn't. Use for the load balancer's
  "route traffic here" probe — a liveness-only check will happily send traffic to an
  instance that can't reach its database.

```bash
curl -i http://localhost:8084/api/v1/health
curl -i http://localhost:8084/api/v1/health/ready
```

## 4. Smoke login

Confirm auth + JWT issuance end-to-end against the seeded bootstrap admin:

```bash
curl -s -X POST http://localhost:8084/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<BOOTSTRAP_ADMIN_EMAIL>","password":"<BOOTSTRAP_ADMIN_PASSWORD>"}'
```

Expect `200` with `data.accessToken` (refresh is HttpOnly `fo_refresh` cookie; body
refresh is disabled outside test unless `AUTH_RETURN_REFRESH_IN_BODY=true`). Then hit
one permission-gated route (e.g. `GET /api/v1/operations/outbox`) with the
`Authorization: Bearer <accessToken>` header to confirm the Super Admin role's
permissions actually resolve.

## 5. Background workers (PM2 / cron)

`ecosystem.config.cjs` schedules one-shot workers via PM2 `cron_restart` (same pattern
as the journey monitor — workers do not self-loop):

```bash
pm2 start ecosystem.config.cjs
# or manually:
npm run worker:journey
npm run worker:profile-expiry
npm run worker:visa-notifications
npm run worker:notify-drain
```

Confirm logs: `journey.worker.done`, `profile.document_expiry.worker.done`,
`notify.outbox.drain.done`. EMAIL/WhatsApp rows stay `FAILED` until
`NOTIFY_EMAIL_WEBHOOK_URL` / `NOTIFY_WHATSAPP_WEBHOOK_URL` are configured — APP
channels still mark `SENT`.

## 6. CORS

`CORS_ORIGIN` in `.env` must be the real client origin(s) (comma-separated for multiple),
not the `.env.example` default of `http://localhost:3000`. In **production**,
`lib/productionConfig.js` refuses localhost/`*` and refuses to start if `CORS_ORIGIN`
is missing. Development may still omit it (reflect-any-origin) for local hacking only.

## 7. `JWT_SECRET` + access TTL + field encryption

Production startup (`assertProductionConfigSafe`) refuses:
- obvious example `JWT_SECRET` values / secrets shorter than 32 characters
- missing `FIELD_ENCRYPTION_KEY`
- `ALLOW_SIMULATED_PAYMENT` / `ALLOW_SIMULATED_BOOKING`
- `PASSWORD_RESET_RETURN_TOKEN` / `AUTH_RETURN_REFRESH_IN_BODY`
- `VAULT_STORAGE_PROVIDER=local`

Access tokens default to **15m** (`JWT_ACCESS_EXPIRES_IN`); refresh stays long-lived via
HttpOnly `fo_refresh`. Generate a strong secret before go-live:

```bash
openssl rand -base64 48
```

Rotate `JWT_SECRET` invalidates outstanding access tokens (refresh rows are hashed
separately in `RefreshToken`).

## 7b. Bootstrap admin seed

Production `prisma/seed` refuses `admin@example.com` / `ChangeMe123!` (and similar).
Set real `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` before first prod seed.

## 7c. Graceful shutdown

API handles `SIGTERM`/`SIGINT`: readiness returns 503, `server.close()` drains,
Prisma disconnects, force-exit after `SHUTDOWN_TIMEOUT_MS` (default 25s).
One-shot workers share the same signal + disconnect helper (PM2 cron unchanged).

## 7d. Circuit breakers (process-local)

Supplier circuit breakers are **per Node process**. PM2 cluster workers do not share
OPEN/CLOSED state. Distributed coordination would need external shared infrastructure
(e.g. Redis) and is intentionally out of scope.

## 8. Outbox / accounting drain

Ops outbox drain is implemented: adapters fan out to CRM / mid / back / accounting
(fail-closed when `OPS_*_BASE_URL` + `OPS_*_API_KEY` are unset). Automatic schedule:

```bash
npm run worker:ops-drain
# PM2: ops-outbox-drain in ecosystem.config.cjs (*/5)
```

Manual: `POST /api/v1/operations/outbox/drain` (permission `ops:reconcile:write`).
Unconfigured destinations record `SKIPPED_UNCONFIGURED` — never invent external success.
Live CRM/accounting credentials remain an external dependency.
