import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const conversationIdParamsSchema = z.object({
  id: z.string().min(1, "Conversation id is required"),
});

export const addMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

/** Persist messages produced by the Next.js /api/chat orchestrator (no stub reply). */
export const recordMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
        content: z.string().trim().min(1).max(8000),
        provider: z.string().trim().max(64).optional().nullable(),
      }),
    )
    .min(1)
    .max(40),
  /** Structured TravelPlan for cross-device continuity (Module 01). Opaque JSON. */
  travelPlan: z.unknown().optional().nullable(),
});

export const escalateConversationSchema = z.object({
  note: z.string().trim().min(1).max(1000).optional(),
});
