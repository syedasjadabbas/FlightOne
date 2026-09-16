-- Session family for refresh rotation + reuse detection (Module 00 hardening).
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "familyId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;

-- Existing rows: each token is its own family (no rotation history).
UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;

ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
