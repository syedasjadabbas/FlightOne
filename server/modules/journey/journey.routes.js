import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermission } from "../../middlewares/permission.js";
import * as journeyController from "./journey.controller.js";
import {
  createWatchSchema,
  drainNotificationsSchema,
  escalateJourneySchema,
  listEventsQuerySchema,
  listNotificationsQuerySchema,
  listWatchesQuerySchema,
  rebookHandoffSchema,
  watchIdParamsSchema,
} from "./journey.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/capability", journeyController.getCapability);

router.post("/watches", validateBody(createWatchSchema), journeyController.createWatch);
router.get("/watches", validateQuery(listWatchesQuerySchema), journeyController.listWatches);
router.get(
  "/watches/:id",
  validateParams(watchIdParamsSchema),
  journeyController.getWatch,
);
router.get(
  "/watches/:id/events",
  validateParams(watchIdParamsSchema),
  validateQuery(listEventsQuerySchema),
  journeyController.listEvents,
);
router.post(
  "/watches/:id/poll",
  validateParams(watchIdParamsSchema),
  journeyController.poll,
);
router.post(
  "/watches/:id/alternatives",
  validateParams(watchIdParamsSchema),
  journeyController.alternatives,
);
router.post(
  "/watches/:id/rebook-handoff",
  validateParams(watchIdParamsSchema),
  validateBody(rebookHandoffSchema),
  journeyController.rebookHandoff,
);
router.post(
  "/watches/:id/escalate",
  validateParams(watchIdParamsSchema),
  validateBody(escalateJourneySchema),
  journeyController.escalate,
);

router.post(
  "/notifications/drain",
  requirePermission("ops:dashboard:read"),
  validateBody(drainNotificationsSchema),
  journeyController.drainNotifications,
);
router.get(
  "/notifications",
  validateQuery(listNotificationsQuerySchema),
  journeyController.listNotifications,
);

export default router;
