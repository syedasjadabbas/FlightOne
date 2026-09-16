-- Module 13 — Human Agent Escalation. Scoped to escalation tables only.

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscalationTrigger" AS ENUM ('CUSTOMER_REQUEST', 'VIP', 'COMPLEX_ITINERARY', 'SUPPLIER_FAILURE', 'REFUND_DISPUTE', 'MEDICAL', 'SSR', 'AI_DISCOUNT_LIMIT', 'OTHER');

-- CreateTable
CREATE TABLE "EscalationTicket" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "trigger" "EscalationTrigger" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assignedToUserId" TEXT,
    "bookingId" TEXT,
    "contextSnapshot" JSONB NOT NULL,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EscalationTicket_conversationId_idx" ON "EscalationTicket"("conversationId");

-- CreateIndex
CREATE INDEX "EscalationTicket_status_idx" ON "EscalationTicket"("status");

-- CreateIndex
CREATE INDEX "EscalationTicket_assignedToUserId_idx" ON "EscalationTicket"("assignedToUserId");
