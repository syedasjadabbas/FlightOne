-- Module 13: consultant write-back actions + cold handoff metadata / resolution outcome.

ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "handoffMode" TEXT NOT NULL DEFAULT 'COLD';
ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "resolutionOutcome" TEXT;
ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "lastWriteBackStatus" TEXT;
ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "lastWriteBackAt" TIMESTAMP(3);
ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "lastWriteBackAction" TEXT;

CREATE TABLE IF NOT EXISTS "EscalationAction" (
    "id" TEXT NOT NULL,
    "escalationId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "bookingId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "idempotencyKey" TEXT,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscalationAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EscalationAction_idempotencyKey_key" ON "EscalationAction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EscalationAction_escalationId_idx" ON "EscalationAction"("escalationId");
CREATE INDEX IF NOT EXISTS "EscalationAction_escalationId_actionType_idx" ON "EscalationAction"("escalationId", "actionType");
CREATE INDEX IF NOT EXISTS "EscalationAction_actorUserId_idx" ON "EscalationAction"("actorUserId");
