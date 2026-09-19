/**
 * Production-ready WhatsApp Provider Adapter (Module 00 / Appendix D / Appendix A).
 * Supports Meta WhatsApp Business Cloud API, Webhook Gateway, and Test Simulation.
 * Complies with strict security: masks recipient numbers in logs, never sends credentials/raw card data.
 * Fails closed when unconfigured (never fabricates live delivery).
 */
import logger from "../../logger.js";
import { normalizePhoneNumber, maskPhoneNumber, allowSimulatedNotifications } from "./sms.provider.js";

export { normalizePhoneNumber, maskPhoneNumber };

/**
 * Format phone number for Meta WhatsApp Cloud API (digits only with country code, no '+').
 */
export function formatWhatsAppRecipient(rawPhone) {
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) return null;
  return normalized.replace(/^\+/, "");
}

export function isWhatsAppConfigured(env = process.env) {
  if (
    (env.WHATSAPP_API_TOKEN?.trim() || env.WHATSAPP_ACCESS_TOKEN?.trim()) &&
    env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  ) {
    return true;
  }
  if (env.NOTIFY_WHATSAPP_WEBHOOK_URL?.trim()) {
    return true;
  }
  return false;
}

export function getWhatsAppCapability(env = process.env) {
  if (
    (env.WHATSAPP_API_TOKEN?.trim() || env.WHATSAPP_ACCESS_TOKEN?.trim()) &&
    env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  ) {
    return { configured: true, provider: "whatsapp-cloud", mode: "live" };
  }
  if (env.NOTIFY_WHATSAPP_WEBHOOK_URL?.trim()) {
    return { configured: true, provider: "whatsapp-webhook", mode: "live" };
  }
  if (allowSimulatedNotifications(env)) {
    return {
      configured: true,
      provider: "whatsapp-simulated",
      mode: "simulated",
      reasons: ["ALLOW_SIMULATED_NOTIFICATIONS=true — test/dev sandbox fallback only"],
    };
  }
  return {
    configured: false,
    provider: "whatsapp-unconfigured",
    mode: "unconfigured",
    reasons: ["No WhatsApp Business API credentials (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, or NOTIFY_WHATSAPP_WEBHOOK_URL)"],
  };
}

/**
 * Dispatch WhatsApp notification via Meta Cloud API or Webhook.
 * @param {object} notification Outbox row object
 * @param {object} [deps] Injected dependencies (fetchImpl, env)
 * @returns {Promise<{ ok: boolean, provider: string, messageId?: string, retryable?: boolean, reason?: string }>}
 */
export async function dispatchWhatsApp(notification, deps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const capability = getWhatsAppCapability(env);

  if (!capability.configured) {
    logger.warn("notify.whatsapp.not_configured", { id: notification.id });
    return {
      ok: false,
      reason: "whatsapp_webhook_not_configured",
      retryable: false,
      provider: capability.provider,
    };
  }

  // Extract destination phone from payload or recipient
  const rawPhone =
    notification.payload?.phone ||
    notification.payload?.recipientPhone ||
    notification.payload?.mobile ||
    null;
  const formattedPhone = formatWhatsAppRecipient(rawPhone);

  // 1. Simulated Provider
  if (capability.mode === "simulated") {
    const messageId = `sim_wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info("notify.whatsapp.simulated", {
      id: notification.id,
      to: maskPhoneNumber(formattedPhone || "none"),
      messageId,
    });
    return { ok: true, provider: "whatsapp-simulated", messageId };
  }

  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", retryable: false, provider: capability.provider };
  }

  const timeoutMs = Number(env.NOTIFY_WHATSAPP_TIMEOUT_MS) || 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 2. Meta WhatsApp Business Cloud API
    if (capability.provider === "whatsapp-cloud") {
      if (!formattedPhone) {
        return {
          ok: false,
          reason: "whatsapp_recipient_phone_missing_or_invalid",
          retryable: false,
          provider: "whatsapp-cloud",
        };
      }

      const token = env.WHATSAPP_API_TOKEN?.trim() || env.WHATSAPP_ACCESS_TOKEN?.trim();
      const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID.trim();
      const baseUrl = env.WHATSAPP_API_URL?.trim() || "https://graph.facebook.com/v20.0";
      const endpoint = `${baseUrl.replace(/\/+$/, "")}/${phoneNumberId}/messages`;

      const textBody = notification.body || notification.title || "";
      const template = notification.payload?.whatsappTemplate;

      const requestBody = template
        ? {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template,
          }
        : {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "text",
            text: { preview_url: false, body: textBody },
          };

      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const status = res.status;
        logger.error("notify.whatsapp.cloud.failed", {
          id: notification.id,
          to: maskPhoneNumber(formattedPhone),
          status,
          err: body.error?.message,
        });
        return {
          ok: false,
          reason: `whatsapp_cloud_status_${status}:${body.error?.code || "error"}`,
          retryable: status >= 500 || status === 429,
          provider: "whatsapp-cloud",
        };
      }

      const messageId = body.messages?.[0]?.id || `wamid_${Date.now()}`;
      logger.info("notify.whatsapp.cloud.sent", {
        id: notification.id,
        to: maskPhoneNumber(formattedPhone),
        messageId,
      });
      return { ok: true, provider: "whatsapp-cloud", messageId };
    }

    // 3. Webhook Fallback
    if (capability.provider === "whatsapp-webhook") {
      const webhookUrl = env.NOTIFY_WHATSAPP_WEBHOOK_URL.trim();
      const apiKey = env.NOTIFY_WEBHOOK_API_KEY?.trim() || null;
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const res = await fetchImpl(webhookUrl, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          channel: "WHATSAPP",
          to: formattedPhone,
          userId: notification.userId,
          title: notification.title,
          body: notification.body,
          payload: notification.payload ?? null,
          notificationId: notification.id,
          dedupeKey: notification.dedupeKey,
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          reason: `webhook_status_${res.status}`,
          retryable: res.status >= 500 || res.status === 429,
          provider: "whatsapp-webhook",
        };
      }

      const resJson = await res.json().catch(() => ({}));
      const messageId = resJson.messageId || resJson.id || `wa_hook_${Date.now()}`;
      return { ok: true, provider: "whatsapp-webhook", messageId };
    }

    return { ok: false, reason: "unsupported_whatsapp_provider", retryable: false, provider: capability.provider };
  } catch (e) {
    logger.error("notify.whatsapp.error", {
      id: notification.id,
      err: e?.message,
    });
    return {
      ok: false,
      reason: `webhook_error:${e?.name || "Error"}`,
      retryable: true,
      provider: capability.provider,
    };
  } finally {
    clearTimeout(timer);
  }
}
