/**
 * Email provider — Resend API first, optional webhook fallback, simulated sandbox.
 * Looks up recipient from notification payload or User.email; never fabricates delivery.
 */
import logger from "../../logger.js";
import { allowSimulatedNotifications } from "./sms.provider.js";

const RESEND_API_URL = "https://api.resend.com/emails";

export function maskEmail(email) {
  if (!email || typeof email !== "string") return "unknown";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function isEmailConfigured(env = process.env) {
  return Boolean(
    env.RESEND_API_KEY?.trim() || env.NOTIFY_EMAIL_WEBHOOK_URL?.trim(),
  );
}

export function getEmailCapability(env = process.env) {
  if (env.RESEND_API_KEY?.trim()) {
    return { configured: true, provider: "resend", mode: "live" };
  }
  if (env.NOTIFY_EMAIL_WEBHOOK_URL?.trim()) {
    return { configured: true, provider: "email-webhook", mode: "live" };
  }
  if (allowSimulatedNotifications(env)) {
    return {
      configured: true,
      provider: "email-simulated",
      mode: "simulated",
      reasons: [
        "ALLOW_SIMULATED_NOTIFICATIONS=true — test/dev sandbox fallback only",
      ],
    };
  }
  return {
    configured: false,
    provider: "email-unconfigured",
    mode: "unconfigured",
    reasons: ["No RESEND_API_KEY or NOTIFY_EMAIL_WEBHOOK_URL configured"],
  };
}

function fromAddress(env = process.env) {
  return (
    env.RESEND_FROM_EMAIL?.trim() ||
    env.FROM_EMAIL?.trim() ||
    "FlightOne <onboarding@resend.dev>"
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brand HTML for OTP / transactional mail (ported from the old SMTP relay). */
export function buildEmailHtml(notification, { name } = {}) {
  const title = notification.title || "FlightOne notification";
  const otp = notification.payload?.otp;
  const kind = notification.payload?.kind;
  const isVerification = kind === "email_verification_otp";
  const isPasswordReset = kind === "password_reset_otp";
  const greeting = `Hi ${escapeHtml(name || "there")},`;

  let intro = notification.body || "";
  let disclaimer = "";
  if (otp && isVerification) {
    intro = `${greeting}<br/><br/>Use the verification code below to verify your FlightOne account email address:`;
    disclaimer =
      "This code is valid for <strong>10 minutes</strong> and can only be used once. If you did not create a FlightOne account, please ignore this email.";
  } else if (otp && isPasswordReset) {
    intro = `${greeting}<br/><br/>Use the verification code below to reset your FlightOne account password:`;
    disclaimer =
      "This code is valid for <strong>10 minutes</strong> and can only be used once. If you did not request a password reset, please ignore this email.";
  } else if (notification.body) {
    intro = `${greeting}<br/><br/>${escapeHtml(notification.body)}`;
  }

  const otpBlock = otp
    ? `
            <div style="margin: 24px 0; padding: 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
              <span style="font-family: monospace, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #022c43;">${escapeHtml(otp)}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 12px;">${disclaimer}</p>
          `
    : "";

  return `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 22px; font-weight: 700; color: #022c43; letter-spacing: -0.5px;">Flight<span style="color: #00b4d8;">One</span></span>
          </div>
          <h2 style="color: #022c43; font-size: 20px; font-weight: 600; margin-top: 0;">${escapeHtml(title)}</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.5; margin-bottom: 20px;">${intro}</p>
          ${otpBlock}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">© ${new Date().getFullYear()} FlightOne. All rights reserved.</p>
        </div>
      `;
}

async function resolveRecipient(notification, deps = {}) {
  const fromPayload =
    notification.payload?.email ||
    notification.payload?.to ||
    notification.payload?.recipientEmail ||
    null;
  if (typeof fromPayload === "string" && fromPayload.includes("@")) {
    return {
      email: fromPayload.trim().toLowerCase(),
      name: notification.payload?.name || null,
    };
  }

  if (!notification.userId) return null;

  if (typeof deps.resolveRecipient === "function") {
    return deps.resolveRecipient(notification.userId);
  }

  try {
    const prisma = deps.prisma ?? (await import("../../../config/prisma.js")).default;
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, name: true },
    });
    if (!user?.email) return null;
    return { email: user.email, name: user.name };
  } catch (e) {
    logger.error("notify.email.recipient_lookup_failed", {
      id: notification.id,
      err: e?.message,
    });
    return null;
  }
}

