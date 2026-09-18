/**
 * Module 03 — tokenized payment capture against a booking.
 * Supports Card (Stripe), Corporate Credit, Reward Credit, JazzCash, Easypaisa, 1Link IBFT.
 * Does not invent success. Corporate credit is recorded only after Module 06 approval.
 */
import logger from "../../lib/logger.js";
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { assertNonNegativeMinorAmount } from "../../lib/money.js";
import * as corporateService from "../corporate/corporate.service.js";
import { chargeableAmountMinor } from "../rewards/rewards.service.js";
import {
  PAYMENT_UNCONFIGURED,
  captureWithProvider,
  getPaymentCapability,
  voidWithProvider,
} from "./payments.provider.js";
import { verifyJazzCashCallback } from "./providers/jazzcash.provider.js";
import { verifyEasypaisaCallback } from "./providers/easypaisa.provider.js";
import { verifyOneLinkCallback } from "./providers/onelink.provider.js";

const PAYMENT_SELECT = {
  id: true,
  userId: true,
  bookingId: true,
  status: true,
  provider: true,
  currency: true,
  amountMinor: true,
  providerPaymentId: true,
  failureReason: true,
  idempotencyKey: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

export { getPaymentCapability, PAYMENT_UNCONFIGURED };

/**
 * Module 15 — finance ledger hook. Never throws; payment success is source of truth.
 */
async function enqueueOpsEventSafe(event) {
  try {
    const { enqueueOpsEvent } = await import("../operations/operations.service.js");
    await enqueueOpsEvent(event);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to enqueue ops payment event", {
      type: event?.type,
      aggregateId: event?.aggregateId,
      err: e,
    });
  }
}

async function enqueuePaymentCaptured(row) {
  if (!row || !["CAPTURED", "AUTHORIZED"].includes(row.status)) return row;
  await enqueueOpsEventSafe({
    type: "PAYMENT_CAPTURED",
    aggregateType: "Payment",
    aggregateId: row.id,
    idempotencyKey: `ops:payment:captured:${row.id}`,
    payload: {
      paymentId: row.id,
      bookingId: row.bookingId,
      userId: row.userId,
      provider: row.provider,
    },
  });
  return row;
}

export async function getSuccessfulPayment(bookingId, userId) {
  return prisma.payment.findFirst({
    where: {
      bookingId,
      userId,
      status: { in: ["AUTHORIZED", "CAPTURED"] },
    },
    orderBy: { createdAt: "desc" },
    select: PAYMENT_SELECT,
  });
}

export function assertBookingPayable(booking, userId) {
  if (!booking || booking.userId !== userId) {
    throw new AppError(404, "Booking not found");
  }
  if (!["QUOTED", "RESERVED"].includes(booking.status)) {
    throw new AppError(409, `Cannot pay a booking in status ${booking.status}`);
  }
}

/**
 * Trigger ticketing when payment captures against a RESERVED hold.
 * Fails closed: if supplier ticketing is unconfigured or rejected, booking remains RESERVED.
 */
async function maybeTriggerTicketing(userId, bookingId, bookingStatus, paymentRow) {
  if (
    bookingStatus === "RESERVED" &&
    paymentRow &&
    ["CAPTURED", "AUTHORIZED"].includes(paymentRow.status)
  ) {
    try {
      const { ticketBooking } = await import("../bookings/bookings.service.js");
      await ticketBooking(userId, bookingId, {}, "CUSTOMER");
    } catch (ticketErr) {
      logger.warn("Automatic ticketing after payment failed or supplier unconfigured", {
        bookingId,
        err: ticketErr?.message,
      });
    }
  }
}

/**
 * Capture (or record corporate credit / local payment) for a quoted or reserved booking.
 */
