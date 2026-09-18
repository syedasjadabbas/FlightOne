/**
 * Local Pakistani Payment Providers — Unit Tests (Module 03 / Appendix A).
 * Covers JazzCash, Easypaisa, 1Link IBFT, SAQ-A no-card/no-MPIN rules, and hash verification.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  assertPakistaniMobileNumber,
  calculateJazzCashHash,
  getJazzCashCapability,
  jazzCashCharge,
  verifyJazzCashCallback,
} from "./providers/jazzcash.provider.js";
import {
  calculateEasypaisaHash,
  easypaisaCharge,
  getEasypaisaCapability,
  verifyEasypaisaCallback,
} from "./providers/easypaisa.provider.js";
import {
  generateConsumerNumber,
  getBankPaymentInstructions,
  getOneLinkCapability,
  oneLinkInitiate,
} from "./providers/onelink.provider.js";
import { getPaymentCapability, captureWithProvider } from "./payments.provider.js";

describe("local payments — mobile number & SAQ-A validation", () => {
  it("accepts valid Pakistani mobile numbers in various formats and normalizes to 03XXXXXXXXX", () => {
    assert.equal(assertPakistaniMobileNumber("03001234567"), "03001234567");
    assert.equal(assertPakistaniMobileNumber("+923001234567"), "03001234567");
    assert.equal(assertPakistaniMobileNumber("923001234567"), "03001234567");
    assert.equal(assertPakistaniMobileNumber("03459876543"), "03459876543");
  });

  it("rejects raw card numbers (PAN) passed as account numbers", () => {
    assert.throws(
      () => assertPakistaniMobileNumber("4242424242424242"),
      (err) => err.statusCode === 400 && /raw card/i.test(err.message),
    );
  });

  it("rejects non-Pakistani or malformed phone numbers", () => {
    assert.throws(
      () => assertPakistaniMobileNumber("12345"),
      (err) => err.statusCode === 400 && /invalid/i.test(err.message),
    );
    assert.throws(
      () => assertPakistaniMobileNumber("+14155552671"),
      (err) => err.statusCode === 400 && /invalid/i.test(err.message),
    );
  });
});

describe("JazzCash provider adapter", () => {
  const prevSim = process.env.ALLOW_SIMULATED_PAYMENT;
  const prevEnv = process.env.NODE_ENV;

  before(() => {
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    process.env.NODE_ENV = "test";
    process.env.JAZZCASH_INTEGRITY_SALT = "test_salt_123";
  });

  after(() => {
    process.env.ALLOW_SIMULATED_PAYMENT = prevSim;
    process.env.NODE_ENV = prevEnv;
    delete process.env.JAZZCASH_INTEGRITY_SALT;
  });

  it("calculates deterministic HMAC-SHA256 secure hash", () => {
    const params = {
      pp_MerchantID: "MC123",
      pp_Amount: "10000",
      pp_TxnRefNo: "T12345",
    };
    const hash = calculateJazzCashHash(params, "test_salt_123");
    assert.ok(hash);
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64);
  });

  it("verifies callback signature correctly", () => {
    const payload = {
      pp_ResponseCode: "000",
      pp_ResponseMessage: "Success",
      pp_TxnRefNo: "T999",
      pp_Amount: "5000",
    };
    payload.pp_SecureHash = calculateJazzCashHash(payload, "test_salt_123");
    assert.equal(verifyJazzCashCallback(payload), true);

    // Tampered payload fails verification
    const tampered = { ...payload, pp_Amount: "99999" };
    assert.equal(verifyJazzCashCallback(tampered), false);
  });

  it("simulates successful JazzCash capture with masked account and providerPaymentId", async () => {
    const result = await jazzCashCharge({
      amountMinor: 25000,
      currency: "PKR",
      accountNumber: "03001234567",
      bookingId: "b-jc-12345",
      idempotencyKey: "jc-idem-1",
    });
    assert.equal(result.status, "CAPTURED");
    assert.equal(result.provider, "JAZZCASH");
    assert.ok(result.providerPaymentId.startsWith("jc_sim_"));
    assert.equal(result.metadata.accountNumberMasked, "0300****67");
    assert.equal(result.metadata.pp_ResponseCode, "000");
  });

  it("simulates JazzCash decline on failure mobile test numbers", async () => {
    const result = await jazzCashCharge({
      amountMinor: 25000,
      currency: "PKR",
      accountNumber: "03009999999",
      bookingId: "b-jc-fail",
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.provider, "JAZZCASH");
    assert.match(result.failureReason, /declined|insufficient/i);
  });
});

describe("Easypaisa provider adapter", () => {
  const prevSim = process.env.ALLOW_SIMULATED_PAYMENT;
  const prevEnv = process.env.NODE_ENV;

  before(() => {
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    process.env.NODE_ENV = "test";
    process.env.EASYPAISA_HASH_KEY = "ep_hash_test_key";
  });

  after(() => {
    process.env.ALLOW_SIMULATED_PAYMENT = prevSim;
    process.env.NODE_ENV = prevEnv;
    delete process.env.EASYPAISA_HASH_KEY;
  });

  it("calculates and verifies Easypaisa hash signature", () => {
    const payload = {
      orderId: "FO12345",
      storeId: "1234",
      transactionAmount: "150.00",
    };
    const hash = calculateEasypaisaHash(payload, "ep_hash_test_key");
    assert.ok(hash);
    assert.equal(verifyEasypaisaCallback({ ...payload, hash }), true);
    assert.equal(verifyEasypaisaCallback({ ...payload, hash: "INVALID" }), false);
  });

  it("simulates successful Easypaisa mobile account capture", async () => {
    const result = await easypaisaCharge({
      amountMinor: 15000,
      currency: "PKR",
      accountNumber: "03451234567",
      bookingId: "b-ep-12345",
      idempotencyKey: "ep-idem-1",
    });
    assert.equal(result.status, "CAPTURED");
    assert.equal(result.provider, "EASYPAISA");
    assert.ok(result.providerPaymentId.startsWith("ep_sim_"));
    assert.equal(result.metadata.accountNumberMasked, "0345****67");
    assert.equal(result.metadata.responseCode, "0000");
  });

  it("simulates Easypaisa failure on decline mobile test numbers", async () => {
    const result = await easypaisaCharge({
      amountMinor: 15000,
      currency: "PKR",
      accountNumber: "03459999999",
      bookingId: "b-ep-fail",
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.provider, "EASYPAISA");
    assert.match(result.failureReason, /declined/i);
  });
});

describe("1Link IBFT / 1Bill provider adapter", () => {
  it("generates deterministic 1Bill consumer numbers", () => {
    const c1 = generateConsumerNumber("cuid_booking_12345678");
    const c2 = generateConsumerNumber("cuid_booking_12345678");
    assert.equal(c1, c2);
    assert.match(c1, /^1001\d{8}$/);
  });

  it("formats bank transfer instructions with IBAN and 1Bill reference", () => {
    const instructions = getBankPaymentInstructions({
      bookingId: "bk_test_12345678",
      amountMinor: 7500000, // PKR 75,000.00
      currency: "PKR",
    });
    assert.ok(instructions.consumerNumber);
    assert.ok(instructions.iban);
    assert.ok(instructions.bankName);
    assert.match(instructions.amountFormatted, /75,000/);
    assert.ok(instructions.instructions.length >= 4);
  });

  it("initiates 1Link IBFT in PENDING hold state", async () => {
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    const init = await oneLinkInitiate({
      amountMinor: 5000000,
      currency: "PKR",
      bookingId: "b-1link-hold",
      idempotencyKey: "1l-idem-1",
    });
    assert.equal(init.status, "PENDING");
    assert.equal(init.provider, "ONELINK_IBFT");
    assert.ok(init.providerPaymentId.startsWith("ibft_"));
    assert.equal(init.metadata.pendingClearance, true);
  });
});

describe("unified payment capability discovery", () => {
  it("exposes all supported methods dictionary", () => {
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    const cap = getPaymentCapability();
    assert.equal(cap.configured, true);
    assert.equal(cap.methods.card, true);
    assert.equal(cap.methods.jazzcash, true);
    assert.equal(cap.methods.easypaisa, true);
    assert.equal(cap.methods.onelink_ibft, true);
  });

  it("allows method-specific capability query", () => {
    const jc = getPaymentCapability("jazzcash");
    assert.equal(jc.provider, "JAZZCASH");
    const ep = getPaymentCapability("easypaisa");
    assert.equal(ep.provider, "EASYPAISA");
    const ol = getPaymentCapability("onelink_ibft");
    assert.equal(ol.provider, "ONELINK_IBFT");
  });
});
