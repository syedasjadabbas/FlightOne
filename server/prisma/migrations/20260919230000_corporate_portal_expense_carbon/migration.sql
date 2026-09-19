-- Phase 3 P3-03 — white-label portal, expenses, carbon estimates.

CREATE TABLE IF NOT EXISTS "CompanyPortal" (
    "companyId" TEXT NOT NULL,
    "portalName" TEXT NOT NULL,
    "displayName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hostname" TEXT,
    "domainStatus" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
    "domainVerificationToken" TEXT,
    "domainVerifiedAt" TIMESTAMP(3),
    "domainReason" TEXT,
    "ssoProviderType" TEXT,
    "ssoIssuer" TEXT,
    "ssoClientId" TEXT,
    "ssoClientSecretEnc" TEXT,
    "ssoMetadataUrl" TEXT,
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ssoStatus" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
    "ssoReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPortal_pkey" PRIMARY KEY ("companyId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPortal_hostname_key" ON "CompanyPortal"("hostname");

CREATE TABLE IF NOT EXISTS "PerDiemPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dailyAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerDiemPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PerDiemPolicy_companyId_idx" ON "PerDiemPolicy"("companyId");

CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REIMBURSEMENT_PENDING', 'REIMBURSED');
CREATE TYPE "ExpenseOcrStatus" AS ENUM ('UNCONFIGURED', 'UNPROCESSED', 'PROCESSED', 'FAILED');

CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "bookingId" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "merchant" TEXT,
    "description" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "perDiemPolicyId" TEXT,
    "perDiemAmountMinor" INTEGER,
    "perDiemConfigured" BOOLEAN NOT NULL DEFAULT false,
    "ocrStatus" "ExpenseOcrStatus" NOT NULL DEFAULT 'UNCONFIGURED',
    "ocrProvider" TEXT,
    "ocrExtracted" JSONB,
    "ocrProvenance" JSONB,
    "receiptStorageKey" TEXT,
    "receiptContentType" TEXT,
    "receiptByteSize" INTEGER,
    "receiptOriginalFilename" TEXT,
    "reimbursementExportedAt" TIMESTAMP(3),
    "reimbursementExportKind" TEXT,
    "approverUserId" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Expense_companyId_idx" ON "Expense"("companyId");
CREATE INDEX IF NOT EXISTS "Expense_ownerUserId_idx" ON "Expense"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Expense_status_idx" ON "Expense"("status");
CREATE INDEX IF NOT EXISTS "Expense_bookingId_idx" ON "Expense"("bookingId");

CREATE TABLE IF NOT EXISTS "CarbonEstimate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "gramsCo2e" INTEGER,
    "methodCode" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "inputs" JSONB,
    "reason" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarbonEstimate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CarbonEstimate_bookingId_key" ON "CarbonEstimate"("bookingId");
CREATE INDEX IF NOT EXISTS "CarbonEstimate_companyId_idx" ON "CarbonEstimate"("companyId");
CREATE INDEX IF NOT EXISTS "CarbonEstimate_companyId_calculatedAt_idx" ON "CarbonEstimate"("companyId", "calculatedAt");

ALTER TABLE "CompanyPortal" ADD CONSTRAINT "CompanyPortal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerDiemPolicy" ADD CONSTRAINT "PerDiemPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarbonEstimate" ADD CONSTRAINT "CarbonEstimate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
