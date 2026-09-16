-- Module 02 identity document lifecycle: verification audit + OCR review fields.

ALTER TABLE "TravellerIdentityDocument" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "TravellerIdentityDocument" ADD COLUMN "verifiedByUserId" TEXT;
ALTER TABLE "TravellerIdentityDocument" ADD COLUMN "verificationNote" TEXT;
ALTER TABLE "TravellerIdentityDocument" ADD COLUMN "ocrExtract" JSONB;
ALTER TABLE "TravellerIdentityDocument" ADD COLUMN "ocrExtractedAt" TIMESTAMP(3);
ALTER TABLE "TravellerIdentityDocument" ADD COLUMN "ocrProvider" TEXT;

CREATE INDEX "TravellerIdentityDocument_verificationStatus_idx" ON "TravellerIdentityDocument"("verificationStatus");
