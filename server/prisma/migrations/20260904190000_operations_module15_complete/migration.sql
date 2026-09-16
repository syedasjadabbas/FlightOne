-- Module 15 complete — sync ledger, commissions, expanded recon statuses.

DO $$ BEGIN
  ALTER TYPE "SupplierReconStatus" ADD VALUE IF NOT EXISTS 'MISMATCH';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "SupplierReconStatus" ADD VALUE IF NOT EXISTS 'DATA_UNAVAILABLE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "SupplierReconStatus" ADD VALUE IF NOT EXISTS 'UNCONFIGURED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "SupplierReconStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_REVIEW';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpsIntegrationState" AS ENUM (
    'CONFIGURED',
    'UNCONFIGURED',
    'VERIFIED',
    'DATA_UNAVAILABLE',
    'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpsSyncStatus" AS ENUM (
    'PENDING',
    'DELIVERED',
    'SKIPPED_UNCONFIGURED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AccountingEntry"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEventId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingEntry_idempotencyKey_key"
  ON "AccountingEntry"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "AccountingEntry_entryType_idx" ON "AccountingEntry"("entryType");
CREATE INDEX IF NOT EXISTS "AccountingEntry_createdAt_idx" ON "AccountingEntry"("createdAt");

ALTER TABLE "SupplierReconItem"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT,
  ADD COLUMN IF NOT EXISTS "mismatchReason" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierReconItem_idempotencyKey_key"
  ON "SupplierReconItem"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "CommissionRecord" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "basisMinor" INT NOT NULL,
  "commissionBps" INT NOT NULL,
  "commissionMinor" INT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "source" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "formula" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionRecord_idempotencyKey_key" ON "CommissionRecord"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CommissionRecord_bookingId_idx" ON "CommissionRecord"("bookingId");

CREATE TABLE IF NOT EXISTS "OpsExternalSync" (
  "id" TEXT PRIMARY KEY,
  "integration" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "OpsSyncStatus" NOT NULL DEFAULT 'PENDING',
  "externalRef" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "response" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "OpsExternalSync_idempotencyKey_key" ON "OpsExternalSync"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "OpsExternalSync_integration_idx" ON "OpsExternalSync"("integration");
CREATE INDEX IF NOT EXISTS "OpsExternalSync_eventId_idx" ON "OpsExternalSync"("eventId");
CREATE INDEX IF NOT EXISTS "OpsExternalSync_status_idx" ON "OpsExternalSync"("status");

ALTER TABLE "OpsOutboxEvent"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "OpsOutboxEvent_idempotencyKey_key"
  ON "OpsOutboxEvent"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
