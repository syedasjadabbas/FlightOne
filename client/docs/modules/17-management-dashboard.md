# Module 17 — Management Dashboard

Nine PRD KPIs. API `/api/v1/dashboard`. UI `/dashboard` (today / 7d / 30d / 90d / custom).
Permission: `ops:dashboard:read` or `dashboard:read`.
No fake analytics.

Phase 3 P3-04 advanced analytics (`FO_ANALYTICS_V1`) lives on the same module:

- Staff: `GET /api/v1/dashboard/advanced` (+ `/forecast`, `/cohorts`, `/elasticity`, `/suppliers`)
- Corporate ADMIN/APPROVER: `GET /api/v1/corporate/companies/:id/analytics`

Forecasts, elasticity, and supplier insights are inferences over verified bookings only.
Insufficient observations return `INSUFFICIENT_DATA` — charts are not fabricated.
Fares and supplier contracts are never changed by this module. Max range 366 days.
