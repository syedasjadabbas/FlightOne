import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { optionalAuth, requireAuth } from "../../middlewares/auth.js";
import * as visaController from "./visa.controller.js";
import {
  assessVisaSchema,
  createVisaApplicationSchema,
  escalateVisaSchema,
  getRequirementsQuerySchema,
  listVisaApplicationsQuerySchema,
  lookupVisaSchema,
  updateVisaApplicationSchema,
  visaApplicationIdParamsSchema,
} from "./visa.validators.js";

const router = Router();

router.get("/capability", optionalAuth, visaController.capability);
router.get("/requirements", optionalAuth, validateQuery(getRequirementsQuerySchema), visaController.getRequirements);
router.post("/lookup", optionalAuth, validateBody(lookupVisaSchema), visaController.lookup);
router.post("/assess", optionalAuth, validateBody(assessVisaSchema), visaController.assess);
router.post("/escalate", requireAuth, validateBody(escalateVisaSchema), visaController.escalate);

// These routes read and write a user's own visa applications, so they are
// authenticated: the service derives ownership from `req.user.id`, and without
// requireAuth `req.user` was undefined — a 500 on every call, and unauthenticated
// access to the handlers underneath it.
router.post("/applications", requireAuth, validateBody(createVisaApplicationSchema), visaController.createApplication);
router.get("/applications", requireAuth, validateQuery(listVisaApplicationsQuerySchema), visaController.listApplications);
router.patch(
  "/applications/:id",
  requireAuth,
  validateParams(visaApplicationIdParamsSchema),
  validateBody(updateVisaApplicationSchema),
  visaController.updateApplication,
);

export default router;
