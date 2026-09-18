import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as paymentsController from "./payments.controller.js";
import { payBookingSchema } from "./payments.validators.js";

const router = Router();

router.get("/capability", paymentsController.capability);
router.post("/bookings/:id/pay", requireAuth, validateBody(payBookingSchema), paymentsController.pay);

// Webhook / IPN / Callback routes for local Pakistani payment providers
router.post("/callbacks/jazzcash", paymentsController.jazzcashCallback);
router.get("/callbacks/jazzcash", paymentsController.jazzcashCallback);

router.post("/callbacks/easypaisa", paymentsController.easypaisaCallback);
router.get("/callbacks/easypaisa", paymentsController.easypaisaCallback);

router.post("/callbacks/1link", paymentsController.onelinkCallback);

// Manual bank transfer confirmation by Ops / Finance
router.post("/bank-transfer/:id/confirm", requireAuth, paymentsController.confirmBankTransfer);

export default router;
