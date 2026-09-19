import { z } from "zod";

export const ruleIdParamsSchema = z.object({
  ruleId: z.string().min(1, "ruleId is required"),
});

const triggerEnum = z.enum(["DELAY", "CANCELLED", "DISRUPTION", "REBOOK_OPPORTUNITY"]);
const actionEnum = z.enum(["NOTIFY", "PREPARE_REBOOK", "AUTONOMOUS_REBOOK"]);

export const createRuleSchema = z.object({
  name: z.string().min(2).max(120),
  trigger: triggerEnum,
  thresholdMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  action: actionEnum,
  maxAdditionalMinor: z.number().int().min(0).max(500_000_000),
  currency: z.string().min(3).max(8).optional(),
  notifyOnTrigger: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const updateRuleSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    trigger: triggerEnum.optional(),
    thresholdMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
    action: actionEnum.optional(),
    maxAdditionalMinor: z.number().int().min(0).max(500_000_000).optional(),
    currency: z.string().min(3).max(8).optional(),
    notifyOnTrigger: z.boolean().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
