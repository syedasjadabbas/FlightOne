import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as paymentsController from "./payments.controller.js";
import { payBookingSchema } from "./payments.validators.js";

const router = Router();

router.get("/capability", paymentsController.capability);
router.post("/bookings/:id/pay", requireAuth, validateBody(payBookingSchema), paymentsController.pay);

export default router;
