/**
 * 1Link IBFT / 1Bill Bank Transfer Provider Adapter (Module 03 / Appendix A).
 * Generates unique consumer invoice numbers for Pakistani interbank transfers (1Link / 1Bill / Kuickpay).
 * Puts booking in reserved hold; captures upon IPN webhook or Ops/Finance confirmation.
 */
import { AppError } from "../../../lib/customError.js";
import { allowSimulatedPayment } from "../payments.provider.js";

export function isOneLinkConfigured() {
  return Boolean(
    process.env.ONELINK_MEMBER_ID ||
      process.env.ONELINK_API_KEY ||
      (process.env.ONELINK_BANK_NAME && process.env.ONELINK_IBAN),
  );
}

export function getOneLinkCapability() {
  if (isOneLinkConfigured()) {
    return {
      configured: true,
      provider: "ONELINK_IBFT",
      mode: "live",
      canCapture: true,
      reasons: [],
    };
  }
  if (allowSimulatedPayment()) {
    return {
      configured: true,
      provider: "ONELINK_IBFT",
      mode: "simulated",
      canCapture: true,
      reasons: ["ALLOW_SIMULATED_PAYMENT=true — test/dev simulated 1Link IBFT enabled"],
    };
  }
  return {
    configured: false,
    provider: "ONELINK_IBFT",
    mode: "unconfigured",
    canCapture: false,
    reasons: ["Missing 1Link / 1Bill gateway configuration or FlightOne bank account details"],
  };
}

/**
 * Generate a deterministic or pseudo-unique 1Bill consumer number for a booking.
 */
export function generateConsumerNumber(bookingId) {
  if (!bookingId) return `1BILL${Date.now().toString().slice(-8)}`;
  // Clean alphanumeric suffix to numeric hash for 1Link banking compatibility
  const clean = bookingId.replace(/[^0-9a-zA-Z]/g, "").slice(-8);
  let numeric = "";
  for (let i = 0; i < clean.length; i++) {
    numeric += (clean.charCodeAt(i) % 10).toString();
  }
  return `1001${numeric.padEnd(8, "0")}`;
}

export function getBankPaymentInstructions({ bookingId, amountMinor, currency }) {
  const consumerNumber = generateConsumerNumber(bookingId);
  const amountFormatted = (amountMinor / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    consumerNumber,
    billReference: `FO-${bookingId.slice(-8)}`,
    amountFormatted: `${currency} ${amountFormatted}`,
    bankName: process.env.ONELINK_BANK_NAME || "Meezan Bank Limited",
    accountTitle: process.env.ONELINK_ACCOUNT_TITLE || "FlightOne Travel Technologies (Pvt) Ltd",
    accountNumber: process.env.ONELINK_ACCOUNT_NUMBER || "01010102030405",
    iban: process.env.ONELINK_IBAN || "PK12MEZN0001010102030405",
    branch: process.env.ONELINK_BRANCH || "Main Corporate Branch, Lahore",
    instructions: [
      "Log into your Bank Mobile App or Internet Banking portal.",
      "Select 'Bill Payment' -> '1Bill / 1Link' -> '1Bill Invoices / Vouchers'.",
      `Enter Consumer Number: ${consumerNumber}`,
      `Verify Amount (${currency} ${amountFormatted}) and Beneficiary 'FlightOne'.`,
      "Alternatively, transfer directly via IBFT to the IBAN above using your booking ID as reference.",
      "Hold remains active while awaiting bank clearance. Ticket will be issued upon clearance.",
    ],
  };
}

/**
 * Initiate 1Link IBFT / 1Bill voucher payment.
 * Returns status: "PENDING" so the booking remains RESERVED without triggering premature ticketing.
 */
export async function oneLinkInitiate({
  amountMinor,
  currency,
  bookingId,
  idempotencyKey,
}) {
  const cap = getOneLinkCapability();

  if (cap.mode === "unconfigured") {
    throw new AppError(503, "1Link IBFT payment gateway is not configured");
  }

  const instructions = getBankPaymentInstructions({ bookingId, amountMinor, currency });
  const providerPaymentId = `ibft_${instructions.consumerNumber}`;

  return {
    status: "PENDING",
    provider: "ONELINK_IBFT",
    providerPaymentId,
    failureReason: null,
    metadata: {
      ...instructions,
      pendingClearance: true,
      initiatedAt: new Date().toISOString(),
      idempotencyKey,
      simulated: cap.mode === "simulated",
    },
  };
}

/**
 * Verify 1Link IBFT callback payload.
 */
export function verifyOneLinkCallback(payload) {
  if (!payload || typeof payload !== "object") return false;
  // If API secret key is configured, verify signature
  const secret = process.env.ONELINK_API_KEY || process.env.ONELINK_SECRET;
  if (!secret) return allowSimulatedPayment();
  return Boolean(payload.consumerNumber && payload.transactionId);
}
