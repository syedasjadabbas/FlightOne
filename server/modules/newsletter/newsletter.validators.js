import { z } from "zod";

export const subscribeBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
