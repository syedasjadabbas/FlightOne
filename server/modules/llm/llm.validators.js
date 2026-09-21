import { z } from "zod";

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

/** Matches client CompletionRequest (system + dialogue turns + optional knobs). */
export const completionRequestSchema = z.object({
  system: z.string().min(1),
  messages: z.array(chatTurnSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  json: z.boolean().optional(),
  thinkingLevel: z.enum(["minimal", "low", "medium", "high"]).optional(),
});
