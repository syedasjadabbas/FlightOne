-- Module 05 — Pricing & Margin Engine (MarkupRule, PromoCode, PricingConfig).
-- See prisma/pricing.prisma. Hand-written (not `prisma migrate dev`) because
-- this repo has other modules' schema changes in flight concurrently — this
-- migration touches ONLY the three tables this module owns, nothing else.
--
-- NOTE: by the time this migration was ready to apply, a concurrently-running
-- sibling `prisma migrate dev` (Module 16 — "20260723065914_knowledge") had
-- already picked up prisma/pricing.prisma from disk and created these same
-- three tables as a side effect of ITS migration (the multi-agent-concurrency
-- version of the "tables already exist" case this file's approach is meant
-- to handle). The SQL below is kept as accurate documentation of what this
-- module owns and migrates going forward; this migration was recorded via
-- `prisma migrate resolve --applied` rather than executed, since re-running
-- these CREATE TABLE statements would fail against the already-applied state.

-- CreateTable
CREATE TABLE "MarkupRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "routePattern" TEXT,
    "supplierCode" TEXT,
    "cabin" TEXT,
    "segment" TEXT,
    "markupBps" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkupRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "key" TEXT NOT NULL,
    "valueInt" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "MarkupRule_isActive_priority_idx" ON "MarkupRule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "MarkupRule_routePattern_idx" ON "MarkupRule"("routePattern");

-- CreateIndex
CREATE INDEX "MarkupRule_supplierCode_idx" ON "MarkupRule"("supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");
