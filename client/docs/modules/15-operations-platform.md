# Module 15 — Operations Platform

**PRD Module 15** · Prefix: `OPS` · Phase: 1

## Objective (from PRD)

Integrate with CRM, Mid Office, Back Office, Accounting, Finance, commission tracking,
supplier reconciliation, and audit logs — the connective tissue keeping the operations team
in sync with what the AI/customers are doing.

## Dependencies

- Module 03 (every booking event is an integration trigger)
- Module 05/14 (financial data flowing to accounting)
- Module 00 (audit log foundation this module builds reporting on top of)

## Core concepts

- This module is primarily an **event-driven sync layer**: booking lifecycle events
  (created, ticketed, cancelled, refunded) fan out to CRM/mid/back-office/accounting
  consumers — it should not require those systems to poll the booking engine.
- "Update mid/back office automatically" (PRD Module 3) is this module's responsibility, not
  something Module 03 should implement bespoke per integration.

## Checklist

### CRM integration
- [x] Customer/lead sync (new customer created, profile updated) to CRM —
      `CUSTOMER_UPSERTED` producer on register + material profile update (outbox)
- [x] Booking activity synced to CRM as customer interaction history — BOOKING_*/PAYMENT_*
      outbox events via the same CRM adapter

### Mid/back office
- [x] Outbox drain worker (`worker:ops-drain` / PM2 cron) pushes booking lifecycle events when adapters are configured; unconfigured stays `SKIPPED_UNCONFIGURED` (fail-closed)
- [ ] Live CRM/mid/back-office credentials still EXTERNAL_DEPENDENCY

### Accounting & finance
- [x] Revenue recognition entries per booking (ties to Module 05's margin data)
- [x] Commission tracking (agent/consultant commission per booking, where applicable)
- [x] Supplier reconciliation (matching supplier invoices/statements against booked/ticketed
      records — discrepancy flagging)

### Audit
- [ ] Centralized audit log surface (queryable view over Module 00's audit events plus
      booking/financial events from this module)
- [ ] Audit log is immutable, append-only, and not deletable by business users (mirrors the
      ERP platform's invariant)

## Business rules / invariants

- Every financial-impacting booking event (ticket, cancel, refund) must produce a
  corresponding accounting entry — no manual "remember to record this" step.
- Supplier reconciliation discrepancies are surfaced, not silently auto-corrected — a human
  resolves mismatches between supplier billing and internal records.
- This module aggregates in the database per the dev guide's DB-performance rules (§6.1) —
  reconciliation/commission reports must not load raw booking rows into JS to sum them.
