-- Module 06 — company-scoped project codes (PRD: Corporate Travel "Project codes").
-- Unique within a company; soft-deactivate via isActive. No Booking FK —
-- association is metadata.projectCodeId (same pattern as metadata.companyId).

CREATE TABLE IF NOT EXISTS "ProjectCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCode_companyId_code_key" ON "ProjectCode"("companyId", "code");

CREATE INDEX IF NOT EXISTS "ProjectCode_companyId_idx" ON "ProjectCode"("companyId");

CREATE INDEX IF NOT EXISTS "ProjectCode_companyId_isActive_idx" ON "ProjectCode"("companyId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectCode_companyId_fkey'
  ) THEN
    ALTER TABLE "ProjectCode"
      ADD CONSTRAINT "ProjectCode_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
