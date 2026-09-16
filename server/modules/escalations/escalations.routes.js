import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermission } from "../../middlewares/permission.js";
import * as escalationsController from "./escalations.controller.js";
import {
  assignEscalationSchema,
  escalationIdParamsSchema,
  listEscalationsQuerySchema,
  requestEscalationSchema,
  resolveEscalationSchema,
  cancelEscalationSchema,
  consultantActionSchema,
} from "./escalations.validators.js";

const router = Router();

router.use(requireAuth);

// —— Customer (own escalations only; identity from auth) ——
router.get("/mine", validateQuery(listEscalationsQuerySchema), escalationsController.listMine);
router.get(
  "/mine/:id",
  validateParams(escalationIdParamsSchema),
  escalationsController.getMine,
);
router.post(
  "/request",
  validateBody(requestEscalationSchema),
  escalationsController.request,
);

// —— Consultant / ops queue ——
router.get(
  "/",
  requirePermission("ops:escalations:read"),
  validateQuery(listEscalationsQuerySchema),
  escalationsController.list,
);

router.get(
  "/:id",
  requirePermission("ops:escalations:read"),
  validateParams(escalationIdParamsSchema),
  escalationsController.getById,
);

router.post(
  "/:id/claim",
  requirePermission("ops:escalations:write"),
  validateParams(escalationIdParamsSchema),
  escalationsController.claim,
);

router.post(
  "/:id/assign",
  requirePermission("ops:escalations:write"),
  validateParams(escalationIdParamsSchema),
  validateBody(assignEscalationSchema),
  escalationsController.assign,
);

router.post(
  "/:id/start",
  requirePermission("ops:escalations:write"),
  validateParams(escalationIdParamsSchema),
  escalationsController.start,
);

router.post(
  "/:id/resolve",
  requirePermission("ops:escalations:write"),
  validateParams(escalationIdParamsSchema),
  validateBody(resolveEscalationSchema),
  escalationsController.resolve,
);

router.post(
  "/:id/actions",
  requirePermission("ops:escalations:write"),
  validateParams(escalationIdParamsSchema),
  validateBody(consultantActionSchema),
  escalationsController.applyAction,
);

router.post(
  "/:id/cancel",
  requirePermission("ops:escalations:write"),
  validateParams(escalationIdParamsSchema),
  validateBody(cancelEscalationSchema),
  escalationsController.cancel,
);

export default router;
