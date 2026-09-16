# Module 09 — Live Journey Management

**PRD Module 9** · Prefix: `JRN` · Phase: 2

## Objective (from PRD)

Post-booking monitoring of flight delays, gate/terminal changes, weather disruptions,
boarding reminders, hotel check-in, airport transfers, and immigration advisories, notified
via app, email, and WhatsApp.

## Dependencies

- Module 03 (confirmed/ticketed bookings) — JourneyWatch is authoritative for TICKETED→ACTIVE
  and ACTIVE→COMPLETED (arrival window + 6h grace; never invents earlier completion)
- NotificationOutbox (APP / EMAIL / WhatsApp) — delivery adapters may be unconfigured
- Module 13 (`JOURNEY_DISRUPTION` escalation)
- Optional live feeds: flight status, weather, hotel status, transfer status, immigration
  (HTTP or knowledge corpus) — never invented; missing `observedAt` is never treated as VERIFIED

## Checklist

### Flight monitoring
- [x] Delay / cancellation / schedule-change detection (attributed live status only)
- [x] Gate + terminal change detection
- [x] Boarding reminder from booking `departAt` only
- [x] Fail-closed flight-status provider (`unconfigured` / `http`)

### Disruption awareness
- [x] Weather disruption provider abstraction + meaningful-change notify/dedupe
- [x] Immigration advisory provider (`unconfigured` / `http` / `knowledge`) with
      VERIFIED/STALE/DATA_UNAVAILABLE/UNCONFIGURED — not Module 08 visa eligibility

### Ground journey
- [x] Hotel check-in reminder from booking check-in date + optional live hotel-status HTTP
- [x] Airport transfer reminder from booking pickup + optional live transfer-status HTTP

### Notifications
- [x] APP / EMAIL / WhatsApp via NotificationOutbox
- [x] Dedupe keys per event fingerprint; worker-retry idempotent
- [x] Ownership isolation on watches/events

### Rebooking / Ava / lifecycle
- [x] Live-inventory alternatives; quote handoff only (no auto book/pay)
- [x] Ava grounded on watches + full provider capability (never invents ancillary status)
- [x] TICKETED→ACTIVE on watch ensure; ACTIVE→COMPLETED on JourneyWatch completion window
- [x] One watch per booking (`@@unique(bookingId)`); event fingerprint uniqueness

## Provider configuration (required for live)

| Feed | Env |
|------|-----|
| Flight status | `JOURNEY_STATUS_PROVIDER=http`, `JOURNEY_STATUS_HTTP_URL`, optional `JOURNEY_STATUS_HTTP_API_KEY` |
| Weather | `JOURNEY_WEATHER_PROVIDER=http`, `JOURNEY_WEATHER_HTTP_URL` |
| Hotel status | `JOURNEY_HOTEL_STATUS_PROVIDER=http`, `JOURNEY_HOTEL_STATUS_HTTP_URL` |
| Transfer | `JOURNEY_TRANSFER_STATUS_PROVIDER=http`, `JOURNEY_TRANSFER_STATUS_HTTP_URL` |
| Immigration | `JOURNEY_IMMIGRATION_PROVIDER=http\|knowledge` (+ HTTP URL or Module 16 corpus) |
| Shared | `JOURNEY_ANCILLARY_HTTP_API_KEY`, `*_TIMEOUT_MS`, `*_STALE_AFTER_MS` |
| Worker | `JOURNEY_WORKER_CONCURRENCY`, `LOOKAHEAD_MS`, `LOOKBEHIND_MS`, `COOLDOWN_MS`, `BATCH_SIZE` |
| Channels | `JOURNEY_NOTIFICATION_CHANNELS` (APP/EMAIL/WHATSAPP) |

Default for all feeds: **unconfigured** (honest UNCONFIGURED / DATA_UNAVAILABLE).

## Status

**MODULE 9 implementation-complete pending live feeds.** No fabricated status. Remaining
blockers are external provider credentials and email/WhatsApp delivery adapters.
