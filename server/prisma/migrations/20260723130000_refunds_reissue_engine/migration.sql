-- Module 14 — Refund & Reissue Engine (RefundCalculation, RefundCase).
-- See prisma/refunds.prisma. Scoped to only the two tables this module
-- owns — generated via `prisma migrate diff --from-empty
-- --to-schema-datamodel <refunds-only schema>` against an isolated temp
-- schema (generator/datasource + prisma/refunds.prisma only) so the diff
-- engine never sees other modules' concurrently-in-flight schema files
-- (prisma/corporate.prisma, prisma/operations.prisma, etc.) and can't
-- accidentally pull their pending tables into this migration.
--
-- No foreign keys into Booking/User (see prisma/refunds.prisma header for
-- why) — the only FK here is RefundCase.calculationId -> RefundCalculation,
-- both owned by this module.

-- CreateEnum
CREATE TYPE "RefundCaseStatus" AS ENUM ('DRAFT', 'QUOTED', 'SUBMITTED', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "RefundCalculation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "grossPaidMinor" INTEGER NOT NULL,
    "supplierPenaltyMinor" INTEGER NOT NULL,
    "agencyFeeMinor" INTEGER NOT NULL,
    "refundableMinor" INTEGER NOT NULL,
    "travelCreditMinor" INTEGER NOT NULL DEFAULT 0,
    "formula" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundCase" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "calculationId" TEXT,
    "status" "RefundCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RefundCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundCalculation_bookingId_idx" ON "RefundCalculation"("bookingId");

-- CreateIndex
CREATE INDEX "RefundCase_bookingId_idx" ON "RefundCase"("bookingId");

-- CreateIndex
CREATE INDEX "RefundCase_calculationId_idx" ON "RefundCase"("calculationId");

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "RefundCalculation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
