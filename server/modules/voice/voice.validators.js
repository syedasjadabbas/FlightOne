import { z } from "zod";

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export const createSessionSchema = z.object({
  conversationId: z.string().min(1).optional(),
  locale: z.string().min(2).max(16).optional(),
});

export const turnSchema = z.object({
  transcript: z.string().min(1, "transcript is required").max(8000),
  persistConversation: z.boolean().optional(),
});

export const prepareBookingSchema = z.object({
  supplierOfferSnapshotId: z.string().min(1, "supplierOfferSnapshotId is required"),
});

export const otpRequestSchema = z.object({
  intentId: z.string().min(1, "intentId is required"),
});

export const otpConfirmSchema = z.object({
  intentId: z.string().min(1, "intentId is required"),
  code: z.string().min(4).max(12),
});

export const bindCallerSchema = z.object({
  phone: z.string().min(8).max(20),
});

export const sessionStateSchema = z.object({
  state: z.enum([
    "IDLE",
    "LISTENING",
    "PROCESSING",
    "SPEAKING",
    "CONFIRMATION_REQUIRED",
    "COMPLETED",
    "FAILED",
    "UNAVAILABLE",
  ]),
});
