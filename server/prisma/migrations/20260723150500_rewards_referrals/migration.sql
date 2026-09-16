-- Module 10 — Rewards & Referrals (RewardAccount, RewardLedgerEntry,
-- ReferralAttribution). See prisma/rewards.prisma. Scoped to only the three
-- tables this module owns — generated via `prisma migrate diff --from-empty
-- --to-schema-datamodel <rewards-only schema>` against an isolated temp
-- schema (generator/datasource + prisma/rewards.prisma only) so the diff
-- engine never sees other modules' concurrently-in-flight schema files
-- (prisma/visa.prisma, prisma/groups.prisma, etc.) and can't accidentally
-- pull their pending tables into this migration (same technique as
-- 20260723130000_refunds_reissue_engine).
--
-- No foreign keys into Booking/User (see prisma/rewards.prisma header for
-- why) — the only FK here is RewardLedgerEntry.accountId -> RewardAccount,
-- both owned by this module.

-- CreateEnum
CREATE TYPE "RewardLedgerType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'REVERSE', 'REFERRAL_BONUS');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateTable
CREATE TABLE "RewardAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredByUserId" TEXT,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "RewardLedgerType" NOT NULL,
    "points" INTEGER NOT NULL,
    "bookingId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "signupAt" TIMESTAMP(3) NOT NULL,
    "firstBookingId" TEXT,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardAccount_userId_key" ON "RewardAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAccount_referralCode_key" ON "RewardAccount"("referralCode");

-- CreateIndex
CREATE INDEX "RewardAccount_referredByUserId_idx" ON "RewardAccount"("referredByUserId");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_accountId_idx" ON "RewardLedgerEntry"("accountId");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_bookingId_idx" ON "RewardLedgerEntry"("bookingId");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_type_idx" ON "RewardLedgerEntry"("type");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_createdAt_idx" ON "RewardLedgerEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referrerUserId_idx" ON "ReferralAttribution"("referrerUserId");

-- AddForeignKey
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RewardAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
