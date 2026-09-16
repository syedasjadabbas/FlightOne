import { Router } from "express";
import { validateBody, validateParams } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as c from "./mice.controller.js";
import {
  budgetLineSchema,
  checkInSchema,
  createEventSchema,
  createSessionSchema,
  delegateIdParamsSchema,
  eventIdParamsSchema,
  linkBookingSchema,
  registerDelegateSchema,
  selfRegisterSchema,
  sponsorSchema,
  transferIdParamsSchema,
  transferSchema,
  updateEventSchema,
  updateTransferSchema,
} from "./mice.validators.js";

const router = Router();
router.use(requireAuth);

router.get("/transfers/capability", c.getTransferCapability);

router.post("/events", validateBody(createEventSchema), c.createEvent);
router.get("/events", c.listEvents);
router.get("/events/:id", validateParams(eventIdParamsSchema), c.getEvent);
router.patch(
  "/events/:id",
  validateParams(eventIdParamsSchema),
  validateBody(updateEventSchema),
  c.updateEvent,
);

router.post(
  "/events/:id/delegates",
  validateParams(eventIdParamsSchema),
  validateBody(registerDelegateSchema),
  c.registerDelegate,
);
router.post(
  "/events/:id/register",
  validateParams(eventIdParamsSchema),
  validateBody(selfRegisterSchema),
  c.selfRegister,
);
router.get("/events/:id/delegates", validateParams(eventIdParamsSchema), c.listDelegates);
router.get(
  "/events/:id/delegates/:delegateId/badge",
  validateParams(delegateIdParamsSchema),
  c.getBadge,
);

router.post(
  "/events/:id/sessions",
  validateParams(eventIdParamsSchema),
  validateBody(createSessionSchema),
  c.createSession,
);
router.get("/events/:id/sessions", validateParams(eventIdParamsSchema), c.listSessions);

router.post(
  "/events/:id/check-in",
  validateParams(eventIdParamsSchema),
  validateBody(checkInSchema),
  c.checkIn,
);
router.get("/events/:id/attendance", validateParams(eventIdParamsSchema), c.getAttendance);

router.post(
  "/events/:id/travel",
  validateParams(eventIdParamsSchema),
  validateBody(linkBookingSchema),
  c.linkBooking,
);
router.get("/events/:id/travel", validateParams(eventIdParamsSchema), c.listTravel);

router.post(
  "/events/:id/transfers",
  validateParams(eventIdParamsSchema),
  validateBody(transferSchema),
  c.createTransfer,
);
router.get("/events/:id/transfers", validateParams(eventIdParamsSchema), c.listTransfers);
router.patch(
  "/events/:id/transfers/:transferId",
  validateParams(transferIdParamsSchema),
  validateBody(updateTransferSchema),
  c.updateTransfer,
);
router.post(
  "/events/:id/transfers/:transferId/book",
  validateParams(transferIdParamsSchema),
  c.bookTransfer,
);

router.post(
  "/events/:id/budget/lines",
  validateParams(eventIdParamsSchema),
  validateBody(budgetLineSchema),
  c.upsertBudgetLine,
);
router.get("/events/:id/budget", validateParams(eventIdParamsSchema), c.getBudget);

router.post(
  "/events/:id/sponsors",
  validateParams(eventIdParamsSchema),
  validateBody(sponsorSchema),
  c.createSponsor,
);
router.get("/events/:id/sponsors", validateParams(eventIdParamsSchema), c.listSponsors);

router.get("/events/:id/report", validateParams(eventIdParamsSchema), c.getReport);

export default router;
