# Module 17 — Management Dashboard

Nine PRD KPIs from authoritative Modules 1–16 data. Not Phase 3 BI.

## KPIs & formulas
1. **Sales** — recognized = bookings created in range with status TICKETED|ACTIVE|COMPLETED
2. **Revenue** — SUM(Booking.amountMinor) same statuses, per currency (no FX sum)
3. **Margins** — SUM(Booking.marginMinor) authoritative Module 05 field
4. **Outstanding credit** — Company.creditUsedMinor / creditLimitMinor (Module 06)
5. **Booking conversion** — search=DashboardSearchEvent; quote=Booking created; reserved/ticketed=BookingTransition
6. **AI automation** — 1 − distinct escalated conversations / conversations created in range
7. **Supplier performance** — Booking.supplierCode volume + fulfillment rates (no invented scores)
8. **Customer analytics** — users/bookers/repeat/AOV/loyalty tiers (aggregates only)
9. **Operational KPIs** — escalations, refunds, recon, ops outbox, journey watches

## API
`/api/v1/dashboard/overview` (+ section endpoints). Auth: `ops:dashboard:read` OR `dashboard:read`.

## UI
`/dashboard` — management only (today / 7d / 30d / 90d / custom range). `/ops` remains Module 15.

## Freshness
30s SWR in-memory cache + `computedAt` timestamp.
