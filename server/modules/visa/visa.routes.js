import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
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

router.use(requireAuth);

router.get("/capability", visaController.capability);
router.get("/requirements", validateQuery(getRequirementsQuerySchema), visaController.getRequirements);
router.post("/lookup", validateBody(lookupVisaSchema), visaController.lookup);
router.post("/assess", validateBody(assessVisaSchema), visaController.assess);
router.post("/escalate", validateBody(escalateVisaSchema), visaController.escalate);

router.post("/applications", validateBody(createVisaApplicationSchema), visaController.createApplication);
router.get("/applications", validateQuery(listVisaApplicationsQuerySchema), visaController.listApplications);
router.patch(
  "/applications/:id",
  validateParams(visaApplicationIdParamsSchema),
  validateBody(updateVisaApplicationSchema),
  visaController.updateApplication,
);

export default router;
