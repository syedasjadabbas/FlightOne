-- Module 15 — complete internal accounting/finance + commission context.
-- PAYMENT/MARGIN/CREDIT entry types; company/supplier context; reporting indexes.

DO $$ BEGIN
  ALTER TYPE "AccountingEntryType" ADD VALUE IF NOT EXISTS 'PAYMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AccountingEntryType" ADD VALUE IF NOT EXISTS 'MARGIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AccountingEntryType" ADD VALUE IF NOT EXISTS 'CREDIT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AccountingEntry"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierCode" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

CREATE INDEX IF NOT EXISTS "AccountingEntry_companyId_idx" ON "AccountingEntry"("companyId");
CREATE INDEX IF NOT EXISTS "AccountingEntry_userId_idx" ON "AccountingEntry"("userId");
CREATE INDEX IF NOT EXISTS "AccountingEntry_paymentId_idx" ON "AccountingEntry"("paymentId");
CREATE INDEX IF NOT EXISTS "AccountingEntry_currency_entryType_idx" ON "AccountingEntry"("currency", "entryType");

ALTER TABLE "CommissionRecord"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierCode" TEXT;

CREATE INDEX IF NOT EXISTS "CommissionRecord_companyId_idx" ON "CommissionRecord"("companyId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_userId_idx" ON "CommissionRecord"("userId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_currency_idx" ON "CommissionRecord"("currency");
