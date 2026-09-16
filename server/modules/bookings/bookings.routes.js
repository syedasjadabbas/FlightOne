import { Router } from "express";
import { validateBody, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as bookingsController from "./bookings.controller.js";
import { payBookingSchema } from "../payments/payments.validators.js";
import {
  cancelBookingSchema,
  createBookingSchema,
  listBookingsQuerySchema,
  reserveBookingSchema,
  ticketBookingSchema,
  acceptPriceChangeSchema,
} from "./bookings.validators.js";

const router = Router();

router.use(requireAuth);

router.post("/", validateBody(createBookingSchema), bookingsController.create);
router.get("/", validateQuery(listBookingsQuerySchema), bookingsController.list);
router.get("/:id", bookingsController.getById);
router.post("/:id/pay", validateBody(payBookingSchema), bookingsController.pay);
router.post("/:id/reserve", validateBody(reserveBookingSchema), bookingsController.reserve);
router.post("/:id/ticket", validateBody(ticketBookingSchema), bookingsController.ticket);
router.post(
  "/:id/accept-price",
  validateBody(acceptPriceChangeSchema),
  bookingsController.acceptPrice,
);
router.post("/:id/cancel", validateBody(cancelBookingSchema), bookingsController.cancel);

export default router;
