import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { optionalAuth, requireAuth } from "../../middlewares/auth.js";
import * as recommendationsController from "./recommendations.controller.js";
import {
  dismissPredictiveSchema,
  fareInsightSchema,
  feedbackSchema,
  predictivePrefsSchema,
  rankOffersSchema,
} from "./recommendations.validators.js";

const router = Router();

router.get("/calendar", recommendationsController.calendarCapability);
router.post(
  "/fare-insight",
  optionalAuth,
  validateBody(fareInsightSchema),
  recommendationsController.fareInsight,
);

router.use(requireAuth);

router.post("/rank", validateBody(rankOffersSchema), recommendationsController.rank);
router.post("/feedback", validateBody(feedbackSchema), recommendationsController.feedback);
router.get("/learned", recommendationsController.learned);
router.get("/predictive", recommendationsController.listPredictive);
router.post(
  "/predictive/dismiss",
  validateBody(dismissPredictiveSchema),
  recommendationsController.dismissPredictive,
);
router.get("/predictive/preferences", recommendationsController.getPredictivePrefs);
router.patch(
  "/predictive/preferences",
  validateBody(predictivePrefsSchema),
  recommendationsController.patchPredictivePrefs,
);

export default router;
