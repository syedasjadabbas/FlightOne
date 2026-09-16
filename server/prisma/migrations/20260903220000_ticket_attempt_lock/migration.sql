-- Module 03 — ticketing attempt lock for idempotent Travelport/RateHawk issue.
ALTER TABLE "Booking" ADD COLUMN "ticketAttemptId" TEXT;
CREATE UNIQUE INDEX "Booking_ticketAttemptId_key" ON "Booking"("ticketAttemptId");