export async function payBooking(
  userId,
  bookingId,
  {
    paymentMethodToken,
    accountNumber,
    cnicLast6,
    email,
    idempotencyKey,
    method,
  } = {},
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: {
      id: true,
      userId: true,
      status: true,
      amountMinor: true,
      currency: true,
      metadata: true,
    },
  });
  assertBookingPayable(booking, userId);
  assertNonNegativeMinorAmount(booking.amountMinor, "amountMinor");
  const payableMinor = chargeableAmountMinor(booking);
  assertNonNegativeMinorAmount(payableMinor, "payableMinor");

  let retryFailedId = null;
  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({
      where: { bookingId_idempotencyKey: { bookingId, idempotencyKey } },
      select: PAYMENT_SELECT,
    });
    if (existing && existing.status !== "FAILED") {
      if (existing.status === "CAPTURED" || existing.status === "AUTHORIZED") {
        return enqueuePaymentCaptured(existing);
      }
      return existing; // e.g. PENDING 1Link IBFT
    }
    if (existing?.status === "FAILED") retryFailedId = existing.id;
  }

  const already = await getSuccessfulPayment(bookingId, userId);
  if (already) {
    await maybeTriggerTicketing(userId, bookingId, booking.status, already);
    return enqueuePaymentCaptured(already);
  }

  const companyId = booking.metadata?.companyId;
  if (companyId || method === "corporate_credit") {
    if (!companyId) {
      throw new AppError(400, "corporate_credit requires a corporate booking");
    }
    await corporateService.assertCorporateBookingAllowed({
      userId,
      companyId,
      bookingId,
      amountMinor: payableMinor,
      currency: booking.currency,
      cabin: booking.metadata?.cabin ?? booking.metadata?.pricing?.input?.cabin,
    });
    const corpData = {
      userId,
      bookingId,
      status: "CAPTURED",
      provider: "CORPORATE_CREDIT",
      currency: booking.currency,
      amountMinor: payableMinor,
      providerPaymentId: `corp_${bookingId}`,
      paymentMethodToken: null,
      idempotencyKey: idempotencyKey ?? `corp-${bookingId}`,
      failureReason: null,
      metadata: { companyId },
    };
    const saved = retryFailedId
      ? await prisma.payment.update({
          where: { id: retryFailedId },
          data: corpData,
          select: PAYMENT_SELECT,
        })
      : await prisma.payment.create({
          data: corpData,
          select: PAYMENT_SELECT,
        });
    await maybeTriggerTicketing(userId, bookingId, booking.status, saved);
    return enqueuePaymentCaptured(saved);
  }

  // Fully covered by reward credit — no gateway capture.
  if (payableMinor === 0) {
    const zeroData = {
      userId,
      bookingId,
      status: "CAPTURED",
      provider: "REWARD_CREDIT",
      currency: booking.currency,
      amountMinor: 0,
      providerPaymentId: `rewards_${bookingId}`,
      paymentMethodToken: null,
      idempotencyKey: idempotencyKey ?? `rewards-zero-${bookingId}`,
      failureReason: null,
      metadata: { zeroCoverage: true },
    };
    const saved = retryFailedId
      ? await prisma.payment.update({
          where: { id: retryFailedId },
          data: zeroData,
          select: PAYMENT_SELECT,
        })
      : await prisma.payment.create({
          data: zeroData,
          select: PAYMENT_SELECT,
        });
    await maybeTriggerTicketing(userId, bookingId, booking.status, saved);
    return enqueuePaymentCaptured(saved);
  }

  const result = await captureWithProvider({
    amountMinor: payableMinor,
    currency: booking.currency,
    paymentMethodToken,
    accountNumber,
    cnicLast6,
    email,
    method: method || "card",
    idempotencyKey: idempotencyKey || bookingId,
    bookingId,
  });

  const payData = {
    userId,
    bookingId,
    status: result.status,
    provider: result.provider,
    currency: booking.currency,
    amountMinor: payableMinor,
    providerPaymentId: result.providerPaymentId ?? null,
    paymentMethodToken:
      paymentMethodToken ||
      (accountNumber ? `${accountNumber.slice(0, 4)}****${accountNumber.slice(-2)}` : null),
    failureReason: result.failureReason ?? null,
    idempotencyKey: idempotencyKey ?? null,
    metadata: result.metadata ?? null,
  };

  const row = retryFailedId
    ? await prisma.payment.update({
        where: { id: retryFailedId },
        data: payData,
        select: PAYMENT_SELECT,
      })
    : await prisma.payment.create({
        data: payData,
        select: PAYMENT_SELECT,
      });

  if (row.status === "FAILED") {
    const err = new AppError(402, result.failureReason || "Payment failed");
    err.code = "PAYMENT_FAILED";
    err.details = { payment: row };
    throw err;
  }

  // PENDING state (e.g. 1Link IBFT bank transfer): return without triggering ticketing
  if (row.status === "PENDING") {
    return row;
  }

  // CAPTURED or AUTHORIZED: trigger ticketing and emit ops event
  await maybeTriggerTicketing(userId, bookingId, booking.status, row);
  return enqueuePaymentCaptured(row);
}

