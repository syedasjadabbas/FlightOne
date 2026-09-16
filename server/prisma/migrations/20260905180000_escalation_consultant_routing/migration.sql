-- Module 13: consultant routing pool columns (skill/language/VIP routing metadata).
-- Does not invent availability — columns only store pool + routing outcome.

ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "routingPool" TEXT;
ALTER TABLE "EscalationTicket" ADD COLUMN IF NOT EXISTS "routingStatus" TEXT;

CREATE INDEX IF NOT EXISTS "EscalationTicket_routingPool_status_idx"
  ON "EscalationTicket"("routingPool", "status");
