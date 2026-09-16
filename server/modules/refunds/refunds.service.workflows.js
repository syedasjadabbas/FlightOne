/**
 * Module 14 — exchange / reissue / cancellation / schedule-change workflows.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { computeExchangeAmounts } from "./refunds.calc.js";
import { notifyServicingUsers } from "./refunds.notify.js";
import {
  assertBookingAccess,
  calculateRefund,
  createRefundCase,
  escalateRefundCase,
  getBookingOrThrow,
  getRefundEligibility,
  resolveConfiguredAgencyFeeBps,
  SERVICING_SELECT,
  writeServicingAudit,
  BOOKING_REFUND_SELECT,
} from "./refunds.service.core.js";
import { computeRefundAmounts } from "./refunds.calc.js";

export async function getCancellationEligibility(user, permissions, bookingId) {
  const eligibility = await getRefundEligibility(user, permissions, bookingId);
  return {
    ...eligibility,
    workflow: "CANCELLATION",
    note: "Cancellation uses the same authoritative fare/cancellation rules as refund calculation",
  };
}

export async function requestCancellation(user, permissions, body = {}) {
  const { bookingId, idempotencyKey, reason, conversationId } = body;
  const calc = await calculateRefund(user, permissions, {
    bookingId,
    kind: "CANCELLATION",
  });
  const refundCase = await createRefundCase(user, permissions, {
    bookingId,
    calculationId: calc.id,
    reason: reason || "Customer cancellation request",
    kind: "CANCELLATION",
    idempotencyKey: idempotencyKey || `cancel:${bookingId}:${user.id}`,
  });

  const servicing = await prisma.servicingRequest.create({
    data: {
      bookingId,
      userId: user.id,
      kind: "CANCELLATION",
      status:
        calc.dataStatus === "OK"
          ? "CALCULATED"
          : calc.dataStatus === "REQUIRES_HUMAN"
            ? "REQUIRES_HUMAN"
            : "NOT_ELIGIBLE",
      calculationId: calc.id,
      refundCaseId: refundCase.id,
      idempotencyKey: idempotencyKey ? `svc-cancel:${idempotencyKey}` : undefined,
      currency: calc.currency,
      customerRefundMinor: calc.refundableMinor,
      agencyFeeMinor: calc.agencyFeeMinor,
      changePenaltyMinor: calc.supplierPenaltyMinor,
      dataStatus: calc.dataStatus,
      formula: calc.formula,
      reason: reason || null,
    },
    select: SERVICING_SELECT,
  });

  if (calc.dataStatus !== "OK" && conversationId) {
    await escalateRefundCase(user, permissions, refundCase.id, {
      conversationId,
      note: "Cancellation rules ambiguous or unavailable",
      trigger: "REFUND_DISPUTE",
    }).catch(() => null);
  }

  return { calculation: calc, refundCase, servicingRequest: servicing };
}

function decorateExchangeHumanResponse(row, extras = {}) {
  return {
    ...row,
    executed: false,
    humanServicingRequired: true,
    liveMutation: false,
    ticketMutated: false,
    bookingMutated: false,
    providerMutationStatus: "UNSUPPORTED",
    message:
      "Exchange/reissue calculated and queued for human servicing — no live GDS ticket mutation was performed",
    ...extras,
  };
}

function exchangeIdempotencyKey(idempotencyKey, servicingId) {
  return idempotencyKey || `exchange:${servicingId}`;
}

export async function calculateExchange(user, permissions, body = {}) {
  const { bookingId, newFareMinor, kind = "EXCHANGE" } = body;
  const booking = await getBookingOrThrow(bookingId);
  assertBookingAccess(booking, user, permissions, "refunds:write");

  const pricingAgencyFeeBps = await resolveConfiguredAgencyFeeBps();
  const amounts = computeExchangeAmounts({
    grossPaidMinor: booking.amountMinor,
    fareRules: booking.fareRules,
    newFareMinor,
    pricingAgencyFeeBps,
  });

  const formula = {
    ...amounts.formula,
    processingTimelineStatus: amounts.processingTimelineStatus,
    processingTimelineNote: amounts.processingTimelineNote,
  };

  const servicing = await prisma.servicingRequest.create({
    data: {
      bookingId: booking.id,
      userId: user.id,
      kind: kind === "REISSUE" ? "REISSUE" : "EXCHANGE",
      status:
        amounts.dataStatus === "OK"
          ? "CALCULATED"
          : amounts.dataStatus === "NOT_ELIGIBLE"
            ? "NOT_ELIGIBLE"
            : "REQUIRES_HUMAN",
      currency: booking.currency,
      fareDifferenceMinor: amounts.fareDifferenceMinor,
      changePenaltyMinor: amounts.changePenaltyMinor,
      agencyFeeMinor: amounts.agencyFeeMinor,
      customerDueMinor: amounts.customerDueMinor,
      customerRefundMinor: amounts.customerRefundMinor,
      dataStatus: amounts.dataStatus === "NOT_ELIGIBLE" ? "UNSUPPORTED" : amounts.dataStatus,
      formula,
    },
    select: SERVICING_SELECT,
  });

  await writeServicingAudit({
    bookingId: booking.id,
    servicingRequestId: servicing.id,
    actorUserId: user.id,
    action: "servicing.exchange.calculated",
    payload: {
      dataStatus: servicing.dataStatus,
      kind: servicing.kind,
      fareDifferenceMinor: servicing.fareDifferenceMinor,
      changePenaltyMinor: servicing.changePenaltyMinor,
      agencyFeeMinor: servicing.agencyFeeMinor,
      customerDueMinor: servicing.customerDueMinor,
      customerRefundMinor: servicing.customerRefundMinor,
      liveMutation: false,
    },
  });

  return {
    ...servicing,
    processingTimelineStatus: amounts.processingTimelineStatus,
    processingTimelineNote: amounts.processingTimelineNote,
    liveMutation: false,
    humanServicingPath: true,
  };
}

export async function requestExchange(user, permissions, body = {}) {
  const { bookingId, servicingRequestId, idempotencyKey, reason } = body;
  const booking = await getBookingOrThrow(bookingId);
  assertBookingAccess(booking, user, permissions, "refunds:write");

  const bookingStatusBefore = booking.status;

  if (idempotencyKey) {
    const existing = await prisma.servicingRequest.findUnique({
      where: { idempotencyKey },
      select: SERVICING_SELECT,
    });
    if (existing) {
      return decorateExchangeHumanResponse(existing, {
        deduplicated: true,
        bookingStatus: bookingStatusBefore,
      });
    }
  }

  const servicing = servicingRequestId
    ? await prisma.servicingRequest.findUnique({
        where: { id: servicingRequestId },
        select: SERVICING_SELECT,
      })
    : null;
  if (!servicing) throw new AppError(404, "Servicing request (calculation) not found");
  if (servicing.bookingId !== booking.id) throw new AppError(400, "Servicing request booking mismatch");

  // Already queued for human — idempotent, never re-mutate booking/ticket.
  // If calculation landed in REQUIRES_HUMAN without a request stamp, finalize honesty fields once.
  if (servicing.status === "REQUIRES_HUMAN") {
    const needsRequestStamp =
      !servicing.supplierResponse ||
      (typeof servicing.supplierResponse === "object" &&
        servicing.supplierResponse.liveMutationAttempted !== false);
    if (needsRequestStamp) {
      const stamped = await prisma.servicingRequest.update({
        where: { id: servicing.id },
        data: {
          reason: reason || servicing.reason || "Customer exchange/reissue request",
          idempotencyKey: servicing.idempotencyKey || exchangeIdempotencyKey(idempotencyKey, servicing.id),
          supplierResponse: {
            status: "UNSUPPORTED",
            configured: false,
            liveMutationAttempted: false,
            message:
              "PRD Module 14 requires calculation and support for exchanges/reissues; live GDS ticket reissue is not available — request queued for human/ops servicing",
          },
          failureReason:
            servicing.failureReason ||
            "Live supplier exchange/reissue mutation is not configured — human servicing required; booking/ticket unchanged",
        },
        select: SERVICING_SELECT,
      });
      await writeServicingAudit({
        bookingId: booking.id,
        servicingRequestId: stamped.id,
        actorUserId: user.id,
        action: "servicing.exchange.requested",
        payload: {
          kind: stamped.kind,
          status: stamped.status,
          executed: false,
          liveMutation: false,
          ticketMutated: false,
          bookingStatus: bookingStatusBefore,
          deduplicatedFinalize: true,
        },
      });
      return decorateExchangeHumanResponse(stamped, {
        deduplicated: true,
        bookingStatus: bookingStatusBefore,
        bookingStatusUnchanged: true,
      });
    }
    return decorateExchangeHumanResponse(servicing, {
      deduplicated: true,
      bookingStatus: bookingStatusBefore,
      bookingStatusUnchanged: true,
    });
  }

  const resolvedKey = exchangeIdempotencyKey(idempotencyKey, servicing.id);

  const updated = await prisma.servicingRequest.update({
    where: { id: servicing.id },
    data: {
      status: "REQUIRES_HUMAN",
      reason: reason || servicing.reason || "Customer exchange/reissue request",
      idempotencyKey: resolvedKey,
      supplierResponse: {
        status: "UNSUPPORTED",
        configured: false,
        liveMutationAttempted: false,
        message:
          "PRD Module 14 requires calculation and support for exchanges/reissues; live GDS ticket reissue is not available — request queued for human/ops servicing",
      },
      failureReason:
        "Live supplier exchange/reissue mutation is not configured — human servicing required; booking/ticket unchanged",
    },
    select: SERVICING_SELECT,
  });

  await writeServicingAudit({
    bookingId: booking.id,
    servicingRequestId: updated.id,
    actorUserId: user.id,
    action: "servicing.exchange.requested",
    payload: {
      kind: updated.kind,
      status: updated.status,
      executed: false,
      liveMutation: false,
      ticketMutated: false,
      bookingStatus: bookingStatusBefore,
      fareDifferenceMinor: updated.fareDifferenceMinor,
      changePenaltyMinor: updated.changePenaltyMinor,
      agencyFeeMinor: updated.agencyFeeMinor,
      customerDueMinor: updated.customerDueMinor,
      customerRefundMinor: updated.customerRefundMinor,
    },
  });

  await notifyServicingUsers({
    userIds: [booking.userId],
    dedupeKeyPrefix: `refund:exchange:${updated.id}`,
    title: `${updated.kind === "REISSUE" ? "Reissue" : "Exchange"} requires human servicing`,
    body: "Your request was accepted with calculated amounts. An agent must complete the ticket change — the system did not mutate the booking or ticket.",
    payload: {
      servicingRequestId: updated.id,
      bookingId: booking.id,
      status: "REQUIRES_HUMAN",
      liveMutation: false,
    },
  });

  // Fail-closed integrity: never touch booking/ticket on this path.
  const bookingAfter = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { status: true, externalRef: true, metadata: true },
  });

  return decorateExchangeHumanResponse(updated, {
    bookingStatus: bookingAfter?.status ?? bookingStatusBefore,
    bookingStatusUnchanged: bookingAfter?.status === bookingStatusBefore,
  });
}

export async function createScheduleChangeServicing(user, permissions, body = {}) {
  const { bookingId, journeyEventId, conversationId } = body;
  const booking = await getBookingOrThrow(bookingId);
  assertBookingAccess(booking, user, permissions, "refunds:write");

  if (journeyEventId) {
    const event = await prisma.journeyEvent
      .findUnique({
        where: { id: journeyEventId },
        select: { id: true, type: true },
      })
      .catch(() => null);
    if (!event) throw new AppError(404, "Journey event not found");
    const type = String(event.type || "").toUpperCase();
    if (!["CANCELLED", "DELAY", "OTHER", "DIVERTED"].includes(type) && !type.includes("SCHEDULE")) {
      throw new AppError(
        400,
        `Journey event type ${event.type} is not a schedule-change servicing trigger`,
      );
    }
  }

  const calc = await calculateRefund(user, permissions, {
    bookingId,
    scheduleChangeAttributed: true,
    kind: "SCHEDULE_CHANGE",
  });

  const refundCase = await createRefundCase(user, permissions, {
    bookingId,
    calculationId: calc.id,
    reason: "Airline/supplier schedule change servicing",
    kind: "SCHEDULE_CHANGE",
    idempotencyKey: journeyEventId
      ? `sched:${bookingId}:${journeyEventId}`
      : `sched:${bookingId}:${calc.id}`,
  });

  const servicing = await prisma.servicingRequest.create({
    data: {
      bookingId,
      userId: booking.userId,
      kind: "SCHEDULE_CHANGE",
      status: calc.dataStatus === "OK" ? "CALCULATED" : "REQUIRES_HUMAN",
      calculationId: calc.id,
      refundCaseId: refundCase.id,
      journeyEventId: journeyEventId || null,
      currency: calc.currency,
      customerRefundMinor: calc.refundableMinor,
      agencyFeeMinor: calc.agencyFeeMinor,
      changePenaltyMinor: 0,
      dataStatus: calc.dataStatus,
      formula: { ...calc.formula, scheduleChangeAttributed: true },
    },
    select: SERVICING_SELECT,
  });

  await notifyServicingUsers({
    userIds: [booking.userId],
    dedupeKeyPrefix: `refund:schedule:${servicing.id}`,
    title: "Schedule change — servicing options",
    body: "A schedule-change servicing case was opened from journey data. Amounts are confirmed only when dataStatus is OK.",
    payload: { servicingRequestId: servicing.id, bookingId, refundCaseId: refundCase.id },
  });

  if (conversationId) {
    await escalateRefundCase(user, permissions, refundCase.id, {
      conversationId,
      note: "Schedule-change servicing may need consultant support",
      trigger: "JOURNEY_DISRUPTION",
    }).catch(() => null);
  }

  return { calculation: calc, refundCase, servicingRequest: servicing };
}

export async function listTravelCredits(user, permissions, { userId } = {}) {
  const { hasPermissionEff } = await import("../../lib/permissions.service.js");
  const targetUserId = userId || user.id;
  if (targetUserId !== user.id && !hasPermissionEff(permissions, "refunds:read")) {
    throw new AppError(403, "Forbidden");
  }
  const items = await prisma.travelCredit.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: "desc" },
  });
  return { items };
}

export async function listServicingRequests(
  user,
  permissions,
  { bookingId, status, page, pageSize } = {},
) {
  const { DEFAULT_PAGE_SIZE } = await import("../../lib/utils.js");
  const { hasPermissionEff } = await import("../../lib/permissions.service.js");
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, 100);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const where = {};
  if (bookingId) {
    const booking = await getBookingOrThrow(bookingId, { id: true, userId: true });
    assertBookingAccess(booking, user, permissions, "refunds:read");
    where.bookingId = bookingId;
  } else if (!hasPermissionEff(permissions, "refunds:read")) {
    where.userId = user.id;
  }
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.servicingRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: SERVICING_SELECT,
    }),
    prisma.servicingRequest.count({ where }),
  ]);
  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getServicingRequestById(user, permissions, id) {
  const row = await prisma.servicingRequest.findUnique({
    where: { id },
    select: SERVICING_SELECT,
  });
  if (!row) throw new AppError(404, "Servicing request not found");
  const booking = await getBookingOrThrow(row.bookingId, { id: true, userId: true });
  assertBookingAccess(booking, user, permissions, "refunds:read");
  return row;
}

export async function buildAvaRefundGuidance(userId, bookingId) {
  if (!bookingId) {
    return {
      promptBlock:
        "REFUNDS: No bookingId — never invent refund amounts, penalties, fees, or timelines. Ask which booking.",
    };
  }
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: BOOKING_REFUND_SELECT,
    });
    if (!booking) {
      return {
        promptBlock:
          "REFUNDS: Booking not found for this user — never invent eligibility or amounts.",
      };
    }
    const pricingAgencyFeeBps = await resolveConfiguredAgencyFeeBps();
    const calc = computeRefundAmounts(booking.amountMinor, booking.fareRules, {
      product: booking.product,
      pricingAgencyFeeBps,
    });
    return {
      promptBlock: [
        `REFUNDS for booking ${booking.id} (${booking.product}, status ${booking.status}, currency ${booking.currency}):`,
        `dataStatus=${calc.dataStatus}; grossPaidMinor=${booking.amountMinor};`,
        `supplierPenaltyMinor=${calc.supplierPenaltyMinor}; agencyFeeMinor=${calc.agencyFeeMinor};`,
        `refundableMinor=${calc.refundableMinor}; travelCreditMinor=${calc.travelCreditMinor};`,
        `timeline=${calc.processingTimelineStatus}${calc.processingTimelineNote ? ` (${calc.processingTimelineNote})` : ""};`,
        `rule=${calc.formula?.rule};`,
        calc.dataStatus === "OK"
          ? "You may quote these server amounts as calculated (not payment-completed)."
          : "Do NOT present refundableMinor as a confirmed payout — data unavailable or requires human confirmation.",
        "EXCHANGE/REISSUE: server may calculate fare difference, change penalty, and agency fee; live GDS ticket mutation is not performed — status REQUIRES_HUMAN means human/ops must complete the change.",
        "Never claim refund completed, ticket reissued, or cancellation confirmed unless system status says so.",
      ].join(" "),
      calculation: calc,
      bookingStatus: booking.status,
    };
  } catch {
    return {
      promptBlock:
        "REFUNDS temporarily unavailable — never invent refund values, penalties, or timelines.",
    };
  }
}
