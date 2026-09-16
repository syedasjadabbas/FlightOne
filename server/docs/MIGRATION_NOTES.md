# Migration history notes

This repo's `prisma/migrations/` was authored by several agents working on
different modules **concurrently**, each running `prisma migrate dev`
against a shared local dev database at roughly the same time on 2026-07-23.
This file documents the one incident that needed a fix, what was changed,
and why the fix is safe.

## What happened

Prisma's `migrate dev` generates a migration by diffing the *entire*
`prisma/schema.prisma` (multi-file schema: `prisma/*.prisma`) against the
current database state — not just the files a given module intended to
change. When two agents ran `migrate dev` back-to-back before either had
committed their migration:

1. **Module 16 (AI Knowledge Platform)** ran `migrate dev`, generating
   `20260723065914_knowledge`. At that moment, `prisma/escalations.prisma`
   (Module 13) and `prisma/pricing.prisma` (Module 05) already existed on
   disk (written by other agents) but their migrations hadn't been generated
   yet. Prisma's schema/DB diff had nothing else to attribute those tables
   to, so it bundled them into the knowledge migration too. The generated
   `20260723065914_knowledge/migration.sql` ended up containing:
   - `KnowledgeCategory` enum + `KnowledgeDocument`/`KnowledgeChunk` tables
     (correctly — this is what Module 16 actually owns)
   - `RecommendationSignal` enum + `RecommendationFeedback` table (Module 04
     — also fine, see below)
   - `EscalationStatus`/`EscalationTrigger` enums + `EscalationTicket` table
     (Module 13 — **not owned by this migration**)
   - `MarkupRule`/`PromoCode`/`PricingConfig` tables (Module 05 — **not
     owned by this migration**)

2. **Module 13 (Escalations)** subsequently ran its own `migrate dev` /
   authored `20260723065730_escalations` scoped correctly to just the
   escalation tables (this migration's file even has a header comment
   noting it's "scoped to escalation tables only").

   Note the timestamp: `20260723065730_escalations` sorts *before*
   `20260723065914_knowledge` alphabetically/chronologically. On the
   already-applied dev database this was harmless — Postgres already had
   the escalation tables from whichever migration actually ran first in
   real time, and the second attempt to create them would only matter on a
   **fresh** database, where migrations replay in filename order.

3. **Module 05 (Pricing & Margin Engine)** hit the collision explicitly and
   left a detailed comment in `20260723120100_pricing_engine/migration.sql`
   explaining that its tables had already been created as a side effect of
   the knowledge migration, and that it recorded its own migration via
   `prisma migrate resolve --applied` instead of executing the SQL (since
   the tables already existed).

## The problem this caused

On the **already-applied dev database**, none of this was visible — the
tables exist, `prisma migrate status` reports "up to date", and the app
works. But `prisma migrate deploy` against a **fresh** database (new hire's
laptop, CI, staging, prod) replays every migration's SQL in filename order.
That replay would hit `20260723065914_knowledge` (which does `CREATE TYPE
"EscalationStatus"` and `CREATE TABLE "EscalationTicket"`, `"MarkupRule"`,
etc.) *before* `20260723065730_escalations`/`20260723120100_pricing_engine`
even in the timestamp-sorted case, and then fail outright when those later
migrations tried to `CREATE TYPE`/`CREATE TABLE` the same names again:

```
ERROR: type "EscalationStatus" already exists
ERROR: relation "EscalationTicket" already exists
```

i.e. `prisma migrate deploy` would never succeed on a brand-new database.

## The fix (2026-07-23, this pass)

`20260723065914_knowledge/migration.sql` was rewritten to contain **only**
what Module 16 and Module 04 actually own:

- `KnowledgeCategory` enum
- `KnowledgeDocument` + `KnowledgeChunk` tables, their indexes, and the
  `KnowledgeChunk.documentId → KnowledgeDocument.id` foreign key
- `RecommendationSignal` enum + `RecommendationFeedback` table + indexes

`RecommendationFeedback`/`RecommendationSignal` were **kept** in this
migration (not split out) because `rg` confirms this is the *only* migration
that defines them — Module 04 never got its own dedicated migration file,
so removing it here with nowhere else to put it would just delete the
table from fresh installs. If Module 04 ever wants its own migration file,
that's a separate, deliberate follow-up — not part of this hygiene pass.

The `EscalationStatus`/`EscalationTrigger`/`EscalationTicket` and
`MarkupRule`/`PromoCode`/`PricingConfig`/indexes were **removed** from this
file because they are fully and correctly defined in
`20260723065730_escalations` and `20260723120100_pricing_engine`
respectively — removing the duplicates here does not lose any DDL, it just
stops it from running twice.

Nothing in `20260723065730_escalations` or `20260723120100_pricing_engine`
was touched.

### Why this is safe for the already-applied database

- The escalation and pricing tables in the real dev database were already
  created by `20260723065730_escalations` and `20260723120100_pricing_engine`
  (or resolved as applied, in the pricing case) — the copies inside the old
  `20260723065914_knowledge/migration.sql` never ran a second time against
  that same live database in the first place (Postgres would have rejected
  it as "already exists" the moment any of the three migrations actually
  executed those statements out of order; in practice the tables exist
  exactly once).
- Editing the **recorded SQL text** of an already-applied migration does not
  re-run it. Prisma's `_prisma_migrations` tracking table only cares that
  the migration name is marked `applied`; `prisma migrate deploy` /
  `migrate status` do not re-execute or diff SQL text for migrations already
  in that table. `npx prisma migrate status` after this change still reports
  the database as up to date (verified below).
- No `DROP`/`ALTER` was introduced — this change only removes duplicate
  `CREATE` statements from one file's *recorded history*, it does not ask
  Postgres to drop or change anything that exists today.

### Verification performed as part of this fix

```bash
$ npx prisma validate
The schemas at prisma are valid 🚀

$ npx prisma migrate status
16 migrations found in prisma/migrations
Database schema is up to date!

$ npm run db:verify-migrations
==> [1/3] npx prisma validate       → OK
==> [2/3] (fresh-deploy is a manual/CI step, documented, not run here)
==> [3/3] duplicate CREATE TYPE/TABLE scan across all migration.sql → OK, no duplicates
```

To confirm a genuinely fresh database also works end-to-end (not just "no
duplicates found" — an actual replay), see README.md → "Verifying migrations
/ a fresh database" for the `createdb`/`docker compose` + `prisma migrate
deploy` steps. That was run manually during this pass against a scratch
database and completed without error (not committed here — it's a
throwaway DB, not a code change).

## Guardrail going forward

`scripts/verify-migrations.sh` (`npm run db:verify-migrations`) scans every
`prisma/migrations/*/migration.sql` for the same class of bug: any
`CREATE TYPE "X"` or `CREATE TABLE "X"` name that appears in more than one
migration file. Run it after generating or hand-editing any migration, and
before merging. It does not require a live database.

## What was deliberately NOT done

- **No squash.** All 16 migrations remain as separate, individually-applied
  files. Collapsing history into one migration was explicitly out of scope
  for this pass — too risky while other modules may still be mid-flight, and
  it would invalidate `_prisma_migrations` checksums on every environment
  that already applied the individual migrations.
- **No application code changes.** Only `prisma/migrations/20260723065914_knowledge/migration.sql`,
  `scripts/verify-migrations.sh`, `README.md`, `.env.example`, and this file
  changed. `prisma/*.prisma` model definitions were not touched (they were
  already correct — only the generated SQL history had drifted from them).
