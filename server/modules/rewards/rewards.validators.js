import { z } from "zod";

export const redeemPointsSchema = z.object({
  points: z.number().int().positive("points must be a positive integer"),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
});

export const checkoutCreditSchema = z.object({
  bookingId: z.string().trim().min(1),
  points: z.number().int().positive("points must be a positive integer"),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
});

export const attachReferralSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "code is required")
    .max(32)
    .transform((v) => v.toUpperCase()),
});

export const listLedgerQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const companyIdParamsSchema = z.object({
  companyId: z.string().trim().min(1),
});

export const upsertCorporateProgramSchema = z.object({
  isActive: z.boolean().optional(),
  companyEarnPointsPerHundredMinor: z.number().int().min(0).max(10_000).optional(),
  personalEarnEnabled: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});
