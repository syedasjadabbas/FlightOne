/**
 * Module 14 — core refund case lifecycle (fail-closed).
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { computeRefundAmounts } from "./refunds.calc.js";
import { notifyServicingUsers } from "./refunds.notify.js";
import { attemptPaymentRefundForBooking } from "./refunds.payment.js";
import {
  BOOKING_TARGET_STATUS_BY_SOURCE,
  CASE_ALLOWED_TRANSITIONS,
} from "./refunds.constants.js";
import * as corporateService from "../corporate/corporate.service.js";

export const MAX_PAGE_SIZE = 100;

export {
  BOOKING_TARGET_STATUS_BY_SOURCE,
  CASE_ALLOWED_TRANSITIONS,
} from "./refunds.constants.js";

export const CALCULATION_SELECT = {
  id: true,
  bookingId: true,
  currency: true,
  grossPaidMinor: true,
  supplierPenaltyMinor: true,
  agencyFeeMinor: true,
  refundableMinor: true,
  nonRefundableMinor: true,
  travelCreditMinor: true,
  dataStatus: true,
  processingTimelineStatus: true,
  processingTimelineNote: true,
  product: true,
  kind: true,
  formula: true,
  createdByUserId: true,
  createdAt: true,
};

export const CASE_SELECT = {
  id: true,
  bookingId: true,
  calculationId: true,
  status: true,
  kind: true,
  reason: true,
  partial: true,
  idempotencyKey: true,
  paymentRefundStatus: true,
  paymentRefundRef: true,
  supplierOperationStatus: true,
  supplierOperationNote: true,
  escalationId: true,
  failureReason: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
};

export const SERVICING_SELECT = {
  id: true,
  bookingId: true,
  userId: true,
  kind: true,
  status: true,
  calculationId: true,
  refundCaseId: true,
  journeyEventId: true,
  idempotencyKey: true,
  currency: true,
  fareDifferenceMinor: true,
  changePenaltyMinor: true,
  agencyFeeMinor: true,
  customerDueMinor: true,
  customerRefundMinor: true,
  dataStatus: true,
  formula: true,
  supplierResponse: true,
  reason: true,
  escalationId: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
};

export const BOOKING_REFUND_SELECT = {
  id: true,
  userId: true,
  status: true,
  currency: true,
  amountMinor: true,
  netMinor: true,
  marginMinor: true,
  fareRules: true,
  product: true,
  supplierCode: true,
  externalRef: true,
  metadata: true,
};

export const CALCULABLE_BOOKING_STATUSES = new Set(Object.keys(BOOKING_TARGET_STATUS_BY_SOURCE));

export async function getBookingOrThrow(bookingId, select = BOOKING_REFUND_SELECT) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select });
  if (!booking) throw new AppError(404, "Booking not found");
  return booking;
}

export async function getCaseOrThrow(id, select = CASE_SELECT) {
  const refundCase = await prisma.refundCase.findUnique({ where: { id }, select });
  if (!refundCase) throw new AppError(404, "Refund case not found");
  return refundCase;
}

export function assertBookingAccess(booking, user, permissions, permissionKey) {
  const isOwner = booking.userId === user.id;
  const hasPerm = hasPermissionEff(permissions, permissionKey);
  if (!isOwner && !hasPerm) throw new AppError(403, "Forbidden");
}

export async function reverseRewardsSafe(bookingId) {
  try {
    const { reverseRewardsForBooking } = await import("../rewards/rewards.service.js");
    await reverseRewardsForBooking(bookingId);
  } catch (e) {
    console.error("Failed to reverse rewards for booking", { bookingId, err: e });
  }
}

export async function enqueueOpsEventSafe(event) {
  try {
    const { enqueueOpsEvent } = await import("../operations/operations.service.js");
    await enqueueOpsEvent(event);
  } catch (e) {
    console.error("Failed to enqueue ops event", { type: event?.type, err: e });
  }
}

export async function writeServicingAudit({
  bookingId,
  refundCaseId,
  servicingRequestId,
  actorUserId,
  action,
  payload,
}) {
  try {
    await prisma.servicingAuditEvent.create({
      data: {
        bookingId,
        refundCaseId: refundCaseId || null,
        servicingRequestId: servicingRequestId || null,
        actorUserId: actorUserId || null,
        action,
        payload: payload || {},
      },
    });
  } catch {
    /* best-effort */
  }
}

