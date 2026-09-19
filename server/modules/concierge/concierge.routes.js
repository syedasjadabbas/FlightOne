import { Router } from "express";
import { validateBody, validateParams } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as c from "./concierge.controller.js";
import {
  createRuleSchema,
  ruleIdParamsSchema,
  updateRuleSchema,
} from "./concierge.validators.js";

const router = Router();
router.use(requireAuth);

router.get("/rules", c.listRules);
router.post("/rules", validateBody(createRuleSchema), c.createRule);
router.post("/kill-switch", c.killSwitch);
router.get("/activity", c.listActivity);
router.get("/rules/:ruleId", validateParams(ruleIdParamsSchema), c.getRule);
router.patch(
  "/rules/:ruleId",
  validateParams(ruleIdParamsSchema),
  validateBody(updateRuleSchema),
  c.updateRule,
);
router.post(
  "/rules/:ruleId/disable",
  validateParams(ruleIdParamsSchema),
  c.disableRule,
);

export default router;
