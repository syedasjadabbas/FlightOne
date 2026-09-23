import { z } from "zod";

/**
 * A demo offer the client asks us to mint a real SupplierOfferSnapshot for.
 *
 * Deliberately narrow: only the fields the booking engine actually reads off a
 * snapshot. Everything financial (netMinor) is validated as a positive integer
 * in MINOR units — the same contract `assertPersistableOffer` enforces.
 */
const hhmm = z
  .string()
  .transform((v) => {
    const match = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
    return v;
  })
  .pipe(z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"));

const isoDate = z
  .string()
  .transform((v) => {
    const match = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    return v;
  })
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"));

/** One flown sector, as printed on the e-ticket. */
const segmentSchema = z.object({
  carrier: z.string().trim().max(20).transform((v) => v.slice(0, 3).toUpperCase()),
  flightNumber: z.string().trim().max(20),
  originCode: z.string().trim().min(3).max(4).transform((v) => v.slice(0, 3).toUpperCase()),
  destinationCode: z.string().trim().min(3).max(4).transform((v) => v.slice(0, 3).toUpperCase()),
  departureDate: isoDate,
  departTimeLocal: hhmm,
  arrivalDate: isoDate,
  arriveTimeLocal: hhmm,
  durationMinutes: z.number().int().nonnegative().nullable().optional(),
  layoverMinutesAfter: z.number().int().nonnegative().optional(),
  aircraft: z.string().trim().max(20).nullable().optional(),
  bookingClass: z.string().trim().max(10).optional(),
});

export const demoSnapshotSchema = z.object({
  offerId: z.string().trim().min(1).max(120),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(4)
    .transform((v) => v.slice(0, 3).toUpperCase()),
  netMinor: z.number().int().positive(),
  product: z.enum(["FLIGHT", "HOTEL"]).default("FLIGHT"),
  itinerary: z
    .object({
      origin: z.string().trim().min(3).max(4).transform((v) => v.slice(0, 3).toUpperCase()),
      destination: z.string().trim().min(3).max(4).transform((v) => v.slice(0, 3).toUpperCase()),
      departureDate: isoDate,
      returnDate: isoDate.optional(),
      cabin: z.string().trim().max(30).optional(),
      carrier: z.string().trim().max(20).transform((v) => v.slice(0, 3).toUpperCase()).optional(),
      stops: z.number().int().min(0).max(10).optional(),
      durationMinutes: z.number().int().nonnegative().optional(),
      flightNumber: z.string().trim().max(20).optional(),
      departTimeLocal: hhmm.optional(),
      arriveTimeLocal: hhmm.optional(),
      // Carried through so the issued e-ticket can print real sectors rather
      // than an origin/destination pair with blank times.
      segments: z.array(segmentSchema).max(16).optional(),
      returnSegments: z.array(segmentSchema).max(16).optional(),
    })
    .optional(),
});
