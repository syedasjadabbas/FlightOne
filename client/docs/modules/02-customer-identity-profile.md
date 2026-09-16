# Module 02 — Customer Identity & Profile

**PRD Module 2** · Prefix: `CIP` · Phase: 1

## Objective (from PRD)

A permanent traveller profile storing identity documents, loyalty memberships,
preferences, history, and related travellers (companions/family) — with proactive
notification before any document expires.

## Dependencies

- Module 00 (auth identity the profile hangs off of)
- Module 07 (Traveller Vault — the secure document storage backing this profile's documents)

## Core concepts

- One profile per traveller; a **booking traveller** can be the account holder or a **saved
  companion/family member** on their profile (each with their own documents).
- Profile data feeds Module 01 (personalization), Module 03 (auto-filled traveller details
  at booking), and Module 08 (visa eligibility checks).

## Checklist

### Identity documents
- [x] Passport: number, issuing country, issue/expiry date, scanned copy (→ Vault)
- [x] CNIC / National ID: number, expiry (where applicable), scanned copy
- [x] Visas held: destination, type, validity window, scanned copy
- [x] Residence permits: country, type, expiry
- [x] OCR extract → review → confirm (frontend wired to `/documents/:id/ocr` + apply/PATCH;
      live extraction requires `OCR_PROVIDER=http` + provider URL)
- [ ] Document expiry notification job (email/WhatsApp/app) at configurable lead times
      (e.g. 6 months / 1 month / 1 week before expiry) — background worker, not
      request-time computation

### Loyalty & preferences
- [ ] Frequent Flyer numbers per airline/alliance
- [ ] Hotel loyalty memberships per chain
- [ ] Seat preference (aisle/window, front/back)
- [ ] Meal preference (dietary/religious restrictions included)
- [ ] General travel preferences (preferred airlines, class, layover tolerance)

### People
- [ ] Emergency contact(s)
- [ ] Saved companions (frequent co-travellers not required to have their own account)
- [ ] Family members with their own document sets (for family bookings)

### History
- [ ] Travel history (past bookings, read-only, linked to Module 03 booking records)
- [ ] Aggregated stats surfaced back to the AI Consultant (Module 01) for personalization

### Data integrity & lifecycle
- [ ] Profile completeness indicator (what's missing before a booking can be made
      hands-free by the AI)
- [ ] Edit/versioning of documents (renewals replace, don't silently overwrite audit trail)
- [ ] Merge/dedupe handling if the same traveller ends up with duplicate profiles

## Business rules / invariants

- Document numbers (passport, CNIC, visa) are PII — stored per Module 00's field-level
  encryption rule, access-logged.
- Expiry notifications are proactive (worker-driven), never purely "shown when the customer
  happens to open their profile" (PRD: "shall notify customers before document expiry").
- A companion/family member's documents belong to the account holder's vault access scope
  unless that companion has their own independent account.
