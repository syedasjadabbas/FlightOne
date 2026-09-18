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

router.post("/applications", validateBody(createVisaApplicationSchema), visaController.createApplication);
router.get("/applications", validateQuery(listVisaApplicationsQuerySchema), visaController.listApplications);
router.patch(
  "/applications/:id",
  validateParams(visaApplicationIdParamsSchema),
  validateBody(updateVisaApplicationSchema),
  visaController.updateApplication,
);

export default router;
