-- Module 08 -- Visa Intelligence (VisaRequirement, VisaApplication). See
-- prisma/visa.prisma. Hand-written (not `prisma migrate dev`) because this
-- repo's shadow database can't currently replay the full migration history
-- cleanly (a pre-existing conflict between concurrently-authored sibling
-- migrations -- see the note atop 20260723120100_pricing_engine/migration.sql,
-- 20260723130000_operations_platform/migration.sql,
-- 20260723140000_corporate_travel/migration.sql, and
-- 20260723150000_traveller_vault/migration.sql for the same situation on
-- earlier modules). This migration is scoped ONLY to the two tables this
-- module owns, applied directly against the dev database with `psql` and
-- recorded via `prisma migrate resolve --applied` rather than
-- `migrate dev`/`migrate deploy` needing the shadow DB to succeed first.

-- No foreign keys into User (see prisma/visa.prisma header for why).

-- CreateEnum
CREATE TYPE "VisaCategory" AS ENUM ('VISA_FREE', 'VOA', 'E_VISA', 'EMBASSY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VisaApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROCESS', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "VisaRequirement" (
    "id" TEXT NOT NULL,
    "nationalityCode" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "category" "VisaCategory" NOT NULL,
    "transitNotes" TEXT,
    "requiredDocuments" JSONB,
    "embassyInfo" JSONB,
    "processingDaysMin" INTEGER,
    "processingDaysMax" INTEGER,
    "source" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nationalityCode" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "category" "VisaCategory",
    "status" "VisaApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "appointmentAt" TIMESTAMP(3),
    "appointmentLocation" TEXT,
    "checklist" JSONB,
    "vaultDocumentIds" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisaRequirement_nationalityCode_destinationCode_key" ON "VisaRequirement"("nationalityCode", "destinationCode");

-- CreateIndex
CREATE INDEX "VisaRequirement_destinationCode_idx" ON "VisaRequirement"("destinationCode");

-- CreateIndex
CREATE INDEX "VisaRequirement_isActive_idx" ON "VisaRequirement"("isActive");

-- CreateIndex
CREATE INDEX "VisaApplication_userId_idx" ON "VisaApplication"("userId");

-- CreateIndex
CREATE INDEX "VisaApplication_status_idx" ON "VisaApplication"("status");
