-- Phase 3 P3-01 — Voice AI session, caller binding, booking intent, OTP.

DO $$ BEGIN
  CREATE TYPE "VoiceChannel" AS ENUM ('WEB', 'PHONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VoiceSessionState" AS ENUM (
    'IDLE',
    'LISTENING',
    'PROCESSING',
    'SPEAKING',
    'CONFIRMATION_REQUIRED',
    'COMPLETED',
    'FAILED',
    'UNAVAILABLE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VoiceBookingIntentStatus" AS ENUM (
    'PENDING_CONFIRMATION',
    'OTP_SENT',
    'CONFIRMED',
    'EXPIRED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VoiceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "channel" "VoiceChannel" NOT NULL,
    "state" "VoiceSessionState" NOT NULL DEFAULT 'IDLE',
    "locale" TEXT,
    "callerPhoneHash" TEXT,
    "lastErrorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoiceSession_userId_createdAt_idx" ON "VoiceSession"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VoiceSession_conversationId_idx" ON "VoiceSession"("conversationId");

CREATE TABLE IF NOT EXISTS "VoiceCallerBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCallerBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceCallerBinding_userId_phoneHash_key" ON "VoiceCallerBinding"("userId", "phoneHash");
CREATE INDEX IF NOT EXISTS "VoiceCallerBinding_phoneHash_idx" ON "VoiceCallerBinding"("phoneHash");

CREATE TABLE IF NOT EXISTS "VoiceBookingIntent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VoiceBookingIntentStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "supplierOfferSnapshotId" TEXT,
    "product" TEXT,
    "currency" TEXT,
    "amountMinor" INTEGER,
    "bookingId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceBookingIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoiceBookingIntent_userId_status_idx" ON "VoiceBookingIntent"("userId", "status");
CREATE INDEX IF NOT EXISTS "VoiceBookingIntent_sessionId_idx" ON "VoiceBookingIntent"("sessionId");

DO $$ BEGIN
  ALTER TABLE "VoiceBookingIntent"
    ADD CONSTRAINT "VoiceBookingIntent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VoiceOtpChallenge" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoiceOtpChallenge_intentId_idx" ON "VoiceOtpChallenge"("intentId");
CREATE INDEX IF NOT EXISTS "VoiceOtpChallenge_userId_createdAt_idx" ON "VoiceOtpChallenge"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "VoiceOtpChallenge"
    ADD CONSTRAINT "VoiceOtpChallenge_intentId_fkey"
    FOREIGN KEY ("intentId") REFERENCES "VoiceBookingIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
