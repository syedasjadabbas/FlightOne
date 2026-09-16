-- Module 03 — tokenized Payment table + booking reservation attempt lock.

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'VOIDED');
CREATE TYPE "PaymentProvider" AS ENUM ('UNCONFIGURED', 'STRIPE', 'CORPORATE_CREDIT', 'SIMULATED');

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "providerPaymentId" TEXT,
    "paymentMethodToken" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Payment_bookingId_idempotencyKey_key" ON "Payment"("bookingId", "idempotencyKey");
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

ALTER TABLE "Booking" ADD COLUMN "reservationAttemptId" TEXT;
CREATE UNIQUE INDEX "Booking_reservationAttemptId_key" ON "Booking"("reservationAttemptId");
