-- Module 14 Phase-2 — servicing engine extensions (fail-closed financials).

-- Expand refund case lifecycle
DO $$ BEGIN
  ALTER TYPE "RefundCaseStatus" ADD VALUE IF NOT EXISTS 'ELIGIBLE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "RefundCaseStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "RefundCaseStatus" ADD VALUE IF NOT EXISTS 'FAILED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "RefundCaseStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_HUMAN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "RefundCaseStatus" ADD VALUE IF NOT EXISTS 'NOT_ELIGIBLE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Servicing kinds for exchange / reissue / cancellation / schedule-change
DO $$ BEGIN
  CREATE TYPE "ServicingKind" AS ENUM (
    'REFUND',
    'PARTIAL_REFUND',
    'EXCHANGE',
    'REISSUE',
    'CANCELLATION',
    'SCHEDULE_CHANGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServicingRequestStatus" AS ENUM (
    'DRAFT',
    'CALCULATED',
    'REQUESTED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REQUIRES_HUMAN',
    'REJECTED',
    'NOT_ELIGIBLE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentRefundStatus" AS ENUM (
    'NONE',
    'PENDING_MANUAL',
    'VOIDED',
    'PROVIDER_REFUNDED',
    'FAILED',
    'UNSUPPORTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TravelCreditStatus" AS ENUM (
    'ISSUED',
    'PARTIALLY_USED',
    'USED',
    'EXPIRED',
    'REVERSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataAvailabilityStatus" AS ENUM (
    'OK',
    'DATA_UNAVAILABLE',
    'UNSUPPORTED',
    'PROVIDER_UNCONFIGURED',
    'REQUIRES_HUMAN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RefundCalculation"
  ADD COLUMN IF NOT EXISTS "nonRefundableMinor" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dataStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS "processingTimelineStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'DATA_UNAVAILABLE',
  ADD COLUMN IF NOT EXISTS "processingTimelineNote" TEXT,
  ADD COLUMN IF NOT EXISTS "product" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" "ServicingKind" NOT NULL DEFAULT 'REFUND';

ALTER TABLE "RefundCase"
  ADD COLUMN IF NOT EXISTS "kind" "ServicingKind" NOT NULL DEFAULT 'REFUND',
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentRefundStatus" "PaymentRefundStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "paymentRefundRef" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierOperationStatus" "DataAvailabilityStatus",
  ADD COLUMN IF NOT EXISTS "supplierOperationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "escalationId" TEXT,
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "RefundCase_idempotencyKey_key"
  ON "RefundCase"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "RefundCase_status_idx" ON "RefundCase"("status");
CREATE INDEX IF NOT EXISTS "RefundCase_kind_idx" ON "RefundCase"("kind");
CREATE INDEX IF NOT EXISTS "RefundCase_createdByUserId_idx" ON "RefundCase"("createdByUserId");

CREATE TABLE IF NOT EXISTS "TravelCredit" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sourceBookingId" TEXT NOT NULL,
  "refundCaseId" TEXT,
  "currency" TEXT NOT NULL,
  "amountMinor" INT NOT NULL,
  "remainingMinor" INT NOT NULL,
  "status" "TravelCreditStatus" NOT NULL DEFAULT 'ISSUED',
  "expiresAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "formula" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "TravelCredit_idempotencyKey_key" ON "TravelCredit"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "TravelCredit_userId_idx" ON "TravelCredit"("userId");
CREATE INDEX IF NOT EXISTS "TravelCredit_sourceBookingId_idx" ON "TravelCredit"("sourceBookingId");

CREATE TABLE IF NOT EXISTS "ServicingRequest" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "ServicingKind" NOT NULL,
  "status" "ServicingRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "calculationId" TEXT,
  "refundCaseId" TEXT,
  "journeyEventId" TEXT,
  "idempotencyKey" TEXT,
  "currency" TEXT,
  "fareDifferenceMinor" INT,
  "changePenaltyMinor" INT,
  "agencyFeeMinor" INT,
  "customerDueMinor" INT,
  "customerRefundMinor" INT,
  "dataStatus" "DataAvailabilityStatus" NOT NULL DEFAULT 'DATA_UNAVAILABLE',
  "formula" JSONB,
  "supplierResponse" JSONB,
  "reason" TEXT,
  "escalationId" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServicingRequest_idempotencyKey_key"
  ON "ServicingRequest"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ServicingRequest_bookingId_idx" ON "ServicingRequest"("bookingId");
CREATE INDEX IF NOT EXISTS "ServicingRequest_userId_idx" ON "ServicingRequest"("userId");
CREATE INDEX IF NOT EXISTS "ServicingRequest_status_idx" ON "ServicingRequest"("status");
CREATE INDEX IF NOT EXISTS "ServicingRequest_kind_idx" ON "ServicingRequest"("kind");

CREATE TABLE IF NOT EXISTS "ServicingAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "refundCaseId" TEXT,
  "servicingRequestId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ServicingAuditEvent_bookingId_idx" ON "ServicingAuditEvent"("bookingId");
CREATE INDEX IF NOT EXISTS "ServicingAuditEvent_refundCaseId_idx" ON "ServicingAuditEvent"("refundCaseId");
CREATE INDEX IF NOT EXISTS "ServicingAuditEvent_servicingRequestId_idx" ON "ServicingAuditEvent"("servicingRequestId");
