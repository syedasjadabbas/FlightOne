-- Module 00: device/session metadata on refresh tokens (list + revoke UI).

ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "ip" TEXT;

UPDATE "RefreshToken" SET "lastUsedAt" = "createdAt" WHERE "lastUsedAt" IS NULL;

ALTER TABLE "RefreshToken" ALTER COLUMN "lastUsedAt" SET NOT NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "lastUsedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
