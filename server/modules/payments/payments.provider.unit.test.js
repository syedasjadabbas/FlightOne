/**
 * Payment provider — unconfigured honesty + tokenized methods only.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_UNCONFIGURED,
  assertTokenizedMethod,
  captureWithProvider,
  getPaymentCapability,
} from "./payments.provider.js";

describe("payments.provider — unconfigured", () => {
  const prevStripe = process.env.STRIPE_SECRET_KEY;
  const prevSim = process.env.ALLOW_SIMULATED_PAYMENT;
  const prevEnv = process.env.NODE_ENV;

  before(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.ALLOW_SIMULATED_PAYMENT;
    process.env.NODE_ENV = "test";
  });

  after(() => {
    if (prevStripe === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevStripe;
    if (prevSim === undefined) delete process.env.ALLOW_SIMULATED_PAYMENT;
    else process.env.ALLOW_SIMULATED_PAYMENT = prevSim;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  });

  it("exposes an honest unconfigured capability", () => {
    const cap = getPaymentCapability();
    assert.equal(cap.configured, false);
    assert.equal(cap.canCapture, false);
    assert.equal(cap.provider, "UNCONFIGURED");
    assert.equal(cap.mode, "unconfigured");
  });

  it("never reports capture success without a provider", async () => {
    await assert.rejects(
      () =>
        captureWithProvider({
          amountMinor: 1000,
          currency: "USD",
          paymentMethodToken: "pm_test_ok",
        }),
      (err) => err.statusCode === 503 && err.code === PAYMENT_UNCONFIGURED,
    );
  });

  it("rejects raw card numbers / CVV-shaped PAN", () => {
    assert.throws(
      () => assertTokenizedMethod("4242424242424242"),
      (err) => err.statusCode === 400 && /tokenized/i.test(err.message),
    );
  });
});

describe("payments.provider — simulated opt-in", () => {
  const prevStripe = process.env.STRIPE_SECRET_KEY;
  const prevSim = process.env.ALLOW_SIMULATED_PAYMENT;
  const prevEnv = process.env.NODE_ENV;

  before(() => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    process.env.NODE_ENV = "test";
  });

  after(() => {
    if (prevStripe === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevStripe;
    if (prevSim === undefined) delete process.env.ALLOW_SIMULATED_PAYMENT;
    else process.env.ALLOW_SIMULATED_PAYMENT = prevSim;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  });

  it("captures only with a simulated provider response", async () => {
    const ok = await captureWithProvider({
      amountMinor: 1000,
      currency: "USD",
      paymentMethodToken: "pm_test_ok",
      idempotencyKey: "k1",
    });
    assert.equal(ok.status, "CAPTURED");
    assert.equal(ok.provider, "SIMULATED");
    assert.ok(ok.providerPaymentId);
  });

  it("returns FAILED from the provider on decline tokens", async () => {
    const fail = await captureWithProvider({
      amountMinor: 1000,
      currency: "USD",
      paymentMethodToken: "pm_fail_card",
    });
    assert.equal(fail.status, "FAILED");
    assert.equal(fail.provider, "SIMULATED");
  });
});
