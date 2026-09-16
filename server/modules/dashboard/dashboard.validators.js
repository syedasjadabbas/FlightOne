import { z } from "zod";

// Mirrors prisma/bookings.prisma's BookingProduct enum — kept as a local
// literal list (like modules/bookings/bookings.validators.js does) so this
// module never needs a Prisma import just to validate a query string.
export const DASHBOARD_PRODUCTS = ["FLIGHT", "HOTEL", "PACKAGE"];

/**
 * Common query contract shared by every /dashboard/* endpoint (task spec):
 * `from`/`to` ISO dates, optional `currency` (3-letter ISO 4217), optional
 * `product`. This is also the shape that gets serialized into every cache
 * key (dev guide §6.4) — every field here MUST stay part of that key.
 */
export const dashboardQuerySchema = z
  .object({
    from: z.coerce.date({ errorMap: () => ({ message: "from must be a valid ISO date" }) }),
    to: z.coerce.date({ errorMap: () => ({ message: "to must be a valid ISO date" }) }),
    currency: z
      .string()
      .trim()
      .length(3, "currency must be a 3-letter ISO 4217 code")
      .transform((v) => v.toUpperCase())
      .optional(),
    product: z.enum(DASHBOARD_PRODUCTS).optional(),
  })
  .refine((q) => q.from <= q.to, {
    message: "from must be on or before to",
    path: ["from"],
  });
