import { z } from "zod";

/** Shared shape for both `/quote` and `/reprice` — same input, same engine. */
const priceOfferShape = {
  netMinor: z.number().int().positive("netMinor must be a positive supplier cost"),
  currency: z
    .string()
    .trim()
    .length(3, "currency must be a 3-letter ISO 4217 code")
    .transform((v) => v.toUpperCase()),
  product: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((v) => v.toUpperCase())
    .optional(),
  supplierCode: z.string().trim().min(1).max(40).optional(),
  route: z.string().trim().min(1).max(40).optional(),
  cabin: z.string().trim().min(1).max(40).optional(),
  segment: z.string().trim().min(1).max(40).optional(),
  promoCode: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((v) => v.toUpperCase())
    .optional(),
  requestedDiscountBps: z.number().int().nonnegative().optional(),
  previousAmountMinor: z.number().int().nonnegative().optional(),
  /** Module 06 negotiated company markup — optional; never invent client-side. */
  companyMarkupBps: z.number().int().nonnegative().optional(),
  displayCurrency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  settlementCurrency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  fxRateBps: z.number().int().nonnegative().optional(),
};

export const priceOfferBodySchema = z.object(priceOfferShape);

export const priceOfferQuerySchema = z.object({
  ...priceOfferShape,
  netMinor: z.coerce.number().int().nonnegative(),
  requestedDiscountBps: z.coerce.number().int().nonnegative().optional(),
  previousAmountMinor: z.coerce.number().int().nonnegative().optional(),
});
