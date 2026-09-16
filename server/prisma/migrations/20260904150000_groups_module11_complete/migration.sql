-- Module 11 — Group Travel completion (invitations, itinerary shares, vault shares,
-- attendance, gallery, trip memories, emergency flag on announcements).

-- Expand GroupMemberStatus with DECLINED
DO $$ BEGIN
  ALTER TYPE "GroupMemberStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE "GroupAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');
CREATE TYPE "GroupTripMemoryStatus" AS ENUM ('GROUNDED', 'INSUFFICIENT_DATA');

ALTER TABLE "GroupAnnouncement" ADD COLUMN IF NOT EXISTS "isEmergency" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "GroupAnnouncement_createdAt_idx" ON "GroupAnnouncement"("createdAt");

CREATE TABLE IF NOT EXISTS "GroupBookingShare" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupBookingShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupBookingShare_groupId_bookingId_key" ON "GroupBookingShare"("groupId", "bookingId");
CREATE INDEX IF NOT EXISTS "GroupBookingShare_groupId_idx" ON "GroupBookingShare"("groupId");
CREATE INDEX IF NOT EXISTS "GroupBookingShare_bookingId_idx" ON "GroupBookingShare"("bookingId");
CREATE INDEX IF NOT EXISTS "GroupBookingShare_sharedByUserId_idx" ON "GroupBookingShare"("sharedByUserId");

CREATE TABLE IF NOT EXISTS "GroupDocumentShare" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "vaultDocumentId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupDocumentShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupDocumentShare_groupId_vaultDocumentId_key" ON "GroupDocumentShare"("groupId", "vaultDocumentId");
CREATE INDEX IF NOT EXISTS "GroupDocumentShare_groupId_idx" ON "GroupDocumentShare"("groupId");
CREATE INDEX IF NOT EXISTS "GroupDocumentShare_vaultDocumentId_idx" ON "GroupDocumentShare"("vaultDocumentId");

CREATE TABLE IF NOT EXISTS "GroupAttendanceWaypoint" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupAttendanceWaypoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GroupAttendanceWaypoint_groupId_idx" ON "GroupAttendanceWaypoint"("groupId");

CREATE TABLE IF NOT EXISTS "GroupAttendanceRecord" (
    "id" TEXT NOT NULL,
    "waypointId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GroupAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupAttendanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupAttendanceRecord_waypointId_userId_key" ON "GroupAttendanceRecord"("waypointId", "userId");
CREATE INDEX IF NOT EXISTS "GroupAttendanceRecord_groupId_idx" ON "GroupAttendanceRecord"("groupId");
CREATE INDEX IF NOT EXISTS "GroupAttendanceRecord_userId_idx" ON "GroupAttendanceRecord"("userId");

CREATE TABLE IF NOT EXISTS "GroupPhoto" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "caption" TEXT,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GroupPhoto_groupId_idx" ON "GroupPhoto"("groupId");

CREATE TABLE IF NOT EXISTS "GroupTripMemory" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "status" "GroupTripMemoryStatus" NOT NULL DEFAULT 'GROUNDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupTripMemory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GroupTripMemory_groupId_idx" ON "GroupTripMemory"("groupId");

DO $$ BEGIN
  ALTER TABLE "GroupBookingShare" ADD CONSTRAINT "GroupBookingShare_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GroupDocumentShare" ADD CONSTRAINT "GroupDocumentShare_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GroupAttendanceWaypoint" ADD CONSTRAINT "GroupAttendanceWaypoint_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GroupAttendanceRecord" ADD CONSTRAINT "GroupAttendanceRecord_waypointId_fkey"
    FOREIGN KEY ("waypointId") REFERENCES "GroupAttendanceWaypoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GroupPhoto" ADD CONSTRAINT "GroupPhoto_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GroupTripMemory" ADD CONSTRAINT "GroupTripMemory_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