/**
 * @param {object} notification
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv, prisma?: object, resolveRecipient?: Function }} [deps]
 */
export async function dispatchEmail(notification, deps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const capability = getEmailCapability(env);

  if (!capability.configured) {
    logger.warn("notify.email.not_configured", { id: notification.id });
    return {
      ok: false,
      reason: "email_not_configured",
      retryable: false,
      provider: capability.provider,
    };
  }

  const recipient = await resolveRecipient(notification, deps);

  if (capability.mode === "simulated") {
    const messageId = `sim_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info("notify.email.simulated", {
      id: notification.id,
      to: maskEmail(recipient?.email),
      messageId,
    });
    return { ok: true, provider: "email-simulated", messageId };
  }

  if (!recipient?.email) {
    return {
      ok: false,
      reason: "email_recipient_missing",
      retryable: false,
      provider: capability.provider,
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      reason: "fetch_unavailable",
      retryable: false,
      provider: capability.provider,
    };
  }

  const timeoutMs = Number(env.NOTIFY_EMAIL_TIMEOUT_MS) || 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (capability.provider === "resend") {
      const apiKey = env.RESEND_API_KEY.trim();
      const subject = notification.title || "FlightOne notification";
      const text =
        notification.body ||
        (notification.payload?.otp
          ? `Verification code: ${notification.payload.otp}`
          : subject);
      const html = buildEmailHtml(notification, { name: recipient.name });

      const res = await fetchImpl(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(notification.dedupeKey
            ? { "Idempotency-Key": String(notification.dedupeKey).slice(0, 256) }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          from: fromAddress(env),
          to: [recipient.email],
          subject,
          html,
          text,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        logger.error("notify.email.resend.failed", {
          id: notification.id,
          to: maskEmail(recipient.email),
          status: res.status,
          err: body?.message || body?.name,
        });
        return {
          ok: false,
          reason: `resend_status_${res.status}`,
          retryable: res.status >= 500 || res.status === 429,
          provider: "resend",
        };
      }

      const messageId = body.id || `resend_${Date.now()}`;
      logger.info("notify.email.resend.sent", {
        id: notification.id,
        to: maskEmail(recipient.email),
        messageId,
      });
      return { ok: true, provider: "resend", messageId };
    }

    // Legacy webhook fallback (local relay / custom gateway)
    const webhookUrl = env.NOTIFY_EMAIL_WEBHOOK_URL.trim();
    const apiKey = env.NOTIFY_WEBHOOK_API_KEY?.trim() || null;
    const headers = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        channel: "EMAIL",
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        payload: notification.payload ?? null,
        notificationId: notification.id,
        dedupeKey: notification.dedupeKey,
      }),
    });

    if (!res.ok) {
      logger.error("notify.email.webhook.failed", {
        id: notification.id,
        status: res.status,
      });
      return {
        ok: false,
        reason: `webhook_status_${res.status}`,
        retryable: res.status >= 500 || res.status === 429,
        provider: "email-webhook",
      };
    }

    const resJson =
      typeof res.json === "function" ? await res.json().catch(() => ({})) : {};
    const messageId = resJson?.messageId || resJson?.id || null;
    logger.info("notify.email.webhook.sent", { id: notification.id });
    return {
      ok: true,
      provider: "email-webhook",
      ...(messageId ? { messageId } : {}),
    };
  } catch (e) {
    logger.error("notify.email.error", {
      id: notification.id,
      err: e?.message,
    });
    return {
      ok: false,
      reason: `email_error:${e?.name || "Error"}`,
      retryable: true,
      provider: capability.provider,
    };
  } finally {
    clearTimeout(timer);
  }
}
