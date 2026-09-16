-- Module 09 — Live Journey Management (Phase 2). Scoped to journey tables only.

-- CreateEnum
CREATE TYPE "JourneyEventType" AS ENUM ('DELAY', 'CANCELLED', 'GATE_CHANGE', 'TERMINAL_CHANGE', 'BOARDING', 'WEATHER', 'IMMIGRATION', 'HOTEL_CHECKIN', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "JourneyWatchStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('APP', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "JourneyWatch" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JourneyWatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "flightNumber" TEXT,
    "departAt" TIMESTAMP(3),
    "arriveAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyEvent" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "type" "JourneyEventType" NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyWatch_status_idx" ON "JourneyWatch"("status");

-- CreateIndex
CREATE INDEX "JourneyWatch_bookingId_idx" ON "JourneyWatch"("bookingId");

-- CreateIndex
CREATE INDEX "JourneyWatch_userId_idx" ON "JourneyWatch"("userId");

-- CreateIndex
CREATE INDEX "JourneyWatch_departAt_idx" ON "JourneyWatch"("departAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_watchId_idx" ON "JourneyEvent"("watchId");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_idx" ON "NotificationOutbox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_channel_key" ON "NotificationOutbox"("dedupeKey", "channel");

-- AddForeignKey
ALTER TABLE "JourneyEvent" ADD CONSTRAINT "JourneyEvent_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "JourneyWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
