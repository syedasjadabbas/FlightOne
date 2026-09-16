-- Module 07 — Traveller Vault (VaultDocument, VaultShareLink). See
-- prisma/vault.prisma. Hand-written (not `prisma migrate dev`) because this
-- repo's shadow database can't currently replay the full migration history
-- cleanly (a pre-existing conflict between concurrently-authored sibling
-- migrations — see the note atop 20260723120100_pricing_engine/migration.sql,
-- 20260723130000_operations_platform/migration.sql, and
-- 20260723140000_corporate_travel/migration.sql for the same situation on
-- earlier modules). This migration is scoped ONLY to the two tables this
-- module owns, applied directly against the dev database with `psql` and
-- recorded via `prisma migrate resolve --applied` rather than
-- `migrate dev`/`migrate deploy` needing the shadow DB to succeed first.

-- CreateEnum
CREATE TYPE "VaultDocType" AS ENUM ('PASSPORT', 'VISA', 'TICKET', 'HOTEL_VOUCHER', 'INSURANCE', 'FF_CARD', 'LOYALTY_CARD', 'TRAVEL_CERT', 'OTHER');

-- CreateTable
CREATE TABLE "VaultDocument" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "companionId" TEXT,
    "type" "VaultDocType" NOT NULL,
    "title" TEXT NOT NULL,
    "bookingId" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "fileMeta" JSONB,
    "encryptedNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultShareLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultDocument_ownerUserId_idx" ON "VaultDocument"("ownerUserId");

-- CreateIndex
CREATE INDEX "VaultDocument_type_idx" ON "VaultDocument"("type");

-- CreateIndex
CREATE INDEX "VaultDocument_expiresAt_idx" ON "VaultDocument"("expiresAt");

-- CreateIndex
CREATE INDEX "VaultDocument_bookingId_idx" ON "VaultDocument"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultShareLink_tokenHash_key" ON "VaultShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "VaultShareLink_documentId_idx" ON "VaultShareLink"("documentId");

-- AddForeignKey
ALTER TABLE "VaultShareLink" ADD CONSTRAINT "VaultShareLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "VaultDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
