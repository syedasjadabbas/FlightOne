import { z } from "zod";

const isoDate = (label) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be YYYY-MM-DD`);

const flightQuerySchema = z
  .object({
    origin: z
      .string()
      .trim()
      .length(3, "origin must be a 3-letter IATA code")
      .transform((v) => v.toUpperCase()),
    destination: z
      .string()
      .trim()
      .length(3, "destination must be a 3-letter IATA code")
      .transform((v) => v.toUpperCase()),
    departureDate: isoDate("departureDate"),
    returnDate: isoDate("returnDate").optional(),
    passengers: z.number().int().min(1).max(9).optional(),
    cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).optional(),
    requestedCurrency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .optional(),
    preferredCarriers: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{2}$/, "carrier must be a 2-character IATA code")
          .transform((v) => v.toUpperCase()),
      )
      .min(1)
      .max(6)
      .optional(),
    carrierPreferenceType: z.enum(["Permitted", "Preferred"]).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.origin === q.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "origin and destination must differ",
        path: ["destination"],
      });
    }
    if (q.returnDate && q.returnDate < q.departureDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "returnDate must be on or after departureDate",
        path: ["returnDate"],
      });
    }
  });

const hotelQuerySchema = z.object({
  cityCode: z.string().trim().min(1).max(10),
  // RateHawk numeric region id (IATA cityCode alone is not a RateHawk region).
  regionId: z.coerce.number().int().positive().optional(),
  checkInDate: isoDate("checkInDate"),
  checkOutDate: isoDate("checkOutDate"),
  rooms: z.number().int().min(1).max(10).optional(),
  guests: z.number().int().min(1).max(20).optional(),
  hotelName: z.string().trim().min(2).max(80).optional(),
  requestedCurrency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const searchSchema = z.discriminatedUnion("product", [
  z.object({ product: z.literal("FLIGHT"), query: flightQuerySchema }),
  z.object({ product: z.literal("HOTEL"), query: hotelQuerySchema }),
]);
