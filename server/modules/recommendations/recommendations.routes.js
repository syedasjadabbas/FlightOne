import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as recommendationsController from "./recommendations.controller.js";
import { feedbackSchema, rankOffersSchema } from "./recommendations.validators.js";

const router = Router();

router.use(requireAuth);

router.post("/rank", validateBody(rankOffersSchema), recommendationsController.rank);
router.post("/feedback", validateBody(feedbackSchema), recommendationsController.feedback);
router.get("/learned", recommendationsController.learned);

export default router;
