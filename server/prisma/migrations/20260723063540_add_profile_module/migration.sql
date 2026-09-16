-- Module 02 — Customer Identity & Profile (modules/profile/)

-- CreateEnum
CREATE TYPE "LoyaltyProgramType" AS ENUM ('AIRLINE', 'HOTEL');

-- CreateTable
CREATE TABLE "TravellerProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "seatPref" TEXT,
    "mealPref" TEXT,
    "preferredAirlines" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravellerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TravellerCompanion" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravellerCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyMembership" (
    "id" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "type" "LoyaltyProgramType" NOT NULL,
    "programCode" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravellerCompanion_ownerUserId_idx" ON "TravellerCompanion"("ownerUserId");

-- CreateIndex
CREATE INDEX "LoyaltyMembership_profileUserId_idx" ON "LoyaltyMembership"("profileUserId");

-- AddForeignKey
ALTER TABLE "TravellerProfile" ADD CONSTRAINT "TravellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravellerCompanion" ADD CONSTRAINT "TravellerCompanion_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyMembership" ADD CONSTRAINT "LoyaltyMembership_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "TravellerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