export async function resolveConfiguredAgencyFeeBps() {
  if (process.env.REFUND_AGENCY_FEE_BPS != null && process.env.REFUND_AGENCY_FEE_BPS !== "") {
    return Number(process.env.REFUND_AGENCY_FEE_BPS);
  }
  try {
    const row = await prisma.pricingConfig.findUnique({
      where: { key: "refund_agency_fee_bps" },
      select: { valueInt: true },
    });
    if (row?.valueInt != null) return Number(row.valueInt);
  } catch {
    /* ignore */
  }
  return null;
}

export async function getRefundEligibility(user, permissions, bookingId) {
  const booking = await getBookingOrThrow(bookingId);
  assertBookingAccess(booking, user, permissions, "refunds:read");

  if (!CALCULABLE_BOOKING_STATUSES.has(booking.status)) {
    return {
      eligible: false,
      status: "NOT_ELIGIBLE",
      reason: `Booking status ${booking.status} is not eligible for refund servicing`,
      bookingId: booking.id,
      product: booking.product,
    };
  }

  const pricingAgencyFeeBps = await resolveConfiguredAgencyFeeBps();
  const calc = computeRefundAmounts(booking.amountMinor, booking.fareRules, {
    product: booking.product,
    pricingAgencyFeeBps,
  });

  const eligible =
    calc.formula?.rule !== "NON_REFUNDABLE_FARE" &&
    (calc.dataStatus === "OK" ||
      calc.dataStatus === "REQUIRES_HUMAN" ||
      (booking.fareRules && booking.fareRules.refundable === true));

  return {
    eligible: Boolean(eligible),
    status:
      calc.formula?.rule === "NON_REFUNDABLE_FARE"
        ? "NOT_ELIGIBLE"
        : calc.dataStatus === "DATA_UNAVAILABLE"
          ? "DATA_UNAVAILABLE"
          : calc.dataStatus === "REQUIRES_HUMAN"
            ? "REQUIRES_HUMAN"
            : "ELIGIBLE",
    bookingId: booking.id,
    product: booking.product,
    currency: booking.currency,
    calculationPreview: {
      grossPaidMinor: booking.amountMinor,
      ...calc,
      confirmed: calc.dataStatus === "OK",
    },
  };
}

export async function calculateRefund(user, permissions, body = {}) {
  const { bookingId, partialRatio, scheduleChangeAttributed, kind } = body;
  const booking = await getBookingOrThrow(bookingId);
  assertBookingAccess(booking, user, permissions, "refunds:write");

  if (!CALCULABLE_BOOKING_STATUSES.has(booking.status)) {
    throw new AppError(
      400,
      `Booking in status ${booking.status} is not eligible for a refund calculation`,
    );
  }

  const pricingAgencyFeeBps = await resolveConfiguredAgencyFeeBps();
  const amounts = computeRefundAmounts(booking.amountMinor, booking.fareRules, {
    product: booking.product,
    pricingAgencyFeeBps,
    partialRatio: partialRatio ?? 1,
    scheduleChangeAttributed: scheduleChangeAttributed === true,
  });

  const servicingKind =
    kind ||
    (partialRatio != null && partialRatio < 1
      ? "PARTIAL_REFUND"
      : scheduleChangeAttributed
        ? "SCHEDULE_CHANGE"
        : "REFUND");

  const row = await prisma.refundCalculation.create({
    data: {
      bookingId: booking.id,
      currency: booking.currency,
      grossPaidMinor: booking.amountMinor,
      supplierPenaltyMinor: amounts.supplierPenaltyMinor,
      agencyFeeMinor: amounts.agencyFeeMinor,
      refundableMinor: amounts.refundableMinor,
      nonRefundableMinor: amounts.nonRefundableMinor,
      travelCreditMinor: amounts.travelCreditMinor,
      dataStatus: amounts.dataStatus,
      processingTimelineStatus: amounts.processingTimelineStatus,
      processingTimelineNote: amounts.processingTimelineNote,
      product: booking.product,
      kind: servicingKind,
      formula: {
        ...amounts.formula,
        bookingStatusAtCalculation: booking.status,
        confirmed: amounts.dataStatus === "OK",
      },
      createdByUserId: user.id,
    },
    select: CALCULATION_SELECT,
  });

  await writeServicingAudit({
    bookingId: booking.id,
    actorUserId: user.id,
    action: "refund.calculation.created",
    payload: { calculationId: row.id, dataStatus: row.dataStatus },
  });

  return row;
}

