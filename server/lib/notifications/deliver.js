/**
 * Shared NotificationOutbox delivery adapters (APP / EMAIL / WHATSAPP / SMS).
 *
 * APP: in-app inbox is the outbox row itself — delivery = mark available (SENT).
 * EMAIL: Resend API (preferred) or NOTIFY_EMAIL_WEBHOOK_URL fallback.
 * WHATSAPP / SMS: provider adapters (Meta / Twilio / webhooks).
 *
 * Env:
 *   RESEND_API_KEY=
 *   RESEND_FROM_EMAIL=FlightOne <onboarding@resend.dev>
 *   NOTIFY_EMAIL_WEBHOOK_URL=   (legacy fallback)
 *   NOTIFY_WHATSAPP_WEBHOOK_URL=
 *   NOTIFY_WEBHOOK_API_KEY= (optional Bearer for webhooks)
 *   NOTIFY_WEBHOOK_TIMEOUT_MS=10000
 */

import logger from "../logger.js";
import { dispatchEmail } from "./providers/email.provider.js";
import { dispatchSms } from "./providers/sms.provider.js";
import { dispatchWhatsApp } from "./providers/whatsapp.provider.js";

/**
 * @typedef {{ ok: true, provider: string, messageId?: string } | { ok: false, reason: string, retryable?: boolean, provider?: string }} DeliveryResult
 */

/** @type {(notification: object, deps?: object) => Promise<DeliveryResult>} */
export async function deliverAppNotification(notification) {
  // In-app channel: persistence in NotificationOutbox IS delivery.
  logger.info("notify.app.ready", {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
  });
  return { ok: true, provider: "app-inbox" };
}

/**
 * @param {object} notification
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv, prisma?: object, resolveRecipient?: Function }} [deps]
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverEmailNotification(notification, deps = {}) {
  return dispatchEmail(notification, deps);
}

/**
 * @param {object} notification
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverWhatsAppNotification(notification, deps = {}) {
  return dispatchWhatsApp(notification, deps);
}

/**
 * @param {object} notification
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverSmsNotification(notification, deps = {}) {
  return dispatchSms(notification, deps);
}

/**
 * Dispatch one outbox row by channel.
 * @param {object} notification
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverNotification(notification, deps = {}) {
  switch (notification.channel) {
    case "APP":
      return deliverAppNotification(notification, deps);
    case "EMAIL":
      return deliverEmailNotification(notification, deps);
    case "WHATSAPP":
      return deliverWhatsAppNotification(notification, deps);
    case "SMS":
      return deliverSmsNotification(notification, deps);
    default:
      return {
        ok: false,
        reason: `unsupported_channel:${notification.channel}`,
        retryable: false,
      };
  }
}
