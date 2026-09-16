-- Module 08 — visa uncertainty escalation trigger.

DO $$ BEGIN
  ALTER TYPE "EscalationTrigger" ADD VALUE 'VISA_UNCERTAIN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
