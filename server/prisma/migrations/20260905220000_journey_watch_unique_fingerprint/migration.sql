-- Module 09: one watch per booking; event fingerprint uniqueness for poll idempotency
-- Safe for empty/test DBs; production should verify no duplicate bookingId rows first.

DROP INDEX IF EXISTS "JourneyWatch_bookingId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "JourneyWatch_bookingId_key" ON "JourneyWatch"("bookingId");

ALTER TABLE "JourneyEvent" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;

UPDATE "JourneyEvent"
SET "fingerprint" = ("payload"->>'fingerprint')
WHERE "fingerprint" IS NULL
  AND "payload" IS NOT NULL
  AND ("payload"->>'fingerprint') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "JourneyEvent_watchId_fingerprint_key"
  ON "JourneyEvent"("watchId", "fingerprint");
