/**
 * Payment provider abstraction (Module 03).
 * Tokenized methods only — never accepts or stores PAN/CVV.
 * Success is only reported from a real provider response (or explicit non-prod simulation).
 */
import { AppError } from "../../lib/customError.js";

export const PAYMENT_UNCONFIGURED = "PAYMENT_UNCONFIGURED";

const PAN_RE = /^\d{13,19}$/;

export function looksLikeRawCardNumber(value) {
  if (typeof value !== "string") return false;
  const digits = value.replace(/[\s-]/g, "");
  return PAN_RE.test(digits);
}

export function allowSimulatedPayment() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_SIMULATED_PAYMENT === "true";
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getPaymentCapability() {
  if (isStripeConfigured()) {
    return {
      configured: true,
      provider: "STRIPE",
      mode: "live",
      canCapture: true,
      reasons: [],
    };
  }
  if (allowSimulatedPayment()) {
    return {
      configured: true,
      provider: "SIMULATED",
      mode: "simulated",
      canCapture: true,
      reasons: ["ALLOW_SIMULATED_PAYMENT=true — test/dev only, never production"],
    };
  }
  return {
    configured: false,
    provider: "UNCONFIGURED",
    mode: "unconfigured",
    canCapture: false,
    reasons: ["No payment gateway credentials configured (STRIPE_SECRET_KEY)"],
  };
}

export function assertTokenizedMethod(paymentMethodToken) {
  if (!paymentMethodToken || typeof paymentMethodToken !== "string") {
    throw new AppError(400, "paymentMethodToken is required");
  }
  const token = paymentMethodToken.trim();
  if (!token) throw new AppError(400, "paymentMethodToken is required");
  if (looksLikeRawCardNumber(token)) {
    throw new AppError(400, "Raw card numbers/CVV are not accepted — use a tokenized payment method");
  }
  if (token.length > 200) {
    throw new AppError(400, "paymentMethodToken is invalid");
  }
  return token;
}

/**
 * Charge a tokenized method. Never returns success without a provider response.
 * @returns {Promise<{ status: "CAPTURED"|"AUTHORIZED"|"FAILED", provider: string, providerPaymentId?: string, failureReason?: string, raw?: object }>}
 */
export async function captureWithProvider({ amountMinor, currency, paymentMethodToken, idempotencyKey }) {
  const token = assertTokenizedMethod(paymentMethodToken);
  const cap = getPaymentCapability();

  if (cap.mode === "unconfigured") {
    const err = new AppError(503, "Payment gateway is not configured");
    err.code = PAYMENT_UNCONFIGURED;
    err.details = { capability: cap };
    throw err;
  }

  if (cap.mode === "simulated") {
    if (/fail|decline/i.test(token)) {
      return {
        status: "FAILED",
        provider: "SIMULATED",
        failureReason: "Simulated payment declined",
      };
    }
    return {
      status: "CAPTURED",
      provider: "SIMULATED",
      providerPaymentId: `sim_${idempotencyKey || Date.now()}`,
    };
  }

  return stripeCapture({ amountMinor, currency, paymentMethodToken: token, idempotencyKey });
}

async function stripeCapture({ amountMinor, currency, paymentMethodToken, idempotencyKey }) {
  const key = process.env.STRIPE_SECRET_KEY;
  const body = new URLSearchParams({
    amount: String(amountMinor),
    currency: String(currency).toLowerCase(),
    payment_method: paymentMethodToken,
    confirm: "true",
    confirmation_method: "automatic",
  });

  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
    });
  } catch (e) {
    return {
      status: "FAILED",
      provider: "STRIPE",
      failureReason: e?.message || "Stripe network error",
    };
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return { status: "FAILED", provider: "STRIPE", failureReason: "Stripe returned a non-JSON response" };
  }

  const id = typeof json.id === "string" ? json.id : null;
  if (json.status === "succeeded" && id) {
    return { status: "CAPTURED", provider: "STRIPE", providerPaymentId: id, raw: { id, status: json.status } };
  }
  if (json.status === "requires_capture" && id) {
    return { status: "AUTHORIZED", provider: "STRIPE", providerPaymentId: id, raw: { id, status: json.status } };
  }
  const reason =
    json.error?.message ||
    json.last_payment_error?.message ||
    json.status ||
    `Stripe HTTP ${res.status}`;
  return { status: "FAILED", provider: "STRIPE", providerPaymentId: id, failureReason: reason };
}

export async function voidWithProvider({ provider, providerPaymentId }) {
  if (!providerPaymentId) return { status: "skipped", reason: "no provider payment id" };
  if (provider === "SIMULATED" || provider === "CORPORATE_CREDIT") {
    return { status: "VOIDED", provider };
  }
  if (provider === "STRIPE" && isStripeConfigured()) {
    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${providerPaymentId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      const json = await res.json().catch(() => null);
      if (json?.status === "canceled") return { status: "VOIDED", provider: "STRIPE" };
      return { status: "failed", reason: json?.error?.message || json?.status || "cancel failed" };
    } catch (e) {
      return { status: "failed", reason: e?.message || "Stripe cancel network error" };
    }
  }
  return { status: "skipped", reason: "provider cannot void" };
}
