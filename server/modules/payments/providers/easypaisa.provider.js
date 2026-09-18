/**
 * Easypaisa Payment Provider Adapter (Module 03 / Appendix A).
 * Supports Mobile Account (MA) direct debit initiation.
 * Strict PCI-DSS SAQ-A compliance: never asks for, accepts, or stores wallet PIN or OTP.
 */
import crypto from "node:crypto";
import { AppError } from "../../../lib/customError.js";
import { allowSimulatedPayment } from "../payments.provider.js";
import { assertPakistaniMobileNumber } from "./jazzcash.provider.js";

export function isEasypaisaConfigured() {
  return Boolean(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
}

export function getEasypaisaCapability() {
  if (isEasypaisaConfigured()) {
    return {
      configured: true,
      provider: "EASYPAISA",
      mode: "live",
      canCapture: true,
      reasons: [],
    };
  }
  if (allowSimulatedPayment()) {
    return {
      configured: true,
      provider: "EASYPAISA",
      mode: "simulated",
      canCapture: true,
      reasons: ["ALLOW_SIMULATED_PAYMENT=true — test/dev sandbox fallback only"],
    };
  }
  return {
    configured: false,
    provider: "EASYPAISA",
    mode: "unconfigured",
    canCapture: false,
    reasons: ["Missing Easypaisa merchant credentials (EASYPAISA_STORE_ID, EASYPAISA_HASH_KEY)"],
  };
}

/**
 * Calculate Easypaisa request signature.
 */
export function calculateEasypaisaHash(params, hashKey) {
  if (!hashKey) return null;
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "hash" && params[k] !== undefined && params[k] !== null && String(params[k]).trim() !== "")
    .sort();
  const raw = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHmac("sha256", hashKey).update(raw).digest("hex").toUpperCase();
}

/**
 * Verify Easypaisa callback / IPN signature.
 */
export function verifyEasypaisaCallback(payload) {
  const hashKey = process.env.EASYPAISA_HASH_KEY;
  if (!hashKey) return allowSimulatedPayment();
  const receivedHash = payload?.hash || payload?.secureHash;
  if (!receivedHash) return false;
  const computed = calculateEasypaisaHash(payload, hashKey);
  return receivedHash.toUpperCase() === computed;
}

/**
 * Initiate / Charge Easypaisa Mobile Account payment.
 */
export async function easypaisaCharge({
  amountMinor,
  currency,
  accountNumber,
  email,
  idempotencyKey,
  bookingId,
}) {
  const mobile = assertPakistaniMobileNumber(accountNumber);
  const cap = getEasypaisaCapability();

  if (cap.mode === "unconfigured") {
    throw new AppError(503, "Easypaisa payment gateway is not configured");
  }

  if (cap.mode === "simulated") {
    if (/fail|decline|9999999/i.test(mobile)) {
      return {
        status: "FAILED",
        provider: "EASYPAISA",
        failureReason: "Easypaisa transaction declined or mobile account inactive (simulated)",
        metadata: {
          accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
          responseCode: "0001",
          simulated: true,
        },
      };
    }
    const orderId = `EP_${Date.now()}`;
    return {
      status: "CAPTURED",
      provider: "EASYPAISA",
      providerPaymentId: `ep_sim_${idempotencyKey || orderId}`,
      metadata: {
        accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
        orderId,
        bookingId,
        responseCode: "0000",
        simulated: true,
      },
    };
  }

  // Live / Sandbox Gateway Execution
  const storeId = process.env.EASYPAISA_STORE_ID;
  const hashKey = process.env.EASYPAISA_HASH_KEY;
  const apiUrl =
    process.env.EASYPAISA_API_URL ||
    "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction";

  const orderId = bookingId ? `FO${bookingId.slice(-8)}${Date.now().toString().slice(-4)}` : `FO${Date.now()}`;
  // Amount in PKR decimal string (e.g. 15000 minor = "150.00")
  const amountPkr = (amountMinor / 100).toFixed(2);

  const payload = {
    orderId,
    storeId,
    transactionAmount: amountPkr,
    transactionType: "MA",
    mobileAccountNo: mobile,
    emailAddress: email || "customer@flightone.pk",
  };

  payload.hash = calculateEasypaisaHash(payload, hashKey);

  let res;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return {
      status: "FAILED",
      provider: "EASYPAISA",
      failureReason: e?.message || "Easypaisa gateway network error",
    };
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return {
      status: "FAILED",
      provider: "EASYPAISA",
      failureReason: "Easypaisa returned non-JSON response",
    };
  }

  const responseCode = String(json.responseCode || "");
  const responseDesc = json.responseDesc || `Easypaisa code ${responseCode}`;

  if (responseCode === "0000") {
    return {
      status: "CAPTURED",
      provider: "EASYPAISA",
      providerPaymentId: json.transactionId || orderId,
      metadata: {
        orderId,
        transactionId: json.transactionId,
        accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
        responseCode,
      },
    };
  }

  if (responseCode === "0003" || responseCode === "0005") {
    // Awaiting customer OTP or push authorization on Easypaisa app
    return {
      status: "PENDING",
      provider: "EASYPAISA",
      providerPaymentId: json.transactionId || orderId,
      failureReason: "Awaiting customer approval in Easypaisa app",
      metadata: {
        orderId,
        transactionId: json.transactionId,
        accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
        responseCode,
      },
    };
  }

  return {
    status: "FAILED",
    provider: "EASYPAISA",
    providerPaymentId: json.transactionId || null,
    failureReason: responseDesc,
    metadata: {
      orderId,
      responseCode,
      accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
    },
  };
}
