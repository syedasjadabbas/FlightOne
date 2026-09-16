-- Module 02 foundation: identity documents, emergency contacts, travel prefs,
-- companion kind (family vs companion). Document numbers encrypted at app layer.

CREATE TYPE "CompanionKind" AS ENUM ('COMPANION', 'FAMILY');
CREATE TYPE "IdentityDocumentType" AS ENUM ('PASSPORT', 'NATIONAL_ID', 'VISA', 'RESIDENCE_PERMIT');
CREATE TYPE "IdentityDocumentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'EXPIRED');
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "TravellerProfile" ADD COLUMN "nationality" TEXT;
ALTER TABLE "TravellerProfile" ADD COLUMN "preferredCabin" TEXT;
ALTER TABLE "TravellerProfile" ADD COLUMN "maxLayoverMinutes" INTEGER;

ALTER TABLE "TravellerCompanion" ADD COLUMN "kind" "CompanionKind" NOT NULL DEFAULT 'COMPANION';

CREATE TABLE "TravellerIdentityDocument" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "profileUserId" TEXT,
    "companionId" TEXT,
    "type" "IdentityDocumentType" NOT NULL,
    "documentNumberEnc" TEXT,
    "countryCode" TEXT,
    "documentSubtype" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "vaultDocumentId" TEXT,
    "status" "IdentityDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" TEXT,
    "verificationStatus" "IdentityVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravellerIdentityDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TravellerIdentityDocument_ownerUserId_idx" ON "TravellerIdentityDocument"("ownerUserId");
CREATE INDEX "TravellerIdentityDocument_profileUserId_idx" ON "TravellerIdentityDocument"("profileUserId");
CREATE INDEX "TravellerIdentityDocument_companionId_idx" ON "TravellerIdentityDocument"("companionId");
CREATE INDEX "TravellerIdentityDocument_type_idx" ON "TravellerIdentityDocument"("type");
CREATE INDEX "TravellerIdentityDocument_expiresAt_idx" ON "TravellerIdentityDocument"("expiresAt");
CREATE INDEX "TravellerIdentityDocument_status_idx" ON "TravellerIdentityDocument"("status");
CREATE INDEX "EmergencyContact_profileUserId_idx" ON "EmergencyContact"("profileUserId");
CREATE INDEX "TravellerCompanion_ownerUserId_kind_idx" ON "TravellerCompanion"("ownerUserId", "kind");

ALTER TABLE "TravellerIdentityDocument" ADD CONSTRAINT "TravellerIdentityDocument_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravellerIdentityDocument" ADD CONSTRAINT "TravellerIdentityDocument_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "TravellerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravellerIdentityDocument" ADD CONSTRAINT "TravellerIdentityDocument_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "TravellerCompanion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "TravellerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
