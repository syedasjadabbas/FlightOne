import { z } from "zod";
import { BOOKING_PRODUCTS } from "./bookings.constants.js";

export {
  BOOKING_ALLOWED_TRANSITIONS,
  BOOKING_PRODUCTS,
  BOOKING_STATUSES,
} from "./bookings.constants.js";

export const createBookingSchema = z.object({
  product: z.enum(BOOKING_PRODUCTS),
  currency: z
    .string()
    .trim()
    .length(3, "currency must be a 3-letter ISO 4217 code")
    .transform((v) => v.toUpperCase()),
  // Server is the pricing authority (Module 05). amountMinor is never trusted
  // from the client outside NODE_ENV=test + metadata.forceClientPrice.
  amountMinor: z.number().int().nonnegative().optional(),
  // Client-supplied netMinor is never authoritative (Module 03 uses the
  // persisted supplier offer snapshot); kept optional for backwards
  // compatibility + client-manipulation regression tests.
  netMinor: z.number().int().nonnegative().optional(),
  supplierCode: z.string().trim().min(1).max(40).optional(),

  // Module 03 — quote creation must reference a persisted, user-scoped
  // supplier offer snapshot (live-search normalized refs + TTL).
  supplierOfferSnapshotId: z.string().trim().min(1).max(200).optional(),
  // Module 05 pricing-engine inputs — forwarded verbatim to
  // pricing.service.js#priceOffer, not persisted as their own Booking
  // columns (kept in metadata.pricing.input for reprice-time recomputation).
  route: z.string().trim().min(1).max(40).optional(),
  cabin: z.string().trim().min(1).max(40).optional(),
  segment: z.string().trim().min(1).max(40).optional(),
  promoCode: z.string().trim().min(1).max(40).optional(),
  requestedDiscountBps: z.number().int().nonnegative().optional(),
  travellerSnapshot: z.record(z.any()).optional(),
  fareRules: z.record(z.any()).optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  // Freeform bag; forceClientPrice is stripped and only honored in NODE_ENV=test.
  metadata: z.record(z.any()).optional(),
});

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const reserveBookingSchema = z.object({
  // Optional comparison signal only — server pricing remains authoritative.
  clientAmountMinor: z.number().int().nonnegative().optional(),
  travellerSnapshot: z
    .object({
      givenName: z.string().trim().min(1).max(80).optional(),
      surname: z.string().trim().min(1).max(80).optional(),
      firstName: z.string().trim().min(1).max(80).optional(),
      lastName: z.string().trim().min(1).max(80).optional(),
      fullName: z.string().trim().min(1).max(160).optional(),
    })
    .passthrough()
    .optional(),
});

export const ticketBookingSchema = z.object({
  clientAmountMinor: z.number().int().nonnegative().optional(),
});

export const acceptPriceChangeSchema = z.object({
  acceptedAmountMinor: z.number().int().positive(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