export async function createRefundCase(user, permissions, body = {}) {
  const { bookingId, calculationId, reason, partial, idempotencyKey, kind } = body;
  if (idempotencyKey) {
    const existing = await prisma.refundCase.findUnique({
      where: { idempotencyKey },
      select: CASE_SELECT,
    });
    if (existing) return { ...existing, deduplicated: true };
  }

  const booking = await getBookingOrThrow(bookingId, { id: true, userId: true, status: true });
  assertBookingAccess(booking, user, permissions, "refunds:write");

  let status = "DRAFT";
  let calcKind = kind || "REFUND";
  if (calculationId) {
    const calculation = await prisma.refundCalculation.findUnique({
      where: { id: calculationId },
      select: { id: true, bookingId: true, dataStatus: true, kind: true },
    });
    if (!calculation) throw new AppError(404, "Refund calculation not found");
    if (calculation.bookingId !== booking.id) {
      throw new AppError(400, "Refund calculation does not belong to this booking");
    }
    calcKind = kind || calculation.kind || "REFUND";
    if (calculation.dataStatus === "DATA_UNAVAILABLE" || calculation.dataStatus === "REQUIRES_HUMAN") {
      status = "REQUIRES_HUMAN";
    } else status = "QUOTED";
  }

  const created = await prisma.refundCase.create({
    data: {
      bookingId: booking.id,
      calculationId: calculationId ?? null,
      status,
      kind: calcKind,
      reason: reason ?? null,
      partial: partial ?? calcKind === "PARTIAL_REFUND",
      idempotencyKey: idempotencyKey || null,
      createdByUserId: user.id,
    },
    select: CASE_SELECT,
  });

  await writeServicingAudit({
    bookingId: booking.id,
    refundCaseId: created.id,
    actorUserId: user.id,
    action: "refund.case.created",
    payload: { status: created.status, kind: created.kind },
  });

  await notifyServicingUsers({
    userIds: [booking.userId],
    dedupeKeyPrefix: `refund:case:created:${created.id}`,
    title: "Refund / servicing case opened",
    body: `A ${created.kind} case was opened (status ${created.status}). Amounts are confirmed only when calculation dataStatus is OK.`,
    payload: { refundCaseId: created.id, bookingId: booking.id, status: created.status },
  });

  return { ...created, deduplicated: false };
}

export async function submitRefundCase(user, permissions, caseId) {
  const refundCase = await getCaseOrThrow(caseId);
  const booking = await getBookingOrThrow(refundCase.bookingId, { id: true, userId: true });
  assertBookingAccess(booking, user, permissions, "refunds:write");

  if (refundCase.status === "SUBMITTED" || refundCase.status === "PROCESSING") {
    return refundCase;
  }

  const allowed = CASE_ALLOWED_TRANSITIONS[refundCase.status] || [];
  if (!allowed.includes("SUBMITTED")) {
    throw new AppError(400, `Cannot submit refund case in status ${refundCase.status}`);
  }
  if (!refundCase.calculationId) {
    throw new AppError(400, "Attach a refund calculation before submitting");
  }

  const updated = await prisma.refundCase.update({
    where: { id: caseId },
    data: { status: "SUBMITTED" },
    select: CASE_SELECT,
  });

  await writeServicingAudit({
    bookingId: booking.id,
    refundCaseId: caseId,
    actorUserId: user.id,
    action: "refund.case.submitted",
    payload: {},
  });

  await notifyServicingUsers({
    userIds: [booking.userId],
    dedupeKeyPrefix: `refund:case:submitted:${caseId}`,
    title: "Refund request submitted",
    body: "Your refund request was submitted. Completion is not confirmed until payment/supplier operations succeed.",
    payload: { refundCaseId: caseId, bookingId: booking.id },
  });

  await enqueueOpsEventSafe({
    type: "REFUND_REQUESTED",
    aggregateType: "RefundCase",
    aggregateId: caseId,
    idempotencyKey: `ops:refund:requested:${caseId}`,
    payload: {
      refundCaseId: caseId,
      bookingId: booking.id,
      userId: booking.userId,
    },
  });

  return updated;
}