/**
 * Handle JazzCash IPN Callback / Webhook.
 */
export async function handleJazzCashCallback(payload) {
  const verified = verifyJazzCashCallback(payload);
  if (!verified) {
    throw new AppError(400, "Invalid JazzCash callback signature");
  }

  const txnRef = payload?.pp_TxnRefNo;
  const responseCode = String(payload?.pp_ResponseCode || "");

  // Find payment by providerPaymentId or matching metadata
  let payment = await prisma.payment.findFirst({
    where: {
      provider: "JAZZCASH",
      OR: [
        { providerPaymentId: txnRef },
        { providerPaymentId: { startsWith: `jc_sim_` } },
      ],
    },
    select: PAYMENT_SELECT,
  });

  if (!payment && payload?.pp_BillReference) {
    const suffix = payload.pp_BillReference.replace(/^FO-?/, "");
    payment = await prisma.payment.findFirst({
      where: {
        provider: "JAZZCASH",
        bookingId: { endsWith: suffix },
      },
      select: PAYMENT_SELECT,
    });
  }

  if (!payment) {
    throw new AppError(404, "Matching JazzCash payment record not found");
  }

  if (payment.status === "CAPTURED") {
    return { status: "CAPTURED", alreadyProcessed: true, payment };
  }

  const success = responseCode === "000";
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: success ? "CAPTURED" : "FAILED",
      failureReason: success ? null : payload.pp_ResponseMessage || `JazzCash code ${responseCode}`,
      metadata: {
        ...(typeof payment.metadata === "object" ? payment.metadata : {}),
        callbackPayload: {
          pp_ResponseCode: responseCode,
          pp_TxnRefNo: txnRef,
          pp_RetreivalReferenceNo: payload.pp_RetreivalReferenceNo,
          updatedAt: new Date().toISOString(),
        },
      },
    },
    select: PAYMENT_SELECT,
  });

  if (success) {
    const booking = await prisma.booking.findUnique({
      where: { id: updated.bookingId },
      select: { status: true },
    });
    await maybeTriggerTicketing(updated.userId, updated.bookingId, booking?.status, updated);
    await enqueuePaymentCaptured(updated);
  }

  return { status: updated.status, payment: updated };
}

/**
 * Handle Easypaisa IPN Callback / Webhook.
 */
export async function handleEasypaisaCallback(payload) {
  const verified = verifyEasypaisaCallback(payload);
  if (!verified) {
    throw new AppError(400, "Invalid Easypaisa callback signature");
  }

  const orderId = payload?.orderId;
  const transactionId = payload?.transactionId;
  const responseCode = String(payload?.responseCode || "");

  let payment = await prisma.payment.findFirst({
    where: {
      provider: "EASYPAISA",
      OR: [
        { providerPaymentId: transactionId },
        { providerPaymentId: orderId },
        { providerPaymentId: { startsWith: `ep_sim_` } },
      ],
    },
    select: PAYMENT_SELECT,
  });

  if (!payment && orderId) {
    const suffix = orderId.replace(/^FO-?/, "");
    payment = await prisma.payment.findFirst({
      where: {
        provider: "EASYPAISA",
        bookingId: { endsWith: suffix },
      },
      select: PAYMENT_SELECT,
    });
  }

  if (!payment) {
    throw new AppError(404, "Matching Easypaisa payment record not found");
  }

  if (payment.status === "CAPTURED") {
    return { status: "CAPTURED", alreadyProcessed: true, payment };
  }

  const success = responseCode === "0000";
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: success ? "CAPTURED" : "FAILED",
      failureReason: success ? null : payload.responseDesc || `Easypaisa code ${responseCode}`,
      metadata: {
        ...(typeof payment.metadata === "object" ? payment.metadata : {}),
        callbackPayload: {
          responseCode,
          orderId,
          transactionId,
          updatedAt: new Date().toISOString(),
        },
      },
    },
    select: PAYMENT_SELECT,
  });

  if (success) {
    const booking = await prisma.booking.findUnique({
      where: { id: updated.bookingId },
      select: { status: true },
    });
    await maybeTriggerTicketing(updated.userId, updated.bookingId, booking?.status, updated);
    await enqueuePaymentCaptured(updated);
  }

  return { status: updated.status, payment: updated };
}

