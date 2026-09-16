-- Module 10 — rewards ledger hardening + corporate programmes
ALTER TABLE "RewardLedgerEntry" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "RewardLedgerEntry" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardLedgerEntry_idempotencyKey_key" ON "RewardLedgerEntry"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "RewardLedgerEntry_expiresAt_idx" ON "RewardLedgerEntry"("expiresAt");

-- One row per bookingId+type (NULLs allowed multiple times in Postgres unique)
CREATE UNIQUE INDEX IF NOT EXISTS "RewardLedgerEntry_bookingId_type_key" ON "RewardLedgerEntry"("bookingId", "type");

CREATE TYPE "CorporateRewardLedgerType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'REVERSE');

CREATE TABLE IF NOT EXISTS "CorporateRewardProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyEarnPointsPerHundredMinor" INTEGER NOT NULL DEFAULT 0,
    "personalEarnEnabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporateRewardProgram_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CorporateRewardProgram_companyId_key" ON "CorporateRewardProgram"("companyId");

CREATE TABLE IF NOT EXISTS "CorporateRewardLedgerEntry" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CorporateRewardLedgerType" NOT NULL,
    "points" INTEGER NOT NULL,
    "bookingId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporateRewardLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CorporateRewardLedgerEntry_programId_idx" ON "CorporateRewardLedgerEntry"("programId");
CREATE INDEX IF NOT EXISTS "CorporateRewardLedgerEntry_companyId_idx" ON "CorporateRewardLedgerEntry"("companyId");
CREATE INDEX IF NOT EXISTS "CorporateRewardLedgerEntry_bookingId_idx" ON "CorporateRewardLedgerEntry"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "CorporateRewardLedgerEntry_bookingId_type_key" ON "CorporateRewardLedgerEntry"("bookingId", "type");

DO $$ BEGIN
  ALTER TABLE "CorporateRewardLedgerEntry" ADD CONSTRAINT "CorporateRewardLedgerEntry_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "CorporateRewardProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
