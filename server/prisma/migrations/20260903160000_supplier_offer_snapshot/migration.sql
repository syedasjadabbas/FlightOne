-- Module 03 — Supplier Offer Snapshot + Booking offer reference columns.
-- Adds the SupplierOfferSnapshot table and corresponding columns to Booking
-- so that every quote creation is traceable to a real persisted, user-scoped
-- supplier offer (TTL-gated, with full itinerary/fare reference payload).

-- 1. SupplierOfferSnapshot: one row per offer surfaced to a user from search.
CREATE TABLE "SupplierOfferSnapshot" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "supplierCode"      TEXT NOT NULL,
    "supplierOfferId"   TEXT NOT NULL,
    "product"           "BookingProduct" NOT NULL,
    "currency"          TEXT NOT NULL,
    "netMinor"          INTEGER NOT NULL,
    "supplierBookingRefs" JSONB,
    "ttlMs"             INTEGER NOT NULL,
    "expiresAt"         TIMESTAMP(3) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierOfferSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierOfferSnapshot"
    ADD CONSTRAINT "SupplierOfferSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SupplierOfferSnapshot_userId_idx" ON "SupplierOfferSnapshot"("userId");
CREATE INDEX "SupplierOfferSnapshot_supplierCode_supplierOfferId_idx"
    ON "SupplierOfferSnapshot"("supplierCode", "supplierOfferId");
CREATE INDEX "SupplierOfferSnapshot_expiresAt_idx" ON "SupplierOfferSnapshot"("expiresAt");

-- 2. Booking: add supplier offer reference columns.
ALTER TABLE "Booking"
    ADD COLUMN "supplierOfferSnapshotId" TEXT,
    ADD COLUMN "supplierOfferId"         TEXT,
    ADD COLUMN "supplierOfferCreatedAt"  TIMESTAMP(3),
    ADD COLUMN "supplierOfferTtlMs"      INTEGER,
    ADD COLUMN "supplierOfferExpiresAt"  TIMESTAMP(3),
    ADD COLUMN "supplierBookingRefs"     JSONB;
