/**
 * Module 13 — consultant write-back into Module 03/09/14 state machines.
 * Never invents booking transitions; never bypasses permissions.
 * Warm handoff is NOT implemented (PRD silent → product decision deferred).
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { assertConsultantEligibleForTicket } from "./escalations.routing.js";

export const CONSULTANT_ACTION_TYPES = [
  "CANCEL_BOOKING",
  "REFUND_PROCESS",
  "REFUND_COMPLETE",
  "REFUND_REJECT",
  "JOURNEY_REBOOK_HANDOFF",
];

export const RESOLUTION_OUTCOMES = [
  "RESOLVED_NO_CHANGE",
  "BOOKING_CANCELLED",
  "REFUND_PROCESSED",
  "REFUND_REJECTED",
  "REBOOK_HANDED_OFF",
  "INFORMATION_PROVIDED",
  "OTHER",
];

/** PRD Module 13 does not define warm handoff — cold transfer is the implemented mode. */
export const HANDOFF_MODE = {
  IMPLEMENTED: "COLD",
  WARM_STATUS: "PRODUCT_DECISION_DEFERRED",
  WARM_NOTE:
    "FlightOne Doc.pdf Module 13 requires live-consultant transfer with full conversation history only. Warm vs cold co-presence is not specified — WARM remains deferred; COLD (Conversation ESCALATED, full snapshot handoff) is the implemented behavior.",
};

const ACTION_SELECT = {
  id: true,
  escalationId: true,
  actionType: true,
  status: true,
  actorUserId: true,
  bookingId: true,
  targetType: true,
  targetId: true,
  idempotencyKey: true,
  result: true,
  error: true,
  createdAt: true,
};

function classifyProviderFailure(errOrResult) {
  const msg = String(errOrResult?.message || errOrResult?.error || errOrResult || "");
  const code = String(errOrResult?.code || errOrResult?.status || "");
  if (
    /UNCONFIGURED|PROVIDER_UNCONFIGURED|not configured|EXTERNAL/i.test(msg) ||
    /UNCONFIGURED|PROVIDER_UNCONFIGURED/.test(code)
  ) {
    return "EXTERNAL_DEPENDENCY";
  }
  return "FAILED";
}

async function loadTicketForWriteBack(escalationId) {
  const ticket = await prisma.escalationTicket.findUnique({
    where: { id: escalationId },
    select: {
      id: true,
      userId: true,
      status: true,
      trigger: true,
      assignedToUserId: true,
      bookingId: true,
      routingPool: true,
      routingStatus: true,
      handoffMode: true,
      contextSnapshot: true,
    },
  });
  if (!ticket) throw new AppError(404, "Escalation not found");
  return ticket;
}

async function assertCanAct(ticket, consultantUserId) {
  if (["RESOLVED", "CANCELLED"].includes(ticket.status)) {
    throw new AppError(409, `Escalation already closed (${ticket.status})`);
  }
  if (!["ASSIGNED", "IN_PROGRESS"].includes(ticket.status)) {
    throw new AppError(409, "Claim/start the escalation before applying service actions");
  }
  if (ticket.assignedToUserId && ticket.assignedToUserId !== consultantUserId) {
    throw new AppError(403, "Only the assigned consultant may apply write-back actions");
  }

  const eligibility = await assertConsultantEligibleForTicket(consultantUserId, {
    pool: ticket.routingPool,
    status: ticket.routingStatus,
    requiredPermissions:
      ticket.contextSnapshot?.routing?.requiredPermissions || undefined,
  });
  if (!eligibility.ok) {
    throw new AppError(403, eligibility.reason || "Not eligible for this escalation pool");
  }
}

async function recordActionRow(data) {
  try {
    return await prisma.escalationAction.create({
      data,
      select: ACTION_SELECT,
    });
  } catch (e) {
    if (String(e?.code) === "P2002" && data.idempotencyKey) {
      const existing = await prisma.escalationAction.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: ACTION_SELECT,
      });
      if (existing) return { ...existing, deduplicated: true };
    }
    throw e;
  }
}

async function touchTicketWriteBack(escalationId, { actionType, status }) {
  await prisma.escalationTicket.update({
    where: { id: escalationId },
    data: {
      lastWriteBackAction: actionType,
      lastWriteBackStatus: status,
      lastWriteBackAt: new Date(),
    },
  });
  if (status === "SUCCEEDED" || status === "EXTERNAL_DEPENDENCY") {
    await prisma.escalationTicket.updateMany({
      where: { id: escalationId, status: "ASSIGNED" },
      data: { status: "IN_PROGRESS" },
    });
  }
}

