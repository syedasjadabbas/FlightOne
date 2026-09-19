-- Phase 2 MICE — first-class event enquiry (manual-assisted).
-- MiceEvent workspaces stay unchanged; this table is the enquiry lifecycle.

DO $$ BEGIN
  CREATE TYPE "MiceEnquiryStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MiceEventEnquiry" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "eventId" TEXT,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "type" "MiceEventType" NOT NULL,
    "status" "MiceEnquiryStatus" NOT NULL DEFAULT 'SUBMITTED',
    "organization" TEXT,
    "destination" TEXT NOT NULL,
    "origin" TEXT,
    "venue" TEXT,
    "eventStartsAt" TIMESTAMP(3) NOT NULL,
    "eventEndsAt" TIMESTAMP(3) NOT NULL,
    "travelStartsAt" TIMESTAMP(3),
    "travelEndsAt" TIMESTAMP(3),
    "attendeeCount" INTEGER NOT NULL,
    "budgetMinor" INTEGER,
    "currency" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "flightsRequired" BOOLEAN NOT NULL DEFAULT false,
    "hotelsRequired" BOOLEAN NOT NULL DEFAULT false,
    "transfersRequired" BOOLEAN NOT NULL DEFAULT false,
    "meetingSpaceRequired" BOOLEAN NOT NULL DEFAULT false,
    "cateringRequired" BOOLEAN NOT NULL DEFAULT false,
    "visaAssistanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "accommodationNotes" TEXT,
    "transportNotes" TEXT,
    "flightNotes" TEXT,
    "meetingNotes" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiceEventEnquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MiceEventEnquiry_idempotencyKey_key" ON "MiceEventEnquiry"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MiceEventEnquiry_createdByUserId_idx" ON "MiceEventEnquiry"("createdByUserId");
CREATE INDEX IF NOT EXISTS "MiceEventEnquiry_status_idx" ON "MiceEventEnquiry"("status");
CREATE INDEX IF NOT EXISTS "MiceEventEnquiry_eventId_idx" ON "MiceEventEnquiry"("eventId");
CREATE INDEX IF NOT EXISTS "MiceEventEnquiry_createdAt_idx" ON "MiceEventEnquiry"("createdAt");

DO $$ BEGIN
  ALTER TABLE "MiceEventEnquiry"
    ADD CONSTRAINT "MiceEventEnquiry_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
