-- Module 06 — Corporate Travel (Company, CompanyMembership, TravelPolicy,
-- ApprovalRequest). See prisma/corporate.prisma. Hand-written (not
-- `prisma migrate dev`) because this repo's shadow database can't currently
-- replay the full migration history cleanly (a pre-existing conflict
-- between concurrently-authored sibling migrations — see the note atop
-- 20260723120100_pricing_engine/migration.sql and
-- 20260723130000_operations_platform/migration.sql for the same situation
-- on earlier modules). This migration is scoped ONLY to the four tables
-- this module owns, applied directly against the dev database with `psql`
-- and recorded via `prisma migrate resolve --applied` rather than
-- `migrate dev`/`migrate deploy` needing the shadow DB to succeed first.

-- CreateEnum
CREATE TYPE "CompanyMembershipRole" AS ENUM ('MEMBER', 'APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditLimitMinor" INTEGER NOT NULL,
    "creditUsedMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "billingCycle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CompanyMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "department" TEXT,
    "costCentre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxCabin" TEXT,
    "maxAmountMinor" INTEGER,
    "preferredAirlines" JSONB,
    "advanceBookingDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "policyViolation" JSONB,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "approverUserId" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_idx" ON "CompanyMembership"("companyId");

-- CreateIndex
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key" ON "CompanyMembership"("companyId", "userId");

-- CreateIndex
CREATE INDEX "TravelPolicy_companyId_idx" ON "TravelPolicy"("companyId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_companyId_idx" ON "ApprovalRequest"("companyId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_bookingId_idx" ON "ApprovalRequest"("bookingId");

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPolicy" ADD CONSTRAINT "TravelPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
