import { z } from "zod";

const iataCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{3}$/.test(v), {
    message: "must be a 3-letter IATA airport code",
  });

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const currencyCode = z
  .string()
  .trim()
  .length(3, "currency must be a 3-letter ISO 4217 code")
  .transform((v) => v.toUpperCase());

const airlineCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9]{2}$/.test(v), {
    message: "airline codes must be 2-character IATA",
  });

/** POST /api/v1/comps/flights */
export const flightsBodySchema = z.object({
  origin: iataCode,
  destination: iataCode,
  outboundDate: isoDate,
  returnDate: isoDate.optional(),
  currency: currencyCode,
  adults: z.number().int().positive().max(9).optional(),
  includeAirlines: z.array(airlineCode).max(20).optional(),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
});

/** POST /api/v1/comps/hotels */
export const hotelsBodySchema = z.object({
  q: z.string().trim().min(1).max(200),
  checkInDate: isoDate,
  checkOutDate: isoDate,
  currency: currencyCode,
  adults: z.number().int().positive().max(9).optional(),
  hotelClass: z.number().int().min(1).max(5).optional(),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
});
