/**
 * Production-ready SMS Provider Adapter (Module 00 / Appendix D / Appendix A).
 * Supports Twilio, Generic HTTP SMS Gateway, and Webhook fallback.
 * Strict security: never logs unmasked numbers or sends raw card/credential data.
 * Fails closed when unconfigured (never fabricates live delivery).
 */
import logger from "../../logger.js";

const PK_MOBILE_RE = /^(?:\+92|92|0)?(3\d{9})$/;
const E164_RE = /^\+?[1-9]\d{6,14}$/;

/**
 * Normalize and validate recipient phone number.
 * Formats Pakistani mobile numbers to E.164 (+923XXXXXXXXX) or preserves valid E.164.
 */
export function normalizePhoneNumber(raw) {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().replace(/[\s\-()]/g, "");
  const pkMatch = clean.match(PK_MOBILE_RE);
  if (pkMatch) {
    return `+92${pkMatch[1]}`;
  }
  if (E164_RE.test(clean)) {
    return clean.startsWith("+") ? clean : `+${clean}`;
  }
  return null;
}

export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") return "unknown";
  if (phone.length <= 5) return "***";
  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
}

export function isSmsConfigured(env = process.env) {
  if (env.TWILIO_ACCOUNT_SID?.trim() && env.TWILIO_AUTH_TOKEN?.trim()) {
    return true;
  }
  if (env.SMS_API_URL?.trim()) {
    return true;
  }
  if (env.NOTIFY_SMS_WEBHOOK_URL?.trim()) {
    return true;
  }
  return false;
}

export function allowSimulatedNotifications(env = process.env) {
  return env.ALLOW_SIMULATED_NOTIFICATIONS === "true";
}

export function getSmsCapability(env = process.env) {
  if (env.TWILIO_ACCOUNT_SID?.trim() && env.TWILIO_AUTH_TOKEN?.trim()) {
    return { configured: true, provider: "twilio", mode: "live" };
  }
  if (env.SMS_API_URL?.trim()) {
    return { configured: true, provider: "generic-http", mode: "live" };
  }
  if (env.NOTIFY_SMS_WEBHOOK_URL?.trim()) {
    return { configured: true, provider: "sms-webhook", mode: "live" };
  }
  if (allowSimulatedNotifications(env)) {
    return {
      configured: true,
      provider: "sms-simulated",
      mode: "simulated",
      reasons: ["ALLOW_SIMULATED_NOTIFICATIONS=true — test/dev sandbox fallback only"],
    };
  }
  return {
    configured: false,
    provider: "sms-unconfigured",
    mode: "unconfigured",
    reasons: ["No live SMS provider configured (Twilio, SMS_API_URL, or NOTIFY_SMS_WEBHOOK_URL)"],
  };
}

/**
 * Dispatch SMS via configured provider adapter.
 * @param {object} notification Outbox row object
 * @param {object} [deps] Injected dependencies (fetchImpl, env)
 * @returns {Promise<{ ok: boolean, provider: string, messageId?: string, retryable?: boolean, reason?: string }>}
 */
export async function dispatchSms(notification, deps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const capability = getSmsCapability(env);

  if (!capability.configured) {
    logger.warn("notify.sms.not_configured", { id: notification.id });
    return {
      ok: false,
      reason: "sms_not_configured",
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
  const phone = normalizePhoneNumber(rawPhone);

  if (!phone) {
    logger.warn("notify.sms.missing_recipient_phone", {
      id: notification.id,
      userId: notification.userId,
    });
    return {
      ok: false,
      reason: "sms_recipient_phone_missing_or_invalid",
      retryable: false,
      provider: capability.provider,
    };
  }

  const messageText = notification.body || notification.title || "";
  const timeoutMs = Number(env.NOTIFY_SMS_TIMEOUT_MS) || 10_000;

  // 1. Simulated Provider
  if (capability.mode === "simulated") {
    const messageId = `sim_sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info("notify.sms.simulated", {
      id: notification.id,
      to: maskPhoneNumber(phone),
      messageId,
    });
    return { ok: true, provider: "sms-simulated", messageId };
  }

  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", retryable: false, provider: capability.provider };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 2. Twilio REST API
    if (capability.provider === "twilio") {
      const accountSid = env.TWILIO_ACCOUNT_SID.trim();
      const authToken = env.TWILIO_AUTH_TOKEN.trim();
      const fromNumber = env.TWILIO_FROM_NUMBER?.trim() || env.SMS_SENDER_ID?.trim() || "FlightOne";
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const params = new URLSearchParams({
        To: phone,
        From: fromNumber,
        Body: messageText,
      });

      const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
      const res = await fetchImpl(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
        signal: controller.signal,
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const status = res.status;
        logger.error("notify.sms.twilio.failed", {
          id: notification.id,
          to: maskPhoneNumber(phone),
          status,
          errCode: body.code,
          errMsg: body.message,
        });
        return {
          ok: false,
          reason: `twilio_status_${status}:${body.code || "error"}`,
          retryable: status >= 500 || status === 429,
          provider: "sms-twilio",
        };
      }

      logger.info("notify.sms.twilio.sent", {
        id: notification.id,
        to: maskPhoneNumber(phone),
        sid: body.sid,
      });
      return { ok: true, provider: "sms-twilio", messageId: body.sid || `tw_${Date.now()}` };
    }

    // 3. Generic HTTP SMS API (Telenor / Jazz / Infobip / Generic gateway)
    if (capability.provider === "generic-http") {
      const apiUrl = env.SMS_API_URL.trim();
      const apiKey = env.SMS_API_KEY?.trim() || null;
      const apiSecret = env.SMS_API_SECRET?.trim() || null;
      const senderId = env.SMS_SENDER_ID?.trim() || "FlightOne";

      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (apiKey) headers["X-API-Key"] = apiKey;
      if (apiSecret) headers["X-API-Secret"] = apiSecret;

      const res = await fetchImpl(apiUrl, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          to: phone,
          from: senderId,
          text: messageText,
          notificationId: notification.id,
          dedupeKey: notification.dedupeKey,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const status = res.status;
        return {
          ok: false,
          reason: `sms_gateway_status_${status}`,
          retryable: status >= 500 || status === 429,
          provider: "sms-generic-http",
        };
      }

      const messageId = body.messageId || body.id || body.reference || `sms_${Date.now()}`;
      return { ok: true, provider: "sms-generic-http", messageId };
    }

    // 4. Webhook SMS Gateway
    if (capability.provider === "sms-webhook") {
      const webhookUrl = env.NOTIFY_SMS_WEBHOOK_URL.trim();
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
          channel: "SMS",
          to: phone,
          userId: notification.userId,
          title: notification.title,
          body: messageText,
          payload: notification.payload ?? null,
          notificationId: notification.id,
          dedupeKey: notification.dedupeKey,
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          reason: `sms_webhook_status_${res.status}`,
          retryable: res.status >= 500 || res.status === 429,
          provider: "sms-webhook",
        };
      }

      const resJson = await res.json().catch(() => ({}));
      const messageId = resJson.messageId || resJson.id || `sms_hook_${Date.now()}`;
      return { ok: true, provider: "sms-webhook", messageId };
    }

    return { ok: false, reason: "unsupported_sms_provider", retryable: false, provider: capability.provider };
  } catch (e) {
    logger.error("notify.sms.error", {
      id: notification.id,
      err: e?.message,
    });
    return {
      ok: false,
      reason: `sms_error:${e?.name || "Error"}`,
      retryable: true,
      provider: capability.provider,
    };
  } finally {
    clearTimeout(timer);
  }
}
