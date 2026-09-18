-- Module 03 — Local payment providers (JazzCash, Easypaisa, 1Link IBFT) & Payment metadata.
-- Preserves SAQ-A / PCI DSS compliance; never creates duplicate types.

ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'REWARD_CREDIT';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'JAZZCASH';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'EASYPAISA';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'ONELINK_IBFT';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
