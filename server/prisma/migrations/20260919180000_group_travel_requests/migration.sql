-- Phase 2 Group Travel — first-class group booking request (10+ travellers).
-- Collaboration workspaces (TravelGroup) stay unchanged; this table is the
-- enquiry lifecycle. Fulfilment remains desk-assisted — no invented PNRs/fares.

DO $$ BEGIN
  CREATE TYPE "GroupTravelRequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupDateFlexibility" AS ENUM ('EXACT', 'PLUS_MINUS_1', 'PLUS_MINUS_3', 'FLEXIBLE_WEEK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupCabinPreference" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GroupTravelRequest" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "status" "GroupTravelRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "flexibility" "GroupDateFlexibility" NOT NULL DEFAULT 'EXACT',
    "passengerCount" INTEGER NOT NULL,
    "cabinPreference" "GroupCabinPreference",
    "purpose" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "organization" TEXT,
    "baggageRequired" BOOLEAN NOT NULL DEFAULT false,
    "seatingTogether" BOOLEAN NOT NULL DEFAULT false,
    "airportTransfers" BOOLEAN NOT NULL DEFAULT false,
    "splitBilling" BOOLEAN NOT NULL DEFAULT false,
    "accommodationRequired" BOOLEAN NOT NULL DEFAULT false,
    "accommodationNotes" TEXT,
    "transportNotes" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupTravelRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupTravelRequest_idempotencyKey_key" ON "GroupTravelRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "GroupTravelRequest_createdByUserId_idx" ON "GroupTravelRequest"("createdByUserId");
CREATE INDEX IF NOT EXISTS "GroupTravelRequest_status_idx" ON "GroupTravelRequest"("status");
CREATE INDEX IF NOT EXISTS "GroupTravelRequest_groupId_idx" ON "GroupTravelRequest"("groupId");
CREATE INDEX IF NOT EXISTS "GroupTravelRequest_createdAt_idx" ON "GroupTravelRequest"("createdAt");

DO $$ BEGIN
  ALTER TABLE "GroupTravelRequest"
    ADD CONSTRAINT "GroupTravelRequest_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
