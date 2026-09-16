-- Module 06 — Corporate invoicing (PRD: "Corporate invoicing").
-- Per-company sequence + invoice snapshot from authoritative Booking amounts.
-- No Booking FK (scalar bookingId, same pattern as ApprovalRequest).

CREATE TYPE "CorporateInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');

CREATE TABLE IF NOT EXISTS "CorporateInvoiceSequence" (
    "companyId" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CorporateInvoiceSequence_pkey" PRIMARY KEY ("companyId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CorporateInvoiceSequence_companyId_fkey'
  ) THEN
    ALTER TABLE "CorporateInvoiceSequence"
      ADD CONSTRAINT "CorporateInvoiceSequence_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CorporateInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "CorporateInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" TEXT NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "marginMinor" INTEGER NOT NULL,
    "billingCycle" TEXT,
    "companyName" TEXT NOT NULL,
    "projectCode" TEXT,
    "projectCodeName" TEXT,
    "product" TEXT,
    "externalRef" TEXT,
    "travellerName" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CorporateInvoice_invoiceNumber_key"
  ON "CorporateInvoice"("invoiceNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "CorporateInvoice_companyId_bookingId_key"
  ON "CorporateInvoice"("companyId", "bookingId");

CREATE INDEX IF NOT EXISTS "CorporateInvoice_companyId_idx" ON "CorporateInvoice"("companyId");
CREATE INDEX IF NOT EXISTS "CorporateInvoice_bookingId_idx" ON "CorporateInvoice"("bookingId");
CREATE INDEX IF NOT EXISTS "CorporateInvoice_status_idx" ON "CorporateInvoice"("status");
CREATE INDEX IF NOT EXISTS "CorporateInvoice_issuedAt_idx" ON "CorporateInvoice"("issuedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CorporateInvoice_companyId_fkey'
  ) THEN
    ALTER TABLE "CorporateInvoice"
      ADD CONSTRAINT "CorporateInvoice_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
