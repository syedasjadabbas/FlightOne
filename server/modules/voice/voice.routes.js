import { Router } from "express";
import { validateBody, validateParams } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as c from "./voice.controller.js";
import {
  bindCallerSchema,
  createSessionSchema,
  otpConfirmSchema,
  otpRequestSchema,
  prepareBookingSchema,
  sessionIdParamsSchema,
  sessionStateSchema,
  turnSchema,
} from "./voice.validators.js";

const router = Router();

router.get("/capability", c.getCapability);
router.post("/telephony/inbound", c.telephonyInbound);

router.use(requireAuth);

router.post("/sessions", validateBody(createSessionSchema), c.createSession);
router.post("/caller-bindings", validateBody(bindCallerSchema), c.bindCaller);
router.get(
  "/sessions/:sessionId",
  validateParams(sessionIdParamsSchema),
  c.getSession,
);
router.patch(
  "/sessions/:sessionId/state",
  validateParams(sessionIdParamsSchema),
  validateBody(sessionStateSchema),
  c.patchState,
);
router.post(
  "/sessions/:sessionId/turn",
  validateParams(sessionIdParamsSchema),
  validateBody(turnSchema),
  c.processTurn,
);
router.post(
  "/sessions/:sessionId/booking/prepare",
  validateParams(sessionIdParamsSchema),
  validateBody(prepareBookingSchema),
  c.prepareBooking,
);
router.post(
  "/sessions/:sessionId/otp/request",
  validateParams(sessionIdParamsSchema),
  validateBody(otpRequestSchema),
  c.requestOtp,
);
router.post(
  "/sessions/:sessionId/otp/confirm",
  validateParams(sessionIdParamsSchema),
  validateBody(otpConfirmSchema),
  c.confirmOtp,
);

export default router;
