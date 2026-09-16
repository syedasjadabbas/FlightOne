/**
 * Supplier reconciliation — compares FlightOne booking vs provided invoice amounts.
 * Never fabricates supplier invoice data.
 */
import prisma from "../../../../config/prisma.js";
import { AppError } from "../../../../lib/customError.js";
import { assertNonNegativeMinorAmount } from "../../../../lib/money.js";
import { configuredCapability } from "../capability.js";

export function getReconciliationCapability() {
  return configuredCapability("reconciliation", {
    verified: true,
    reasons: [
      "Internal reconciliation against FlightOne booking/net amounts",
      "External supplier statement import requires invoicedMinor from authoritative source",
    ],
  });
}

/**
 * Reconcile a booking using FlightOne authoritative expected amount (netMinor)
 * against an optional supplier-invoiced amount. Without invoiced amount → DATA_UNAVAILABLE.
 */
export async function reconcileBooking({
  bookingId,
  invoicedMinor,
  externalRef,
  notes,
  idempotencyKey,
  actorUserId,
} = {}) {
  if (!bookingId) throw new AppError(400, "bookingId is required");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      supplierCode: true,
      externalRef: true,
      currency: true,
      amountMinor: true,
      netMinor: true,
      status: true,
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");

  const key = idempotencyKey || `recon:${bookingId}:${invoicedMinor ?? "none"}:${externalRef || booking.externalRef || "noref"}`;
  const existing = await prisma.supplierReconItem.findUnique({ where: { idempotencyKey: key } }).catch(() => null);
  if (existing) return { ...existing, deduplicated: true };

  const expectedMinor = booking.netMinor;
  assertNonNegativeMinorAmount(expectedMinor, "expectedMinor");

  let status = "DATA_UNAVAILABLE";
  let mismatchReason = null;
  if (invoicedMinor === undefined || invoicedMinor === null) {
    status = "DATA_UNAVAILABLE";
    mismatchReason = "No authoritative supplier invoiced amount provided";
  } else {
    assertNonNegativeMinorAmount(invoicedMinor, "invoicedMinor");
    if (invoicedMinor === expectedMinor) {
      status = "MATCHED";
    } else {
      status = "MISMATCH";
      mismatchReason = `expected netMinor=${expectedMinor} vs invoicedMinor=${invoicedMinor}`;
    }
  }

  // Also flag if externalRef mismatch when both present
  const ref = externalRef || null;
  if (ref && booking.externalRef && ref !== booking.externalRef && status === "MATCHED") {
    status = "REQUIRES_REVIEW";
    mismatchReason = `amount matched but externalRef differs (booking=${booking.externalRef}, invoice=${ref})`;
  }

  const item = await prisma.supplierReconItem.create({
    data: {
      supplierCode: booking.supplierCode || "UNKNOWN",
      externalRef: ref || booking.externalRef || null,
      bookingId: booking.id,
      expectedMinor,
      invoicedMinor: invoicedMinor ?? null,
      currency: booking.currency,
      status,
      notes: notes || null,
      mismatchReason,
      idempotencyKey: key,
    },
  });

  return { ...item, deduplicated: false, capability: getReconciliationCapability(), actorUserId };
}
