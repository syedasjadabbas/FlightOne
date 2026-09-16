-- Module 11 — Group Travel + Module 12 — MICE Platform (Phase 2). See
-- prisma/groups.prisma. Hand-written (not `prisma migrate dev`) because
-- this repo's shadow database can't currently replay the full migration
-- history cleanly (a pre-existing conflict between concurrently-authored
-- sibling migrations — see the note atop 20260723120100_pricing_engine/
-- migration.sql, 20260723130000_operations_platform/migration.sql,
-- 20260723140000_corporate_travel/migration.sql, and
-- 20260723150000_traveller_vault/migration.sql for the same situation on
-- earlier modules). This migration is scoped ONLY to the nine tables this
-- module owns (TravelGroup, GroupMember, GroupAnnouncement, GroupPoll,
-- GroupPollVote, MiceEvent, MiceDelegate, MiceSession, MiceCheckIn),
-- applied directly against the dev database with `psql` and recorded via
-- `prisma migrate resolve --applied` rather than `migrate dev`/
-- `migrate deploy` needing the shadow DB to succeed first.

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('CORPORATE_TOUR', 'STUDENT', 'UMRAH_HAJJ', 'LEISURE', 'SPORTS', 'FAMILY', 'OTHER');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('ORGANIZER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "MiceEventType" AS ENUM ('MEETING', 'INCENTIVE', 'CONFERENCE', 'EXHIBITION');

-- CreateEnum
CREATE TYPE "MiceRegistrationStatus" AS ENUM ('PENDING', 'REGISTERED', 'CHECKED_IN', 'CANCELLED');

-- CreateTable
CREATE TABLE "TravelGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAnnouncement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPoll" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiceEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "type" "MiceEventType" NOT NULL,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "budgetMinor" INTEGER,
    "currency" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiceDelegate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "registrationStatus" "MiceRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "badgeCode" TEXT NOT NULL,
    "dietary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiceDelegate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiceSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "track" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiceCheckIn" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL DEFAULT '',
    "delegateId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'QR',

    CONSTRAINT "MiceCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelGroup_inviteCode_key" ON "TravelGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "TravelGroup_createdByUserId_idx" ON "TravelGroup"("createdByUserId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupAnnouncement_groupId_idx" ON "GroupAnnouncement"("groupId");

-- CreateIndex
CREATE INDEX "GroupPoll_groupId_idx" ON "GroupPoll"("groupId");

-- CreateIndex
CREATE INDEX "GroupPollVote_pollId_idx" ON "GroupPollVote"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPollVote_pollId_userId_key" ON "GroupPollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "MiceEvent_groupId_idx" ON "MiceEvent"("groupId");

-- CreateIndex
CREATE INDEX "MiceEvent_createdByUserId_idx" ON "MiceEvent"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MiceDelegate_badgeCode_key" ON "MiceDelegate"("badgeCode");

-- CreateIndex
CREATE INDEX "MiceDelegate_eventId_idx" ON "MiceDelegate"("eventId");

-- CreateIndex
CREATE INDEX "MiceDelegate_email_idx" ON "MiceDelegate"("email");

-- CreateIndex
CREATE INDEX "MiceSession_eventId_idx" ON "MiceSession"("eventId");

-- CreateIndex
CREATE INDEX "MiceCheckIn_eventId_idx" ON "MiceCheckIn"("eventId");

-- CreateIndex
CREATE INDEX "MiceCheckIn_sessionId_idx" ON "MiceCheckIn"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MiceCheckIn_delegateId_eventId_sessionId_key" ON "MiceCheckIn"("delegateId", "eventId", "sessionId");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAnnouncement" ADD CONSTRAINT "GroupAnnouncement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPoll" ADD CONSTRAINT "GroupPoll_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPollVote" ADD CONSTRAINT "GroupPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "GroupPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceEvent" ADD CONSTRAINT "MiceEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceDelegate" ADD CONSTRAINT "MiceDelegate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceSession" ADD CONSTRAINT "MiceSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceCheckIn" ADD CONSTRAINT "MiceCheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiceCheckIn" ADD CONSTRAINT "MiceCheckIn_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "MiceDelegate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
