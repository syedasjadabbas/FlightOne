import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuthOrInternalKey } from "../../middlewares/auth.js";
import * as compsController from "./comps.controller.js";
import { flightsBodySchema, hotelsBodySchema } from "./comps.validators.js";

const router = Router();

router.get("/status", requireAuthOrInternalKey, compsController.status);

router.post(
  "/flights",
  requireAuthOrInternalKey,
  validateBody(flightsBodySchema),
  compsController.flights,
);

router.post(
  "/hotels",
  requireAuthOrInternalKey,
  validateBody(hotelsBodySchema),
  compsController.hotels,
);

export default router;
