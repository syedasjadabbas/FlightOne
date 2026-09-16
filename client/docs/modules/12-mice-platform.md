# Module 12 — MICE Platform

**PRD Module 12** · Prefix: `MICE` · Phase: 2

## Objective

Meetings, Incentives, Conferences, Exhibitions with delegate registration, flights/hotels
(via Module 03 booking links), airport transfers (requirements + fail-closed provider),
agenda, QR check-in, badges, attendance, budget, sponsors, and event reporting — extending
Module 11 group primitives.

## Checklist

- [x] Event types MEETING / INCENTIVE / CONFERENCE / EXHIBITION
- [x] Delegate registration (organizer + self-service) + duplicate email guard
- [x] Flights/hotels via MiceBookingShare → real Booking rows
- [x] Airport transfers: pickup/drop-off requirements, delegate, flight link, pax, notes
- [x] Transfer provider boundary (`MICE_TRANSFER_BOOK_*`) — UNCONFIGURED until configured
- [x] CONFIRMED only with attributed provider `confirmationRef`
- [x] Event agenda (sessions)
- [x] QR check-in by badgeCode (idempotent)
- [x] Badge PDF generation
- [x] Attendance tracking
- [x] Budget ceiling + lines + travel actuals from linked bookings
- [x] Sponsor management
- [x] Event reporting from stored data (includes transfer status counts)
- [x] `/mice` UI + Ava grounding + NotificationOutbox

## Transfer provider config

| Env | Role |
|-----|------|
| `MICE_TRANSFER_BOOK_PROVIDER` | `unconfigured` (default) \| `http` |
| `MICE_TRANSFER_BOOK_HTTP_URL` | Required when provider=`http` |
| `MICE_TRANSFER_BOOK_HTTP_API_KEY` | Optional |
| `JOURNEY_TRANSFER_STATUS_*` | Optional live status (Module 09) |

## Status

**MODULE 12 implementation-complete** for Phase 2. Live transfer booking remains
**EXTERNAL_DEPENDENCY** until `MICE_TRANSFER_BOOK_*` credentials are configured.
No fabricated transfer inventory, vehicles, prices, or confirmations.