async function issueTravelCreditIfNeeded(refundCase, calculation, booking) {
  if (!calculation?.travelCreditMinor || calculation.travelCreditMinor <= 0) return null;
  const idempotencyKey = `travel-credit:${refundCase.id}`;
  const existing = await prisma.travelCredit.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  return prisma.travelCredit.create({
    data: {
      userId: booking.userId,
      sourceBookingId: booking.id,
      refundCaseId: refundCase.id,
      currency: calculation.currency,
      amountMinor: calculation.travelCreditMinor,
      remainingMinor: calculation.travelCreditMinor,
      status: "ISSUED",
      expiresAt: null,
      idempotencyKey,
      formula: { source: "refund_calculation", calculationId: calculation.id },
    },
  });
}

export async function escalateRefundCase(user, permissions, caseId, { note, trigger, conversationId } = {}) {
  const refundCase = await getCaseOrThrow(caseId);
  const booking = await getBookingOrThrow(refundCase.bookingId);
  assertBookingAccess(booking, user, permissions, "refunds:write");

  if (!conversationId) {
    const updated = await prisma.refundCase.update({
      where: { id: caseId },
      data: {
        status: refundCase.status === "COMPLETED" ? refundCase.status : "REQUIRES_HUMAN",
        failureReason: note || "Escalation requested — conversationId required for Module 13 ticket",
      },
      select: CASE_SELECT,
    });
    return {
      escalated: false,
      auditOnly: true,
      message: "Provide conversationId to open a Module 13 human handoff ticket",
      refundCase: updated,
    };
  }

  const { createEscalationFromTrigger } = await import("../escalations/escalations.service.js");
  const ticket = await createEscalationFromTrigger({
    conversationId,
    userId: booking.userId,
    trigger: trigger || "REFUND_DISPUTE",
    bookingId: booking.id,
    extraContext: {
      refundCaseId: caseId,
      reasonDetail: note || refundCase.reason,
      source: "module14_refunds",
    },
  });

  const updated = await prisma.refundCase.update({
    where: { id: caseId },
    data: {
      status: "REQUIRES_HUMAN",
      escalationId: ticket.id,
      failureReason: note || refundCase.failureReason,
    },
    select: CASE_SELECT,
  });

  return { escalated: true, ticket, refundCase: updated };
}

