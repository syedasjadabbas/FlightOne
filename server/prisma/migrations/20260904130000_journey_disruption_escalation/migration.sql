-- Module 09 — journey disruption escalation trigger.
DO $$ BEGIN
  ALTER TYPE "EscalationTrigger" ADD VALUE 'JOURNEY_DISRUPTION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
