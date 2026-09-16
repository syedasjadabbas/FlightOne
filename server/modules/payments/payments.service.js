/**
 * Module 03 — tokenized payment capture against a booking.
 * Does not invent success. Corporate credit is recorded only after Module 06 approval.
 */
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

const PAYMENT_SELECT = {
  id: true,
  userId: true,
  bookingId: true,
  status: true,
  provider: true,
  currency: true,
  amountMinor: true,
  providerPaymentId: true,
  // paymentMethodToken is stored for gateway ops but never returned to clients.
  failureReason: true,
  idempotencyKey: true,
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
      // Amounts intentionally omitted — ledger loads Payment row authoritatively.
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
  if (booking.status !== "QUOTED") {
    throw new AppError(409, `Cannot pay a booking in status ${booking.status}`);
  }
}

/**
 * Capture (or record corporate credit) for a quoted booking.
 */
export async function payBooking(
  userId,
  bookingId,
  { paymentMethodToken, idempotencyKey, method } = {},
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
      return enqueuePaymentCaptured(existing);
    }
    if (existing?.status === "FAILED") retryFailedId = existing.id;
  }

  const already = await getSuccessfulPayment(bookingId, userId);
  if (already) return enqueuePaymentCaptured(already);

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
    };
    if (retryFailedId) {
      return enqueuePaymentCaptured(
        await prisma.payment.update({
          where: { id: retryFailedId },
          data: corpData,
          select: PAYMENT_SELECT,
        }),
      );
    }
    return enqueuePaymentCaptured(
      await prisma.payment.create({
        data: corpData,
        select: PAYMENT_SELECT,
      }),
    );
  }

  // Fully covered by reward credit — no card capture.
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
    };
    if (retryFailedId) {
      return enqueuePaymentCaptured(
        await prisma.payment.update({
          where: { id: retryFailedId },
          data: zeroData,
          select: PAYMENT_SELECT,
        }),
      );
    }
    return enqueuePaymentCaptured(
      await prisma.payment.create({
        data: zeroData,
        select: PAYMENT_SELECT,
      }),
    );
  }

  let result;
  try {
    result = await captureWithProvider({
      amountMinor: payableMinor,
      currency: booking.currency,
      paymentMethodToken,
      idempotencyKey: idempotencyKey || bookingId,
    });
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw e;
  }

  const payData = {
    userId,
    bookingId,
    status: result.status,
    provider: result.provider,
    currency: booking.currency,
    amountMinor: payableMinor,
    providerPaymentId: result.providerPaymentId ?? null,
    paymentMethodToken,
    failureReason: result.failureReason ?? null,
    idempotencyKey: idempotencyKey ?? null,
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
  return enqueuePaymentCaptured(row);
}

export async function voidSuccessfulPayments(bookingId, userId, { reason } = {}) {
  const rows = await prisma.payment.findMany({
    where: { bookingId, userId, status: { in: ["AUTHORIZED", "CAPTURED"] } },
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