export async function processRefundCase(user, req, caseId) {
  const permissions = req.permissions;
  if (!hasPermissionEff(permissions, "refunds:write")) {
    throw new AppError(403, "refunds:write permission required to process refunds");
  }

  const refundCase = await getCaseOrThrow(caseId);
  if (refundCase.status === "COMPLETED") return refundCase;

  if (!["SUBMITTED", "PROCESSING", "REQUIRES_HUMAN"].includes(refundCase.status)) {
    throw new AppError(400, `Cannot process refund case in status ${refundCase.status}`);
  }

  const booking = await getBookingOrThrow(refundCase.bookingId);
  const calculation = refundCase.calculationId
    ? await prisma.refundCalculation.findUnique({ where: { id: refundCase.calculationId } })
    : null;

  if (calculation && calculation.dataStatus !== "OK" && calculation.refundableMinor > 0) {
    const updated = await prisma.refundCase.update({
      where: { id: caseId },
      data: {
        status: "REQUIRES_HUMAN",
        failureReason: `Calculation dataStatus=${calculation.dataStatus} — cannot auto-complete financial refund`,
      },
      select: CASE_SELECT,
    });
    await escalateRefundCase(user, permissions, caseId, {
      note: updated.failureReason,
      trigger: "REFUND_DISPUTE",
    }).catch(() => null);
    return updated;
  }

  await prisma.refundCase.update({
    where: { id: caseId },
    data: { status: "PROCESSING" },
  });

  let supplierOperationStatus = "UNSUPPORTED";
  let supplierOperationNote = "No supplier cancel attempted for this product/status";
  try {
    if (["QUOTED", "RESERVED"].includes(booking.status)) {
      const { releaseSupplierHold } = await import("../suppliers/supplierBooking.js");
      const release = await releaseSupplierHold(booking);
      if (release?.ok || release?.status === "CANCELLED" || release?.released || release?.status === "ok") {
        supplierOperationStatus = "OK";
        supplierOperationNote = "Supplier hold released";
      } else if (release?.status === "PROVIDER_UNCONFIGURED" || release?.status === "unconfigured") {
        supplierOperationStatus = "PROVIDER_UNCONFIGURED";
        supplierOperationNote = release?.message || release?.reason || "Supplier unconfigured";
      } else if (release?.status === "skipped") {
        supplierOperationStatus = "UNSUPPORTED";
        supplierOperationNote = release?.reason || "No cancel adapter for supplier";
      } else {
        supplierOperationStatus = "DATA_UNAVAILABLE";
        supplierOperationNote = release?.message || release?.reason || "Supplier cancel result inconclusive";
      }
    } else {
      supplierOperationStatus = "REQUIRES_HUMAN";
      supplierOperationNote =
        "Ticketed/active supplier ticket void is not auto-confirmed — manual/ops supplier action may be required";
    }
  } catch (e) {
    supplierOperationStatus = "REQUIRES_HUMAN";
    supplierOperationNote = e?.message || "Supplier cancel failed";
  }

  const pay = await attemptPaymentRefundForBooking(prisma, booking.id, {
    amountMinor: calculation?.refundableMinor,
    idempotencyKey: refundCase.idempotencyKey || caseId,
  });

  const paymentRefundStatus = pay.status;
  const paymentRefundRef = (pay.refs || []).join(",") || null;

  const canCompleteBooking =
    (["QUOTED", "RESERVED"].includes(booking.status) &&
      (paymentRefundStatus === "VOIDED" ||
        paymentRefundStatus === "NONE" ||
        paymentRefundStatus === "PROVIDER_REFUNDED")) ||
    (["TICKETED", "ACTIVE"].includes(booking.status) &&
      paymentRefundStatus === "PROVIDER_REFUNDED");

  if (paymentRefundStatus === "PENDING_MANUAL" || paymentRefundStatus === "UNSUPPORTED") {
    const updated = await prisma.refundCase.update({
      where: { id: caseId },
      data: {
        status: "REQUIRES_HUMAN",
        paymentRefundStatus,
        paymentRefundRef,
        supplierOperationStatus,
        supplierOperationNote,
        failureReason: pay.note || "Payment refund pending manual processing",
      },
      select: CASE_SELECT,
    });
    await notifyServicingUsers({
      userIds: [booking.userId],
      dedupeKeyPrefix: `refund:case:manual:${caseId}`,
      title: "Refund needs manual processing",
      body: "Your refund request is pending manual payment processing. It is not marked completed yet.",
      payload: { refundCaseId: caseId, bookingId: booking.id, status: "REQUIRES_HUMAN" },
    });
    await escalateRefundCase(user, permissions, caseId, {
      note: updated.failureReason,
      trigger: "REFUND_DISPUTE",
    }).catch(() => null);
    return updated;
  }

  if (paymentRefundStatus === "FAILED") {
    return prisma.refundCase.update({
      where: { id: caseId },
      data: {
        status: "FAILED",
        paymentRefundStatus,
        paymentRefundRef,
        supplierOperationStatus,
        supplierOperationNote,
        failureReason: pay.note || "Payment refund failed",
      },
      select: CASE_SELECT,
    });
  }

  if (!canCompleteBooking) {
    return prisma.refundCase.update({
      where: { id: caseId },
      data: {
        status: "REQUIRES_HUMAN",
        paymentRefundStatus,
        paymentRefundRef,
        supplierOperationStatus,
        supplierOperationNote,
        failureReason: "Cannot auto-complete booking refund without confirmed payment refund",
      },
      select: CASE_SELECT,
    });
  }

  const targetBookingStatus = BOOKING_TARGET_STATUS_BY_SOURCE[booking.status];
  const completedAt = new Date();
  const [updatedCase] = await prisma.$transaction([
    prisma.refundCase.update({
      where: { id: caseId },
      data: {
        status: "COMPLETED",
        completedAt,
        paymentRefundStatus,
        paymentRefundRef,
        supplierOperationStatus,
        supplierOperationNote,
        failureReason: null,
      },
      select: CASE_SELECT,
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: targetBookingStatus },
    }),
    prisma.bookingTransition.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: targetBookingStatus,
        actor: "AGENT",
        actorUserId: user.id,
        reason: `Refund case ${caseId} completed`,
      },
    }),
  ]);

  await issueTravelCreditIfNeeded(updatedCase, calculation, booking);

  await writeAudit({
    userId: user.id,
    action: "refund.case.completed",
    resourceType: "RefundCase",
    resourceId: caseId,
    req,
    metadata: {
      bookingId: booking.id,
      calculationId: refundCase.calculationId,
      fromBookingStatus: booking.status,
      toBookingStatus: targetBookingStatus,
      paymentRefundStatus,
    },
  });

  await reverseRewardsSafe(booking.id);

  // Module 06 — full consumed credit restored on REFUNDED (no partial-hold model).
  await corporateService.releaseCreditForBooking(booking.id, {
    actorUserId: user.id,
    reason: "booking_refunded",
  });

  await enqueueOpsEventSafe({
    type: "BOOKING_REFUNDED",
    aggregateType: "Booking",
    aggregateId: booking.id,
    idempotencyKey: `ops:booking:refunded:${booking.id}:${caseId}`,
    payload: {
      bookingId: booking.id,
      refundCaseId: caseId,
      amountMinor: calculation?.refundableMinor ?? booking.amountMinor,
      currency: booking.currency,
    },
  });

  await notifyServicingUsers({
    userIds: [booking.userId],
    dedupeKeyPrefix: `refund:case:completed:${caseId}`,
    title: "Refund completed",
    body: "Your refund case was completed after payment confirmation.",
    payload: { refundCaseId: caseId, bookingId: booking.id, status: "COMPLETED" },
  });

  return updatedCase;
}

