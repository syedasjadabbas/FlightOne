import { z } from "zod";

/**
 * A demo offer the client asks us to mint a real SupplierOfferSnapshot for.
 *
 * Deliberately narrow: only the fields the booking engine actually reads off a
 * snapshot. Everything financial (netMinor) is validated as a positive integer
 * in MINOR units — the same contract `assertPersistableOffer` enforces.
 */
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** One flown sector, as printed on the e-ticket. */
const segmentSchema = z.object({
  carrier: z.string().trim().max(3),
  flightNumber: z.string().trim().max(10),
  originCode: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  destinationCode: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  departureDate: isoDate,
  departTimeLocal: hhmm,
  arrivalDate: isoDate,
  arriveTimeLocal: hhmm,
  durationMinutes: z.number().int().positive().nullable().optional(),
  layoverMinutesAfter: z.number().int().nonnegative().optional(),
  aircraft: z.string().trim().max(10).nullable().optional(),
  bookingClass: z.string().trim().max(3).optional(),
});

export const demoSnapshotSchema = z.object({
  offerId: z.string().trim().min(1).max(120),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase()),
  netMinor: z.number().int().positive(),
  product: z.enum(["FLIGHT", "HOTEL"]).default("FLIGHT"),
  itinerary: z
    .object({
      origin: z.string().trim().length(3).transform((v) => v.toUpperCase()),
      destination: z.string().trim().length(3).transform((v) => v.toUpperCase()),
      departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cabin: z.string().trim().max(20).optional(),
      carrier: z.string().trim().max(3).optional(),
      stops: z.number().int().min(0).max(5).optional(),
      durationMinutes: z.number().int().positive().optional(),
      flightNumber: z.string().trim().max(10).optional(),
      departTimeLocal: hhmm.optional(),
      arriveTimeLocal: hhmm.optional(),
      // Carried through so the issued e-ticket can print real sectors rather
      // than an origin/destination pair with blank times.
      segments: z.array(segmentSchema).max(8).optional(),
      returnSegments: z.array(segmentSchema).max(8).optional(),
    })
    .optional(),
});
