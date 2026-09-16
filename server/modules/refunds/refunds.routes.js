import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermission } from "../../middlewares/permission.js";
import * as refundsController from "./refunds.controller.js";
import {
  bookingIdParamsSchema,
  calculateRefundSchema,
  cancellationRequestSchema,
  createRefundCaseSchema,
  escalateCaseSchema,
  exchangeCalculateSchema,
  exchangeRequestSchema,
  listRefundCasesQuerySchema,
  refundCaseIdParamsSchema,
  rejectCaseSchema,
  scheduleChangeSchema,
  servicingIdParamsSchema,
} from "./refunds.validators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/eligibility/:bookingId",
  validateParams(bookingIdParamsSchema),
  refundsController.eligibility,
);

router.post("/calculate", validateBody(calculateRefundSchema), refundsController.calculate);

router.post("/cases", validateBody(createRefundCaseSchema), refundsController.createCase);
router.get("/cases", validateQuery(listRefundCasesQuerySchema), refundsController.listCases);
router.get("/cases/:id", validateParams(refundCaseIdParamsSchema), refundsController.getCaseById);
router.post(
  "/cases/:id/submit",
  validateParams(refundCaseIdParamsSchema),
  refundsController.submitCase,
);
router.post(
  "/cases/:id/process",
  requirePermission("refunds:write"),
  validateParams(refundCaseIdParamsSchema),
  refundsController.processCase,
);
router.post(
  "/cases/:id/complete",
  requirePermission("refunds:write"),
  validateParams(refundCaseIdParamsSchema),
  refundsController.completeCase,
);
router.post(
  "/cases/:id/reject",
  requirePermission("refunds:write"),
  validateParams(refundCaseIdParamsSchema),
  validateBody(rejectCaseSchema),
  refundsController.rejectCase,
);
router.post(
  "/cases/:id/escalate",
  validateParams(refundCaseIdParamsSchema),
  validateBody(escalateCaseSchema),
  refundsController.escalateCase,
);

router.get(
  "/cancellation/eligibility/:bookingId",
  validateParams(bookingIdParamsSchema),
  refundsController.cancellationEligibility,
);
router.post(
  "/cancellation/request",
  validateBody(cancellationRequestSchema),
  refundsController.requestCancellation,
);

router.post(
  "/exchange/calculate",
  validateBody(exchangeCalculateSchema),
  refundsController.calculateExchange,
);
router.post(
  "/exchange/request",
  validateBody(exchangeRequestSchema),
  refundsController.requestExchange,
);

router.post(
  "/schedule-change",
  validateBody(scheduleChangeSchema),
  refundsController.scheduleChange,
);

router.get("/credits", refundsController.listCredits);
router.get("/ava-guidance", refundsController.avaGuidance);
router.get("/servicing", refundsController.listServicing);
router.get(
  "/servicing/:id",
  validateParams(servicingIdParamsSchema),
  refundsController.getServicing,
);

export default router;
