/**
 * JazzCash Payment Provider Adapter (Module 03 / Appendix A).
 * Supports Mobile Wallet (MWALLET) transactions.
 * Strict PCI-DSS SAQ-A compliance: never asks for, accepts, or stores MPIN.
 */
import crypto from "node:crypto";
import { AppError } from "../../../lib/customError.js";
import { allowSimulatedPayment, looksLikeRawCardNumber } from "../payments.provider.js";

const PK_MOBILE_RE = /^(?:\+92|92|0)?(3\d{9})$/;

/**
 * Validate and normalize a Pakistani mobile phone number (03XXXXXXXXX).
 */
export function assertPakistaniMobileNumber(value) {
  if (!value || typeof value !== "string") {
    throw new AppError(400, "Mobile account number is required for mobile wallet payment");
  }
  const trimmed = value.trim();
  if (looksLikeRawCardNumber(trimmed)) {
    throw new AppError(400, "Raw card numbers are not accepted for mobile wallet payment");
  }
  const match = trimmed.match(PK_MOBILE_RE);
  if (!match) {
    throw new AppError(
      400,
      "Invalid Pakistani mobile number — format must be 03XXXXXXXXX (e.g. 03001234567)",
    );
  }
  return `0${match[1]}`;
}

export function isJazzCashConfigured() {
  return Boolean(
    process.env.JAZZCASH_MERCHANT_ID &&
      process.env.JAZZCASH_PASSWORD &&
      process.env.JAZZCASH_INTEGRITY_SALT,
  );
}

export function getJazzCashCapability() {
  if (isJazzCashConfigured()) {
    return {
      configured: true,
      provider: "JAZZCASH",
      mode: "live",
      canCapture: true,
      reasons: [],
    };
  }
  if (allowSimulatedPayment()) {
    return {
      configured: true,
      provider: "JAZZCASH",
      mode: "simulated",
      canCapture: true,
      reasons: ["ALLOW_SIMULATED_PAYMENT=true — test/dev sandbox fallback only"],
    };
  }
  return {
    configured: false,
    provider: "JAZZCASH",
    mode: "unconfigured",
    canCapture: false,
    reasons: ["Missing JazzCash merchant credentials (JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, JAZZCASH_INTEGRITY_SALT)"],
  };
}

/**
 * Calculate JazzCash HMAC-SHA256 secure hash from alphabetical key sequence.
 */
export function calculateJazzCashHash(params, salt) {
  if (!salt) return null;
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "pp_SecureHash" && params[k] !== undefined && params[k] !== null && String(params[k]).trim() !== "")
    .sort();

  const str = sortedKeys.map((k) => String(params[k])).join("&");
  const fullStr = `${salt}&${str}`;
  return crypto.createHmac("sha256", salt).update(fullStr).digest("hex").toUpperCase();
}

/**
 * Verify incoming JazzCash callback / IPN signature.
 */
export function verifyJazzCashCallback(payload) {
  const salt = process.env.JAZZCASH_INTEGRITY_SALT;
  if (!salt) return allowSimulatedPayment();
  const receivedHash = payload?.pp_SecureHash;
  if (!receivedHash) return false;
  const computedHash = calculateJazzCashHash(payload, salt);
  return receivedHash.toUpperCase() === computedHash;
}

/**
 * Initiate / Charge JazzCash Mobile Wallet payment.
 */
export async function jazzCashCharge({
  amountMinor,
  currency,
  accountNumber,
  cnicLast6,
  idempotencyKey,
  bookingId,
}) {
  const mobile = assertPakistaniMobileNumber(accountNumber);
  const cap = getJazzCashCapability();

  if (cap.mode === "unconfigured") {
    throw new AppError(503, "JazzCash payment gateway is not configured");
  }

  if (cap.mode === "simulated") {
    if (/fail|decline|9999999/i.test(mobile)) {
      return {
        status: "FAILED",
        provider: "JAZZCASH",
        failureReason: "JazzCash account balance insufficient or transaction declined (simulated)",
        metadata: {
          accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
          pp_ResponseCode: "124",
          simulated: true,
        },
      };
    }
    const txnRef = `JC${Date.now()}`;
    return {
      status: "CAPTURED",
      provider: "JAZZCASH",
      providerPaymentId: `jc_sim_${idempotencyKey || txnRef}`,
      metadata: {
        accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
        pp_TxnRefNo: txnRef,
        pp_BillReference: bookingId ? `FO-${bookingId.slice(-8)}` : undefined,
        pp_ResponseCode: "000",
        simulated: true,
      },
    };
  }

  // Live / Sandbox Gateway Execution
  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  const salt = process.env.JAZZCASH_INTEGRITY_SALT;
  const apiUrl =
    process.env.JAZZCASH_API_URL ||
    "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction";

  const txnRef = `T${Date.now()}`;
  const amountStr = String(Math.round(amountMinor)); // Minor units in PKR Paisas (e.g. PKR 100.00 = 10000)

  const payload = {
    pp_Version: "2.0",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: txnRef,
    pp_Amount: amountStr,
    pp_TxnCurrency: currency === "PKR" ? "PKR" : "PKR",
    pp_BillReference: bookingId ? `FO${bookingId.slice(-8)}` : "FLIGHTONE",
    pp_Description: `FlightOne Booking ${bookingId || ""}`,
    pp_MobileNumber: mobile,
    ...(cnicLast6 ? { pp_CNIC: cnicLast6 } : {}),
  };

  payload.pp_SecureHash = calculateJazzCashHash(payload, salt);

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
      provider: "JAZZCASH",
      failureReason: e?.message || "JazzCash gateway network error",
    };
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return {
      status: "FAILED",
      provider: "JAZZCASH",
      failureReason: "JazzCash returned non-JSON response",
    };
  }

  const responseCode = String(json.pp_ResponseCode || "");
  const responseMsg = json.pp_ResponseMessage || `JazzCash response code ${responseCode}`;

  if (responseCode === "000") {
    return {
      status: "CAPTURED",
      provider: "JAZZCASH",
      providerPaymentId: json.pp_TxnRefNo || txnRef,
      metadata: {
        accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
        pp_TxnRefNo: json.pp_TxnRefNo,
        pp_RetreivalReferenceNo: json.pp_RetreivalReferenceNo,
        pp_ResponseCode: responseCode,
      },
    };
  }

  if (responseCode === "121" || responseCode === "157") {
    // Awaiting customer MPIN confirmation on handset
    return {
      status: "PENDING",
      provider: "JAZZCASH",
      providerPaymentId: json.pp_TxnRefNo || txnRef,
      failureReason: "Awaiting customer authorization on handset",
      metadata: {
        accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
        pp_TxnRefNo: json.pp_TxnRefNo,
        pp_ResponseCode: responseCode,
      },
    };
  }

  return {
    status: "FAILED",
    provider: "JAZZCASH",
    providerPaymentId: json.pp_TxnRefNo || null,
    failureReason: responseMsg,
    metadata: {
      pp_ResponseCode: responseCode,
      accountNumberMasked: `${mobile.slice(0, 4)}****${mobile.slice(-2)}`,
    },
  };
}
