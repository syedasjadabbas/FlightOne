-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('QUOTED', 'RESERVED', 'TICKETED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BookingProduct" AS ENUM ('FLIGHT', 'HOTEL', 'PACKAGE');

-- CreateEnum
CREATE TYPE "BookingActor" AS ENUM ('AI', 'CUSTOMER', 'AGENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'QUOTED',
    "product" "BookingProduct" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "marginMinor" INTEGER NOT NULL,
    "supplierCode" TEXT,
    "externalRef" TEXT,
    "idempotencyKey" TEXT,
    "quoteExpiresAt" TIMESTAMP(3),
    "reservedUntil" TIMESTAMP(3),
    "travellerSnapshot" JSONB,
    "fareRules" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTransition" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actor" "BookingActor" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "BookingTransition_bookingId_idx" ON "BookingTransition"("bookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTransition" ADD CONSTRAINT "BookingTransition_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