export async function completeRefundCase(user, req, caseId) {
  const refundCase = await getCaseOrThrow(caseId);
  if (refundCase.status === "COMPLETED") return refundCase;
  return processRefundCase(user, req, caseId);
}

export async function rejectRefundCase(user, permissions, caseId, { reason } = {}) {
  if (!hasPermissionEff(permissions, "refunds:write")) {
    throw new AppError(403, "refunds:write required");
  }
  const refundCase = await getCaseOrThrow(caseId);
  if (refundCase.status === "COMPLETED" || refundCase.status === "REJECTED") {
    throw new AppError(409, `Cannot reject case in status ${refundCase.status}`);
  }
  const booking = await getBookingOrThrow(refundCase.bookingId, { id: true, userId: true });
  const updated = await prisma.refundCase.update({
    where: { id: caseId },
    data: { status: "REJECTED", failureReason: reason || "Rejected" },
    select: CASE_SELECT,
  });
  await notifyServicingUsers({
    userIds: [booking.userId],
    dedupeKeyPrefix: `refund:case:rejected:${caseId}`,
    title: "Refund request rejected",
    body: reason || "Your refund request was rejected.",
    payload: { refundCaseId: caseId, bookingId: booking.id },
  });
  return updated;
}

export async function listRefundCases(user, permissions, { bookingId, status, page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  let where;
  if (bookingId) {
    const booking = await getBookingOrThrow(bookingId, { id: true, userId: true });
    assertBookingAccess(booking, user, permissions, "refunds:read");
    where = { bookingId };
  } else if (hasPermissionEff(permissions, "refunds:read")) {
    where = {};
  } else {
    where = { createdByUserId: user.id };
  }
  if (status) where = { ...where, status };

  const [items, total] = await Promise.all([
    prisma.refundCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: CASE_SELECT,
    }),
    prisma.refundCase.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getRefundCaseById(user, permissions, caseId) {
  const refundCase = await getCaseOrThrow(caseId);
  const booking = await getBookingOrThrow(refundCase.bookingId, { id: true, userId: true });
  assertBookingAccess(booking, user, permissions, "refunds:read");

  const calculation = refundCase.calculationId
    ? await prisma.refundCalculation.findUnique({
        where: { id: refundCase.calculationId },
        select: CALCULATION_SELECT,
      })
    : null;

  const audit = await prisma.servicingAuditEvent.findMany({
    where: { refundCaseId: caseId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return { ...refundCase, calculation, audit, bookingId: booking.id };
}
