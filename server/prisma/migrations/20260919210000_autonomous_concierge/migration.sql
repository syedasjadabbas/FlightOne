-- Phase 3 P3-01 — Autonomous Travel Concierge rules + execution ledger.

DO $$ BEGIN
  CREATE TYPE "ConciergeTrigger" AS ENUM ('DELAY', 'CANCELLED', 'DISRUPTION', 'REBOOK_OPPORTUNITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConciergeAction" AS ENUM ('NOTIFY', 'PREPARE_REBOOK', 'AUTONOMOUS_REBOOK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConciergeExecutionStatus" AS ENUM (
    'EVALUATED',
    'SKIPPED',
    'BLOCKED',
    'PENDING_CONFIRMATION',
    'EXECUTED',
    'FAILED',
    'ESCALATED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ConciergeRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "ConciergeTrigger" NOT NULL,
    "thresholdMinutes" INTEGER,
    "action" "ConciergeAction" NOT NULL,
    "maxAdditionalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "notifyOnTrigger" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConciergeRule_userId_enabled_idx" ON "ConciergeRule"("userId", "enabled");

CREATE TABLE IF NOT EXISTS "ConciergeExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "watchId" TEXT,
    "journeyEventId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ConciergeExecutionStatus" NOT NULL,
    "reason" TEXT,
    "extraMinor" INTEGER,
    "quoteBookingId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConciergeExecution_idempotencyKey_key" ON "ConciergeExecution"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ConciergeExecution_userId_createdAt_idx" ON "ConciergeExecution"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConciergeExecution_bookingId_idx" ON "ConciergeExecution"("bookingId");
CREATE INDEX IF NOT EXISTS "ConciergeExecution_ruleId_idx" ON "ConciergeExecution"("ruleId");

DO $$ BEGIN
  ALTER TABLE "ConciergeExecution"
    ADD CONSTRAINT "ConciergeExecution_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "ConciergeRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
