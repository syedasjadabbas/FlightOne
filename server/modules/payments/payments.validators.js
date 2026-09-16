import { z } from "zod";

export const payBookingSchema = z.object({
  paymentMethodToken: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  method: z.enum(["card", "corporate_credit"]).optional(),
});
