# Module 07 — Traveller Vault

**PRD Module 7** · Prefix: `VAULT` · Phase: 1 (basic storage) → 2 (visa-linked documents
alongside Module 08)

## Objective (from PRD)

Securely store passports, visas, tickets, hotel vouchers, insurance, frequent flyer
numbers, loyalty cards, and travel certificates — the durable document store behind the
traveller profile.

## Dependencies

- Module 00 (encryption/access-logging rules this module must follow)
- Module 02 (profile fields that reference vault documents)
- Module 03 (writes issued tickets/vouchers here automatically)

## Core concepts

- The Vault is a **document store with structured metadata**, not just a file bucket —
  every document has a type, linked entity (booking, traveller), and expiry where
  applicable, so other modules (02, 08, 09) can query it, not just display it.
- Documents issued by Module 03 (tickets, vouchers) land here **automatically**, not via a
  manual upload step.

## Checklist

### Storage & structure
- [x] Document types supported: passport, visa, ticket, hotel voucher, insurance policy,
      frequent flyer card, loyalty card, travel certificate (+ national id / residence permit)
- [x] Each document: type, owner (traveller/companion), linked booking (if applicable),
      issue date, expiry date (if applicable), file reference
- [x] Access-logged reads; binary storage via provider abstraction (local for dev/test).
      Cloud encryption-at-rest remains a deployment dependency (no invented credentials)
- [x] Auto-ingestion of tickets/vouchers issued by Module 03 (no manual step)
- [x] Manual upload path for documents not issued by the platform — fail-closed when
      storage unconfigured

### Retrieval & sharing
- [x] Traveller-facing vault view (list/filter by type, upcoming-expiry sort) — `/vault`
- [x] Downloadable/printable ticket & voucher formats (PDF from confirmed supplier data)
- [x] Shareable link/export for a specific document, access-scoped and expiring

### Lifecycle
- [x] Expiry tracking feeds Module 02's notification job via profile `vaultDocumentId` links
- [x] Document versioning on renewal (old version retained for audit, not deleted)
- [x] Soft-delete + hard-purge retention worker (`VAULT_RETENTION_DAYS`); platform
      ticket/voucher rows and profile-referenced docs are never purged

## Business rules / invariants

- Every read of a sensitive document (passport, visa) is access-logged.
- Documents issued by the platform (tickets/vouchers) are immutable once issued; a
  reissue/refund (Module 14) creates a new linked document rather than mutating the old one.
- Vault access respects the Personal/Corporate profile boundary (Module 06) — a corporate
  admin does not get blanket access to a traveller's personal documents.

## Status

**MODULE 7 COMPLETE** (Phase 1 in-scope). Deferred: cloud object storage credentials /
encryption-at-rest wiring, Phase 2 visa-linked documents (Module 08), external OCR service
credentials.
