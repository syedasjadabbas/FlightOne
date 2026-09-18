/**
 * Module 14 — payment refund/void adapter (reuses payments provider).
 * Never fabricates success when gateway is unconfigured.
 */
import { getPaymentCapability, voidWithProvider, allowSimulatedPayment } from "../payments/payments.provider.js";

/**
 * Attempt to return funds for a booking's successful payments.
 * @returns {{ status: string, refs: string[], note?: string, provider?: string }}
 */
export async function attemptPaymentRefundForBooking(prisma, bookingId, { amountMinor, idempotencyKey } = {}) {
  const payments = await prisma.payment.findMany({
    where: {
      bookingId,
      status: { in: ["CAPTURED", "AUTHORIZED"] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!payments.length) {
    return {
      status: "NONE",
      refs: [],
      note: "No CAPTURED/AUTHORIZED payments on booking — nothing to refund via payment provider",
    };
  }

  const cap = getPaymentCapability();
  const refs = [];

  // Pre-capture AUTHORIZED → void (existing path).
  const authorized = payments.filter((p) => p.status === "AUTHORIZED");
  for (const p of authorized) {
    const result = await voidWithProvider({
      provider: p.provider,
      providerPaymentId: p.providerPaymentId,
    });
    if (result.status === "VOIDED") {
      await prisma.payment.update({
        where: { id: p.id },
        data: { status: "VOIDED" },
      });
      refs.push(p.providerPaymentId || p.id);
    }
  }

  const captured = payments.filter((p) => p.status === "CAPTURED");
  if (!captured.length) {
    return {
      status: refs.length ? "VOIDED" : "NONE",
      refs,
      note: refs.length ? "Authorized payments voided" : undefined,
      provider: cap.provider,
    };
  }

  if (cap.mode === "unconfigured") {
    return {
      status: "PENDING_MANUAL",
      refs,
      note: "Payment gateway unconfigured — cash refund requires manual ops processing",
      provider: "UNCONFIGURED",
    };
  }

  if (cap.mode === "simulated" && allowSimulatedPayment()) {
    for (const p of captured) {
      await prisma.payment.update({
        where: { id: p.id },
        data: { status: "VOIDED" },
      });
      refs.push(p.providerPaymentId || `sim_refund_${p.id}`);
    }
    return {
      status: "PROVIDER_REFUNDED",
      refs,
      note: "Simulated payment refund (dev only)",
      provider: "SIMULATED",
    };
  }

  if (cap.provider === "STRIPE") {
    const key = process.env.STRIPE_SECRET_KEY;
    for (const p of captured) {
      if (!p.providerPaymentId) {
        return {
          status: "PENDING_MANUAL",
          refs,
          note: "Stripe payment missing providerPaymentId — manual refund required",
          provider: "STRIPE",
        };
      }
      try {
        const body = new URLSearchParams({
          payment_intent: p.providerPaymentId,
        });
        if (amountMinor != null && Number.isFinite(amountMinor)) {
          body.set("amount", String(Math.min(amountMinor, p.amountMinor)));
        }
        const res = await fetch("https://api.stripe.com/v1/refunds", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...(idempotencyKey
              ? { "Idempotency-Key": `refund:${idempotencyKey}:${p.id}` }
              : {}),
          },
          body,
        });
        const json = await res.json().catch(() => null);
        if (json?.id && (json.status === "succeeded" || json.status === "pending")) {
          refs.push(json.id);
        } else {
          return {
            status: "FAILED",
            refs,
            note: json?.error?.message || json?.status || `Stripe refund HTTP ${res.status}`,
            provider: "STRIPE",
          };
        }
      } catch (e) {
        return {
          status: "FAILED",
          refs,
          note: e?.message || "Stripe refund network error",
          provider: "STRIPE",
        };
      }
    }
    return {
      status: "PROVIDER_REFUNDED",
      refs,
      note: "Stripe refund created",
      provider: "STRIPE",
    };
  }

  const localProviders = ["JAZZCASH", "EASYPAISA", "ONELINK_IBFT"];
  const hasLocal = captured.some((p) => localProviders.includes(p.provider));
  if (hasLocal) {
    return {
      status: "PENDING_MANUAL",
      refs,
      note: `Local payment method (${captured[0].provider}) requires manual ops bank reversal / wallet refund`,
      provider: captured[0].provider,
    };
  }

  return {
    status: "UNSUPPORTED",
    refs,
    note: `Provider ${cap.provider} does not support automated capture refunds`,
    provider: cap.provider,
  };
}
