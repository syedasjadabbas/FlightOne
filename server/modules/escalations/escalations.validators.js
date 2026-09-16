import { z } from "zod";
import {
  ACTIVE_ESCALATION_STATUSES,
  ESCALATION_STATUSES,
  ESCALATION_TRIGGERS,
  normalizeEscalationTrigger,
} from "./escalations.constants.js";

export {
  ACTIVE_ESCALATION_STATUSES,
  ESCALATION_STATUSES,
  ESCALATION_TRIGGERS,
  normalizeEscalationTrigger,
} from "./escalations.constants.js";

export const listEscalationsQuerySchema = z.object({
  status: z.enum(ESCALATION_STATUSES).optional(),
  pool: z.enum(["VIP", "MEDICAL", "COMPLEX", "GENERAL"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const escalationIdParamsSchema = z.object({
  id: z.string().min(1, "Escalation id is required"),
});

export const resolveEscalationSchema = z.object({
  resolutionNote: z.string().trim().min(1).max(2000),
  outcome: z
    .enum([
      "RESOLVED_NO_CHANGE",
      "BOOKING_CANCELLED",
      "REFUND_PROCESSED",
      "REFUND_REJECTED",
      "REBOOK_HANDED_OFF",
      "INFORMATION_PROVIDED",
      "OTHER",
    ])
    .optional(),
});

export const consultantActionSchema = z.object({
  actionType: z.enum([
    "CANCEL_BOOKING",
    "REFUND_PROCESS",
    "REFUND_COMPLETE",
    "REFUND_REJECT",
    "JOURNEY_REBOOK_HANDOFF",
  ]),
  reason: z.string().trim().min(1).max(2000).optional(),
  refundCaseId: z.string().trim().min(1).optional(),
  watchId: z.string().trim().min(1).optional(),
  supplierOfferSnapshotId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
});

export const assignEscalationSchema = z.object({
  assignedToUserId: z.string().trim().min(1).max(64).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "CANCELLED"]).optional(),
  note: z.string().trim().min(1).max(2000).optional(),
});

export const cancelEscalationSchema = z.object({
  note: z.string().trim().min(1).max(2000).optional(),
});

export const requestEscalationSchema = z.object({
  conversationId: z.string().min(1),
  trigger: z.enum(ESCALATION_TRIGGERS).optional(),
  bookingId: z.string().min(1).optional().nullable(),
  note: z.string().trim().min(1).max(1000).optional(),
  reasonDetail: z.string().trim().min(1).max(1000).optional(),
});
