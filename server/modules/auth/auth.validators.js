import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .default({});

export const logoutSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .default({});

export const bootstrapSchema = registerSchema;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email().optional(),
  token: z.string().min(1),
  password: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

/** currentSessionId, body refreshToken, or HttpOnly cookie may identify the session. */
export const revokeOtherSessionsSchema = z
  .object({
    currentSessionId: z.string().min(1).optional(),
    refreshToken: z.string().min(1).optional(),
  })
  .default({});
