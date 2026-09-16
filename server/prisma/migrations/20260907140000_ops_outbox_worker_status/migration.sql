-- Module 15: reliable ops outbox worker — claim/processing + unconfigured terminal state.

DO $$ BEGIN
  ALTER TYPE "OpsOutboxStatus" ADD VALUE 'PROCESSING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "OpsOutboxStatus" ADD VALUE 'SKIPPED_UNCONFIGURED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OpsOutboxEvent" ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "OpsOutboxEvent_status_createdAt_idx"
  ON "OpsOutboxEvent"("status", "createdAt");
