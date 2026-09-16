-- Module 07 — Vault binary storage metadata + national-id document types.

DO $$ BEGIN
  ALTER TYPE "VaultDocType" ADD VALUE 'NATIONAL_ID';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "VaultDocType" ADD VALUE 'RESIDENCE_PERMIT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "VaultDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "VaultDocument" ADD COLUMN IF NOT EXISTS "contentType" TEXT;
ALTER TABLE "VaultDocument" ADD COLUMN IF NOT EXISTS "byteSize" INTEGER;
ALTER TABLE "VaultDocument" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT;
ALTER TABLE "VaultDocument" ADD COLUMN IF NOT EXISTS "contentSha256" TEXT;

CREATE INDEX IF NOT EXISTS "VaultDocument_storageKey_idx" ON "VaultDocument"("storageKey");
