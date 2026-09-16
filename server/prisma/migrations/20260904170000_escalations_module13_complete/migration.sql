-- Module 13 — align lifecycle + PRD trigger aliases (keep legacy VIP/MEDICAL/SSR).
DO $$ BEGIN
  ALTER TYPE "EscalationStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "EscalationTrigger" ADD VALUE IF NOT EXISTS 'VIP_BOOKING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "EscalationTrigger" ADD VALUE IF NOT EXISTS 'MEDICAL_ASSISTANCE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "EscalationTrigger" ADD VALUE IF NOT EXISTS 'SPECIAL_SERVICE_REQUEST';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "EscalationTicket_userId_idx" ON "EscalationTicket"("userId");
CREATE INDEX IF NOT EXISTS "EscalationTicket_userId_status_idx" ON "EscalationTicket"("userId", "status");
