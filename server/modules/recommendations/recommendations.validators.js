import { z } from "zod";

export const RANKABLE_PRODUCTS = ["FLIGHT", "HOTEL", "PACKAGE"];
export const FEEDBACK_SIGNALS = ["ACCEPT", "REJECT", "IGNORE"];

/**
 * One normalized supplier offer to rank. `amountMinor` is already the
 * customer-facing price computed by Module 05 (pricing/margin engine) — this
 * module never reprices it, only reads it (module doc: "Ranking never
 * re-derives or overrides price").
 */
const offerSchema = z.object({
  id: z.string().trim().min(1, "offer.id is required"),
  product: z.enum(RANKABLE_PRODUCTS),
  amountMinor: z.number().int().nonnegative(), // customer price from pricing — never reprice here (lib/money.js convention)
  currency: z
    .string()
    .trim()
    .length(3, "offer.currency must be a 3-letter ISO 4217 code")
    .transform((v) => v.toUpperCase()),
  durationMinutes: z.number().int().nonnegative().optional(),
  layoverCount: z.number().int().min(0).optional(),
  layoverMinutes: z.number().int().min(0).optional(),
  airlineCode: z.string().trim().min(1).max(10).optional(),
  departHourUtc: z.number().int().min(0).max(23).optional(),
  /** Local depart hour 0–23 when known from supplier itinerary. */
  departHourLocal: z.number().int().min(0).max(23).optional(),
  /** Local arrive hour 0–23 when known. */
  arriveHourLocal: z.number().int().min(0).max(23).optional(),
  refundable: z.boolean().optional(),
  supplierCode: z.string().trim().min(1).max(40).optional(),
  /**
   * Trusted supplier reliability 0..1 or 0..100. Omitted → neutral (no stub map).
   */
  supplierReliability: z.number().min(0).max(100).optional(),
  /**
   * Authoritative airline quality 0..1 or 0..100 (PRD Module 4).
   * Omitted → quality axis neutral — never invent rankings.
   */
  airlineScore: z.number().min(0).max(100).optional(),
  /** Real inventory tags (hub-stitched, nearby-airport) — never invented server-side. */
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  raw: z.record(z.any()).optional(),
});

const preferencesSchema = z.object({
  preferredAirlines: z.array(z.string().trim().min(1).max(10)).optional(),
  loyaltyAirlineCodes: z.array(z.string().trim().min(1).max(10)).optional(),
  maxLayovers: z.number().int().min(0).optional(),
  avoidRedEye: z.boolean().optional(),
  avoidLateArrival: z.boolean().optional(),
  refundableOnly: z.boolean().optional(),
});

export const rankOffersSchema = z.object({
  offers: z.array(offerSchema).min(1, "offers must contain at least one offer"),
  preferences: preferencesSchema.optional(),
  limit: z.number().int().min(1).max(20).optional(),
  includeAll: z.boolean().optional(),
});

const feedbackContextSchema = z
  .object({
    airlineCode: z.string().trim().min(1).max(10).optional(),
    stops: z.number().int().min(0).max(9).optional(),
    refundable: z.boolean().optional(),
  })
  .optional();

export const feedbackSchema = z.object({
  offerId: z.string().trim().min(1, "offerId is required"),
  conversationId: z.string().trim().min(1).optional(),
  signal: z.enum(FEEDBACK_SIGNALS),
  /** Real offer attributes at feedback time — required for learning to apply later. */
  context: feedbackContextSchema,
});

export const fareInsightSchema = z.object({
  origin: z.string().trim().min(3).max(10),
  destination: z.string().trim().min(3).max(10),
  departureDate: z.string().trim().min(8).max(16).optional(),
  currentAmountMinor: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
});

export const dismissPredictiveSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

export const predictivePrefsSchema = z
  .object({
    proactiveEnabled: z.boolean().optional(),
    notifyApp: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
