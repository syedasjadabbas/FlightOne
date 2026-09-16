/**
 * Shared NotificationOutbox delivery adapters (APP / EMAIL / WHATSAPP).
 *
 * APP: in-app inbox is the outbox row itself — delivery = mark available (SENT).
 * EMAIL / WHATSAPP: only succeed when a webhook (or future SMTP) is configured;
 * otherwise return not_configured and leave/mark FAILED — never pretend SENT.
 *
 * Env:
 *   NOTIFY_EMAIL_WEBHOOK_URL=
 *   NOTIFY_WHATSAPP_WEBHOOK_URL=
 *   NOTIFY_WEBHOOK_API_KEY= (optional Bearer for both)
 *   NOTIFY_WEBHOOK_TIMEOUT_MS=10000
 */

import logger from "../logger.js";

/**
 * @typedef {{ ok: true, provider: string } | { ok: false, reason: string, retryable?: boolean }} DeliveryResult
 */

function webhookConfig(channel, env = process.env) {
  const url =
    channel === "EMAIL"
      ? env.NOTIFY_EMAIL_WEBHOOK_URL?.trim()
      : channel === "WHATSAPP"
        ? env.NOTIFY_WHATSAPP_WEBHOOK_URL?.trim()
        : null;
  return {
    url: url || null,
    apiKey: env.NOTIFY_WEBHOOK_API_KEY?.trim() || null,
    timeoutMs: Number(env.NOTIFY_WEBHOOK_TIMEOUT_MS) || 10_000,
  };
}

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
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverEmailNotification(notification, deps = {}) {
  return deliverWebhookChannel("EMAIL", notification, deps);
}

/**
 * @param {object} notification
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverWhatsAppNotification(notification, deps = {}) {
  return deliverWebhookChannel("WHATSAPP", notification, deps);
}

async function deliverWebhookChannel(channel, notification, deps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const cfg = webhookConfig(channel, env);

  if (!cfg.url) {
    logger.warn("notify.channel.not_configured", {
      channel,
      id: notification.id,
    });
    return {
      ok: false,
      reason: `${channel.toLowerCase()}_webhook_not_configured`,
      retryable: false,
    };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", retryable: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;

    const res = await fetchImpl(cfg.url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        channel,
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        payload: notification.payload ?? null,
        notificationId: notification.id,
        dedupeKey: notification.dedupeKey,
      }),
    });

    if (!res.ok) {
      logger.error("notify.webhook.failed", {
        channel,
        id: notification.id,
        status: res.status,
      });
      return {
        ok: false,
        reason: `webhook_status_${res.status}`,
        retryable: res.status >= 500 || res.status === 429,
      };
    }

    logger.info("notify.webhook.sent", { channel, id: notification.id });
    return { ok: true, provider: `${channel.toLowerCase()}-webhook` };
  } catch (e) {
    logger.error("notify.webhook.error", {
      channel,
      id: notification.id,
      err: e?.message,
    });
    return {
      ok: false,
      reason: `webhook_error:${e?.name || "Error"}`,
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
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
    default:
      return {
        ok: false,
        reason: `unsupported_channel:${notification.channel}`,
        retryable: false,
      };
  }
}
