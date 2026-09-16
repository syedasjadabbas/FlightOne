-- Module 12 — MICE Platform completion
ALTER TABLE "MiceSession" ADD COLUMN IF NOT EXISTS "speakers" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MiceDelegate_eventId_email_key" ON "MiceDelegate"("eventId", "email");
CREATE INDEX IF NOT EXISTS "MiceDelegate_userId_idx" ON "MiceDelegate"("userId");

CREATE TYPE "MiceBookingKind" AS ENUM ('FLIGHT', 'HOTEL', 'TRANSFER', 'OTHER');

CREATE TABLE IF NOT EXISTS "MiceBookingShare" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "delegateId" TEXT,
    "sharedByUserId" TEXT NOT NULL,
    "kind" "MiceBookingKind" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiceBookingShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MiceBookingShare_eventId_bookingId_key" ON "MiceBookingShare"("eventId", "bookingId");
CREATE INDEX IF NOT EXISTS "MiceBookingShare_eventId_idx" ON "MiceBookingShare"("eventId");
CREATE INDEX IF NOT EXISTS "MiceBookingShare_bookingId_idx" ON "MiceBookingShare"("bookingId");
CREATE INDEX IF NOT EXISTS "MiceBookingShare_delegateId_idx" ON "MiceBookingShare"("delegateId");

CREATE TABLE IF NOT EXISTS "MiceTransfer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "delegateId" TEXT,
    "label" TEXT NOT NULL,
    "pickupAt" TIMESTAMP(3),
    "pickupLocation" TEXT,
    "dropoffLocation" TEXT,
    "notes" TEXT,
    "bookingId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiceTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MiceTransfer_eventId_idx" ON "MiceTransfer"("eventId");
CREATE INDEX IF NOT EXISTS "MiceTransfer_delegateId_idx" ON "MiceTransfer"("delegateId");

CREATE TABLE IF NOT EXISTS "MiceSponsor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT,
    "contactEmail" TEXT,
    "deliverables" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiceSponsor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MiceSponsor_eventId_idx" ON "MiceSponsor"("eventId");

CREATE TABLE IF NOT EXISTS "MiceBudgetLine" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "plannedMinor" INTEGER NOT NULL DEFAULT 0,
    "actualMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiceBudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MiceBudgetLine_eventId_idx" ON "MiceBudgetLine"("eventId");

DO $$ BEGIN
  ALTER TABLE "MiceBookingShare" ADD CONSTRAINT "MiceBookingShare_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MiceTransfer" ADD CONSTRAINT "MiceTransfer_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MiceSponsor" ADD CONSTRAINT "MiceSponsor_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MiceBudgetLine" ADD CONSTRAINT "MiceBudgetLine_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
