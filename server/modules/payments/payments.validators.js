import { z } from "zod";

export const payBookingSchema = z.object({
  paymentMethodToken: z.string().trim().min(1).max(200).optional(),
  accountNumber: z.string().trim().min(1).max(50).optional(),
  cnicLast6: z.string().trim().length(6).optional(),
  email: z.string().trim().email().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  method: z.enum(["card", "corporate_credit", "jazzcash", "easypaisa", "onelink_ibft"]).optional(),
});