/**
 * Handle 1Link IBFT / 1Bill Callback Notification.
 */
export async function handleOneLinkCallback(payload) {
  const verified = verifyOneLinkCallback(payload);
  if (!verified) {
    throw new AppError(400, "Invalid 1Link callback payload");
  }

  const consumerNumber = payload.consumerNumber;
  const providerPaymentId = `ibft_${consumerNumber}`;

  const payment = await prisma.payment.findFirst({
    where: {
      provider: "ONELINK_IBFT",
      providerPaymentId,
    },
    select: PAYMENT_SELECT,
  });

  if (!payment) {
    throw new AppError(404, "Matching 1Link IBFT payment record not found");
  }

  if (payment.status === "CAPTURED") {
    return { status: "CAPTURED", alreadyProcessed: true, payment };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CAPTURED",
      failureReason: null,
      metadata: {
        ...(typeof payment.metadata === "object" ? payment.metadata : {}),
        bankConfirmation: {
          transactionId: payload.transactionId,
          bankCode: payload.bankCode,
          stan: payload.stan,
          settledAt: new Date().toISOString(),
        },
      },
    },
    select: PAYMENT_SELECT,
  });

  const booking = await prisma.booking.findUnique({
    where: { id: updated.bookingId },
    select: { status: true },
  });
  await maybeTriggerTicketing(updated.userId, updated.bookingId, booking?.status, updated);
  await enqueuePaymentCaptured(updated);

  return { status: "CAPTURED", payment: updated };
}

/**
 * Confirm 1Link IBFT Bank Transfer receipt via Ops/Finance review.
 * SDS UF-03.6: "Bank transfer — Shows FlightOne account details and reference; hold remains until Finance confirms receipt (Ops confirms in Finance screen)."
 */
export async function confirmBankTransferPayment(paymentId, { staffUserId, bankReference } = {}) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: PAYMENT_SELECT,
  });

  if (!payment) {
    throw new AppError(404, "Payment record not found");
  }
  if (payment.provider !== "ONELINK_IBFT") {
    throw new AppError(400, `Cannot manually confirm payment for provider ${payment.provider}`);
  }
  if (payment.status === "CAPTURED") {
    return payment;
  }
  if (payment.status !== "PENDING") {
    throw new AppError(409, `Cannot confirm payment in status ${payment.status}`);
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "CAPTURED",
      failureReason: null,
      metadata: {
        ...(typeof payment.metadata === "object" ? payment.metadata : {}),
        manualOpsConfirmation: {
          confirmedByStaff: staffUserId || "OPS_STAFF",
          bankReference: bankReference || "IBFT_CONFIRMED",
          confirmedAt: new Date().toISOString(),
        },
      },
    },
    select: PAYMENT_SELECT,
  });

  const booking = await prisma.booking.findUnique({
    where: { id: updated.bookingId },
    select: { status: true },
  });
  await maybeTriggerTicketing(updated.userId, updated.bookingId, booking?.status, updated);
  await enqueuePaymentCaptured(updated);

  return updated;
}

export async function voidSuccessfulPayments(bookingId, userId, { reason } = {}) {
  const rows = await prisma.payment.findMany({
    where: { bookingId, userId, status: { in: ["AUTHORIZED", "CAPTURED", "PENDING"] } },
    select: PAYMENT_SELECT,
  });
  for (const row of rows) {
    await voidWithProvider({
      provider: row.provider,
      providerPaymentId: row.providerPaymentId,
    });
    await prisma.payment.update({
      where: { id: row.id },
      data: { status: "VOIDED", failureReason: reason ?? "voided after supplier failure" },
    });
  }
}
