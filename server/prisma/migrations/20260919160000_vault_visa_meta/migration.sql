-- Phase 2 Visa Vault — structured visa metadata on VaultDocument (type=VISA).
-- Embassy/processing/required-document facts stay in Module 08 VisaRequirement;
-- this table stores traveller-owned visa facts only.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VaultVisaHolderStatus" AS ENUM ('ISSUED', 'PENDING', 'IN_PROCESS', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "VaultVisaRecord" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "destinationCode" TEXT,
    "visaType" TEXT,
    "holderStatus" "VaultVisaHolderStatus" NOT NULL DEFAULT 'ISSUED',
    "visaApplicationId" TEXT,
    "appointmentAt" TIMESTAMP(3),
    "appointmentLocation" TEXT,
    "issuingAuthority" TEXT,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultVisaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaultVisaRecord_documentId_key" ON "VaultVisaRecord"("documentId");

-- CreateIndex
CREATE INDEX "VaultVisaRecord_destinationCode_idx" ON "VaultVisaRecord"("destinationCode");

-- CreateIndex
CREATE INDEX "VaultVisaRecord_visaApplicationId_idx" ON "VaultVisaRecord"("visaApplicationId");

-- CreateIndex
CREATE INDEX "VaultVisaRecord_holderStatus_idx" ON "VaultVisaRecord"("holderStatus");

-- AddForeignKey
ALTER TABLE "VaultVisaRecord" ADD CONSTRAINT "VaultVisaRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "VaultDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
