import { z } from "zod";
import {
  EXCHANGE_KINDS,
  REFUND_CALCULATE_KINDS,
  REFUND_CASE_KINDS,
  REFUND_CASE_STATUSES,
} from "./refunds.constants.js";

export {
  EXCHANGE_KINDS,
  REFUND_CALCULATE_KINDS,
  REFUND_CASE_KINDS,
  REFUND_CASE_STATUSES,
} from "./refunds.constants.js";

export const calculateRefundSchema = z.object({
  bookingId: z.string().trim().min(1, "bookingId is required"),
  partialRatio: z.number().min(0).max(1).optional(),
  scheduleChangeAttributed: z.boolean().optional(),
  kind: z.enum(REFUND_CALCULATE_KINDS).optional(),
});

export const createRefundCaseSchema = z.object({
  bookingId: z.string().trim().min(1, "bookingId is required"),
  calculationId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  partial: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(REFUND_CASE_KINDS).optional(),
});

export const refundCaseIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Refund case id is required"),
});

export const bookingIdParamsSchema = z.object({
  bookingId: z.string().trim().min(1),
});

export const listRefundCasesQuerySchema = z.object({
  bookingId: z.string().trim().min(1).optional(),
  status: z.enum(REFUND_CASE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const rejectCaseSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const escalateCaseSchema = z.object({
  conversationId: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
  trigger: z.string().trim().min(1).max(64).optional(),
});

export const exchangeCalculateSchema = z.object({
  bookingId: z.string().trim().min(1),
  newFareMinor: z.number().int().nonnegative().optional().nullable(),
  kind: z.enum(EXCHANGE_KINDS).optional(),
});

export const exchangeRequestSchema = z.object({
  bookingId: z.string().trim().min(1),
  servicingRequestId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const cancellationRequestSchema = z.object({
  bookingId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  conversationId: z.string().trim().min(1).optional(),
});

export const scheduleChangeSchema = z.object({
  bookingId: z.string().trim().min(1),
  journeyEventId: z.string().trim().min(1).optional(),
  conversationId: z.string().trim().min(1).optional(),
});

export const servicingIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
