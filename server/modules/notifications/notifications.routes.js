import { Router } from "express";
import {
  handleSmsCallback,
  handleWhatsAppCallback,
  verifyWhatsAppWebhook,
} from "./notifications.controller.js";

const router = Router();

// SMS DLR / status callback (Twilio, generic gateway)
router.post("/callbacks/sms", handleSmsCallback);

// WhatsApp Cloud API verification (GET) and status callbacks (POST)
router.get("/callbacks/whatsapp", verifyWhatsAppWebhook);
router.post("/callbacks/whatsapp", handleWhatsAppCallback);

export default router;
