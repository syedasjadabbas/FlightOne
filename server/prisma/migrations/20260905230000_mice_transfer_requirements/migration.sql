-- Module 12: MICE airport transfer requirements + fail-closed provider status

CREATE TYPE "MiceTransferDirection" AS ENUM ('AIRPORT_PICKUP', 'AIRPORT_DROPOFF');
CREATE TYPE "MiceTransferStatus" AS ENUM (
  'REQUESTED',
  'PROVIDER_UNCONFIGURED',
  'DATA_UNAVAILABLE',
  'CONFIRMED',
  'FAILED'
);

ALTER TABLE "MiceTransfer"
  ADD COLUMN IF NOT EXISTS "direction" "MiceTransferDirection" NOT NULL DEFAULT 'AIRPORT_PICKUP',
  ADD COLUMN IF NOT EXISTS "passengerCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "airportCode" TEXT,
  ADD COLUMN IF NOT EXISTS "flightRef" TEXT,
  ADD COLUMN IF NOT EXISTS "flightBookingId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "MiceTransferStatus" NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS "providerStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "providerReason" TEXT,
  ADD COLUMN IF NOT EXISTS "transferRef" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill updatedAt for existing rows
UPDATE "MiceTransfer" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "MiceTransfer_eventId_idempotencyKey_key"
  ON "MiceTransfer"("eventId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "MiceTransfer_flightBookingId_idx" ON "MiceTransfer"("flightBookingId");
CREATE INDEX IF NOT EXISTS "MiceTransfer_status_idx" ON "MiceTransfer"("status");
