# Module 08 — Visa Intelligence

**PRD Module 8** · Prefix: `VISA` · Phase: 2

## Objective (from PRD)

Provide destination visa requirements, transit rules, required documents, embassy
information, processing timelines, expiry reminders, and appointment tracking.

## Dependencies

- Module 02 (traveller's nationality/existing visas to determine requirements)
- Module 16 (source-of-truth knowledge base for requirements/embassy data)
- Module 07 (visa documents stored in the vault)

## Core concepts

- Visa requirements are a **lookup against nationality × destination × transit route**, kept
  current via Module 16's knowledge platform — this module is the query/workflow layer on
  top, not the data-entry system of record for raw embassy rules.
- Requirements must be re-checked whenever itinerary or traveller nationality changes — not
  computed once and cached indefinitely (rules change; caching duration is a product/legal
  decision, not an assumption to hardcode).
- Responses distinguish **attributed facts** (`isFact` + `source` + `lastVerifiedAt`) from
  **guidance**. `UNKNOWN` / `DATA_UNAVAILABLE` / `UNCONFIGURED` / `STALE` never invent rules.

## Checklist

### Requirements lookup

- [x] Destination visa requirement lookup by nationality (visa-free, visa-on-arrival,
      e-visa, embassy visa) via provider abstraction (`catalog` / `http` / `unconfigured`)
- [x] Transit visa rows returned distinctly from destination (country-level notes only;
      airport/duration-specific Timatic rules deferred to external authority feed)
- [x] Required-document checklist guidance vs Profile/Vault presence hints
- [x] Embassy/consulate information when present on attributed catalog/http rows
- [x] Processing timeline estimates only when attributed (never invented)

### Application workflow

- [x] Appointment tracking (booked date, location, status)
- [x] Document checklist progress hints against traveller Profile/Vault (ownership-checked
      vaultDocumentIds) — not a legal determination
- [x] Application status tracking (submitted, in process, approved, rejected)

### Notifications

- [x] Visa expiry reminders with Module-08-specific lead times (`VISA_DOC_EXPIRY_LEAD_DAYS`,
      worker `npm run worker:visa-notifications`, NotificationOutbox dedupe)
- [x] Processing-timeline-based apply-by reminders — only when real `departAt` + attributed
      `processingDaysMax` exist (never invent processing times)

### Integration with booking

- [x] Surface visa requirement/warning during Module 03 booking metadata (informational,
      not a hard block); profile nationality fallback
- [x] Checkout UI warning from `metadata.visaCheck` (informational; does not block pay/confirm)
- [x] Dedicated authenticated traveller `/visa` assessment UI (facts vs guidance, checklist,
      transit distinction, `VISA_UNCERTAIN` escalation)
- [x] Module 01 (Ava) grounds visa questions in Module 08 assess/lookup — latest user-stated
      nationality overrides saved profile; never invents fees or eligibility; offers human
      escalation (`VISA_UNCERTAIN`) when confidence is insufficient

## Business rules / invariants

- Visa/embassy data must be attributable to a source and a last-verified date — the AI must
  never present stale or unsourced visa information as current fact.
- A visa requirement warning is informational, not a hard block on booking.
- Human escalation trigger: `VISA_UNCERTAIN` (Module 13).

## Provider status

- Default: `VISA_PROVIDER=catalog` (ops-attributed `VisaRequirement` rows)
- `VISA_PROVIDER=unconfigured` → fail-closed `UNCONFIGURED`
- `VISA_PROVIDER=http` + `VISA_HTTP_URL` for external authority (no credentials invented)
- Live Timatic/government credentials: **not configured** in this environment — do not claim
  live verification occurred.

## External / deferred dependencies (not Module 8 code gaps)

1. Live government/Timatic credentials + continuous ingestion (Module 16 VISA corpus)
2. Airport/duration-specific transit rules (require external authority data)

## Status

**MODULE 8 COMPLETE** for all implementable in-scope PRD requirements with available providers.
