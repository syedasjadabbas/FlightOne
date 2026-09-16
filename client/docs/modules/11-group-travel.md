# Module 11 — Group Travel

**PRD Module 11** · Prefix: `GRP` · Phase: 2

## Objective (from PRD)

Group creation, traveller invitations, shared itinerary, shared document repository, flight
status updates, announcements, polls, attendance tracking, emergency broadcasts, live
itinerary updates, shared photo gallery, and AI-generated trip memories.

## Dependencies

- Module 02 (profiles), 03 (bookings), 07 (vault), 09 (journey status), NotificationOutbox

## Checklist

### Group setup
- [x] Group creation (name, type, organizer)
- [x] Traveller invitation (code join + email invite accept/decline + organizer add)
- [x] Role model: ORGANIZER / ADMIN / MEMBER

### Shared itinerary & documents
- [x] Shared itinerary aggregating members' bookings (no booking duplication)
- [x] Shared document repository via explicit Vault shares
- [x] Membership-scoped access; leave revokes ongoing access

### Communication & coordination
- [x] Announcements + NotificationOutbox
- [x] Polls with upsert votes
- [x] Emergency broadcasts (multi-channel, deduped, audited)
- [x] Flight status / live itinerary from Module 09 + booking transitions (fail-closed)

### Engagement extras
- [x] Attendance waypoints + check-in
- [x] Shared photo gallery (Vault storage provider)
- [x] Grounded trip memories (INSUFFICIENT_DATA when empty)

### UI / Ava
- [x] `/groups` + `/groups/[groupId]` FlightOne UI
- [x] Ava group grounding

## Status

**MODULE 11 COMPLETE** for implementable PRD scope. Hajj-specific authority integrations and
guardian-consent product policy remain external/stakeholder items, not invented here.