async function persistActionOutcome({
  ticket,
  consultantUserId,
  actionType,
  status,
  bookingId,
  targetType,
  targetId,
  idempotencyKey,
  resultPayload,
  error,
}) {
  const action = await recordActionRow({
    escalationId: ticket.id,
    actionType,
    status,
    actorUserId: consultantUserId,
    bookingId: bookingId || null,
    targetType,
    targetId,
    idempotencyKey,
    result: resultPayload || undefined,
    error: error || null,
  });
  await touchTicketWriteBack(ticket.id, { actionType, status });
  await writeAudit({
    userId: consultantUserId,
    action: "escalation.consultant_action",
    resourceType: "EscalationTicket",
    resourceId: ticket.id,
    metadata: {
      actionType,
      status,
      targetType: targetType || null,
      targetId: targetId || null,
      bookingId: bookingId || null,
      error: error ? String(error).slice(0, 200) : null,
    },
  }).catch(() => {});
  return action;
}

/**
 * Apply an explicit consultant service action via existing module authorities.
 */
export async function applyConsultantAction(
  escalationId,
  consultantUser,
  permissions,
  body = {},
) {
  const actionType = String(body.actionType || "").trim();
  if (!CONSULTANT_ACTION_TYPES.includes(actionType)) {
    throw new AppError(400, "Unsupported consultant action type");
  }

  const ticket = await loadTicketForWriteBack(escalationId);
  await assertCanAct(ticket, consultantUser.id);

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 160)
      : `esc-action:${escalationId}:${actionType}:${ticket.bookingId || "none"}`;

  const existing = await prisma.escalationAction.findUnique({
    where: { idempotencyKey },
    select: ACTION_SELECT,
  });
  if (existing) {
    return { action: { ...existing, deduplicated: true }, ticketId: ticket.id };
  }

  let resultPayload = null;
  let status = "SUCCEEDED";
  let error = null;
  let targetType = null;
  let targetId = null;
  const bookingId = ticket.bookingId;

  try {
    if (actionType === "CANCEL_BOOKING") {
      if (!bookingId) throw new AppError(400, "Escalation has no bookingId for cancellation");
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, userId: true, status: true },
      });
      if (!booking) throw new AppError(404, "Booking not found");
      if (booking.userId !== ticket.userId) {
        throw new AppError(403, "Booking does not belong to this escalation customer");
      }
      const { cancelBooking } = await import("../bookings/bookings.service.js");
      const cancelled = await cancelBooking(
        ticket.userId,
        bookingId,
        {
          reason: body.reason || `Consultant cancel via escalation ${ticket.id}`,
          actorUserId: consultantUser.id,
        },
        "AGENT",
      );
      targetType = "Booking";
      targetId = cancelled.id;
      resultPayload = {
        bookingId: cancelled.id,
        status: cancelled.status,
        supplierCancel: cancelled.metadata?.supplierCancel || null,
      };
      const cancelStatus = cancelled.metadata?.supplierCancel?.status;
      if (cancelStatus === "failed" || cancelStatus === "unconfigured") {
        status = "EXTERNAL_DEPENDENCY";
        error =
          cancelled.metadata.supplierCancel.reason ||
          (cancelStatus === "unconfigured"
            ? "Supplier cancel unconfigured"
            : "Supplier cancel failed");
      }
    } else if (
      actionType === "REFUND_PROCESS" ||
      actionType === "REFUND_COMPLETE" ||
      actionType === "REFUND_REJECT"
    ) {
      if (!hasPermissionEff(permissions, "refunds:write")) {
        throw new AppError(403, "refunds:write permission required for refund write-back");
      }
      let refundCaseId = body.refundCaseId || null;
      if (!refundCaseId && bookingId) {
        const linked = await prisma.refundCase.findFirst({
          where: {
            bookingId,
            OR: [{ escalationId: ticket.id }, { status: "REQUIRES_HUMAN" }],
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, escalationId: true, bookingId: true },
        });
        refundCaseId = linked?.id || null;
      }
      if (!refundCaseId) {
        throw new AppError(
          400,
          "refundCaseId required (or a REQUIRES_HUMAN case on the booking)",
        );
      }
      const refundCase = await prisma.refundCase.findUnique({
        where: { id: refundCaseId },
        select: { id: true, bookingId: true, escalationId: true, status: true },
      });
      if (!refundCase) throw new AppError(404, "Refund case not found");
      if (bookingId && refundCase.bookingId !== bookingId) {
        throw new AppError(403, "Refund case booking does not match escalation booking");
      }
      if (refundCase.escalationId && refundCase.escalationId !== ticket.id) {
        throw new AppError(403, "Refund case is linked to a different escalation");
      }

      const refunds = await import("../refunds/refunds.service.core.js");
      const reqShim = { permissions, user: consultantUser };
      let updated;
      if (actionType === "REFUND_REJECT") {
        updated = await refunds.rejectRefundCase(consultantUser, permissions, refundCaseId, {
          reason: body.reason || "Rejected by consultant",
        });
      } else {
        updated = await refunds.processRefundCase(consultantUser, reqShim, refundCaseId);
      }
      targetType = "RefundCase";
      targetId = updated.id;
      resultPayload = {
        refundCaseId: updated.id,
        status: updated.status,
        paymentRefundStatus: updated.paymentRefundStatus || null,
        supplierOperationStatus: updated.supplierOperationStatus || null,
      };
      if (
        ["PROVIDER_UNCONFIGURED", "DATA_UNAVAILABLE", "REQUIRES_HUMAN"].includes(
          updated.supplierOperationStatus,
        ) ||
        ["PROVIDER_UNCONFIGURED", "FAILED"].includes(updated.paymentRefundStatus)
      ) {
        status = "EXTERNAL_DEPENDENCY";
        error =
          updated.failureReason ||
          updated.supplierOperationNote ||
          updated.paymentRefundStatus ||
          "Provider-dependent refund step incomplete";
      }
    } else if (actionType === "JOURNEY_REBOOK_HANDOFF") {
      if (!body.watchId || !body.supplierOfferSnapshotId) {
        throw new AppError(400, "watchId and supplierOfferSnapshotId are required");
      }
      const watch = await prisma.journeyWatch.findUnique({
        where: { id: body.watchId },
        select: { id: true, userId: true, bookingId: true },
      });
      if (!watch) throw new AppError(404, "Journey watch not found");
      if (watch.userId !== ticket.userId) {
        throw new AppError(403, "Journey watch does not belong to this escalation customer");
      }
      if (bookingId && watch.bookingId && watch.bookingId !== bookingId) {
        throw new AppError(403, "Journey watch booking does not match escalation booking");
      }
      const journey = await import("../journey/journey.service.js");
      const handoff = await journey.prepareRebookingHandoff(
        ticket.userId,
        body.watchId,
        { supplierOfferSnapshotId: body.supplierOfferSnapshotId },
        permissions,
      );
      targetType = "JourneyWatch";
      targetId = body.watchId;
      resultPayload = handoff;
      if (handoff.autoBooked || handoff.charged) {
        throw new AppError(500, "Unexpected auto-book from journey handoff");
      }
    }
  } catch (e) {
    if (e instanceof AppError) {
      const actionStatus = e.statusCode === 403 ? "DENIED" : "FAILED";
      await persistActionOutcome({
        ticket,
        consultantUserId: consultantUser.id,
        actionType,
        status: actionStatus,
        bookingId,
        targetType,
        targetId,
        idempotencyKey,
        resultPayload,
        error: e.message,
      });
      throw e;
    }
    const failStatus = classifyProviderFailure(e);
    const action = await persistActionOutcome({
      ticket,
      consultantUserId: consultantUser.id,
      actionType,
      status: failStatus,
      bookingId,
      targetType,
      targetId,
      idempotencyKey,
      resultPayload,
      error: e?.message || "Write-back failed",
    });
    return { action, ticketId: ticket.id, providerFailure: true };
  }

  const action = await persistActionOutcome({
    ticket,
    consultantUserId: consultantUser.id,
    actionType,
    status,
    bookingId,
    targetType,
    targetId,
    idempotencyKey,
    resultPayload,
    error,
  });

  return { action, ticketId: ticket.id };
}

export async function listConsultantActions(escalationId) {
  return prisma.escalationAction.findMany({
    where: { escalationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: ACTION_SELECT,
  });
}

export function handoffModePublicInfo(ticket) {
  return {
    mode: ticket?.handoffMode || HANDOFF_MODE.IMPLEMENTED,
    warmStatus: HANDOFF_MODE.WARM_STATUS,
    note: HANDOFF_MODE.WARM_NOTE,
  };
}
