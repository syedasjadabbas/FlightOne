-- Module 16 complete — lifecycle, visibility, PRD categories, versioning key.
-- Note: new enum values are added here but NOT used in UPDATEs in this same
-- transaction (Postgres requires a commit before using newly added enum labels).
-- Legacy categories VISA/CORPORATE/OTHER remain valid; app maps them on write.

DO $$ BEGIN
  ALTER TYPE "KnowledgeCategory" ADD VALUE IF NOT EXISTS 'SUPPLIER_RULE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "KnowledgeCategory" ADD VALUE IF NOT EXISTS 'CORPORATE_TRAVEL_POLICY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "KnowledgeCategory" ADD VALUE IF NOT EXISTS 'VISA_RULE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "KnowledgeCategory" ADD VALUE IF NOT EXISTS 'VISA_PROCEDURE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "KnowledgeCategory" ADD VALUE IF NOT EXISTS 'CORPORATE_AGREEMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KnowledgeVisibility" AS ENUM ('CUSTOMER_SAFE', 'INTERNAL', 'RESTRICTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KnowledgeIngestionStatus" AS ENUM ('READY', 'PENDING', 'FAILED', 'UNSUPPORTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "KnowledgeDocument"
  ADD COLUMN IF NOT EXISTS "documentKey" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ingestionStatus" "KnowledgeIngestionStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS "ingestionError" TEXT;

UPDATE "KnowledgeDocument"
SET "documentKey" = "id"
WHERE "documentKey" IS NULL;

UPDATE "KnowledgeDocument"
SET "status" = CASE WHEN "isActive" = true THEN 'PUBLISHED'::"KnowledgeStatus" ELSE 'ARCHIVED'::"KnowledgeStatus" END
WHERE "isActive" = true OR "isActive" = false;

ALTER TABLE "KnowledgeDocument" ALTER COLUMN "documentKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocument_documentKey_version_key"
  ON "KnowledgeDocument"("documentKey", "version");

CREATE INDEX IF NOT EXISTS "KnowledgeDocument_documentKey_idx" ON "KnowledgeDocument"("documentKey");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_visibility_idx" ON "KnowledgeDocument"("visibility");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_expiresAt_idx" ON "KnowledgeDocument"("expiresAt");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_effectiveFrom_idx" ON "KnowledgeDocument"("effectiveFrom");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_ordinal_idx" ON "KnowledgeChunk"("ordinal");
