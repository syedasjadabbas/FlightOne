-- Module 15 — Operations Platform (OpsOutboxEvent, AccountingEntry,
-- SupplierReconItem). See prisma/operations.prisma. Hand-written (not
-- `prisma migrate dev`) because this repo's shadow database can't currently
-- replay the full migration history cleanly (a pre-existing conflict
-- between concurrently-authored sibling migrations — see the note atop
-- 20260723120100_pricing_engine/migration.sql for the same situation on an
-- earlier module). This migration is scoped ONLY to the three tables this
-- module owns, applied directly against the dev database with `psql` and
-- recorded via `prisma migrate resolve --applied` rather than
-- `migrate dev`/`migrate deploy` needing the shadow DB to succeed first.

-- CreateEnum
CREATE TYPE "OpsOutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountingEntryType" AS ENUM ('REVENUE', 'COST', 'COMMISSION', 'REFUND');

-- CreateEnum
CREATE TYPE "SupplierReconStatus" AS ENUM ('OPEN', 'MATCHED', 'DISCREPANCY');

-- CreateTable
CREATE TABLE "OpsOutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OpsOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "OpsOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingEntry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "entryType" "AccountingEntryType" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReconItem" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "externalRef" TEXT,
    "bookingId" TEXT,
    "expectedMinor" INTEGER NOT NULL,
    "invoicedMinor" INTEGER,
    "status" "SupplierReconStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierReconItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsOutboxEvent_status_idx" ON "OpsOutboxEvent"("status");

-- CreateIndex
CREATE INDEX "OpsOutboxEvent_type_idx" ON "OpsOutboxEvent"("type");

-- CreateIndex
CREATE INDEX "OpsOutboxEvent_createdAt_idx" ON "OpsOutboxEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AccountingEntry_bookingId_idx" ON "AccountingEntry"("bookingId");

-- CreateIndex
CREATE INDEX "SupplierReconItem_status_idx" ON "SupplierReconItem"("status");

-- CreateIndex
CREATE INDEX "SupplierReconItem_supplierCode_idx" ON "SupplierReconItem"("supplierCode");
