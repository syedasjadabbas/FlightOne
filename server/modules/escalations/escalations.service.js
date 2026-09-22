/**
 * Module 13 — Human Agent Escalation.
 *
 * Zero-context-loss handoff: createEscalationFromTrigger always loads the full
 * Conversation message history (ASC, never truncated) into contextSnapshot.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import {
  ACTIVE_ESCALATION_STATUSES,
  DEFAULT_PRIORITY_BY_TRIGGER,
  ESCALATION_TRIGGERS,
  normalizeEscalationTrigger,
} from "./escalations.constants.js";
import {
  notifyEscalationCreated,
  notifyEscalationStatusChange,
} from "./escalations.notify.js";
import {
  detectEscalationIntentFromMessage,
  evaluateComplexItineraryEscalation,
  evaluateSupplierFailureEscalation,
  evaluateVipBookingEscalation,
} from "./escalations.detect.js";
import {
  assertConsultantEligibleForTicket,
  buildEscalationRouting,
  toPublicRouting,
} from "./escalations.routing.js";
import {
  applyConsultantAction,
  handoffModePublicInfo,
  listConsultantActions,
  HANDOFF_MODE,
  RESOLUTION_OUTCOMES,
} from "./escalations.writeback.js";

const MAX_PAGE_SIZE = 100;

const MESSAGE_SNAPSHOT_SELECT = {
  id: true,
  role: true,
  content: true,
  offers: true,
  provider: true,
  createdAt: true,
};

const ESCALATION_LIST_SELECT = {
  id: true,
  conversationId: true,
  userId: true,
  status: true,
  trigger: true,
  priority: true,
  assignedToUserId: true,
  bookingId: true,
  routingPool: true,
  routingStatus: true,
  handoffMode: true,
  lastWriteBackStatus: true,
  lastWriteBackAt: true,
  lastWriteBackAction: true,
  resolutionOutcome: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
};

const ESCALATION_DETAIL_SELECT = {
  ...ESCALATION_LIST_SELECT,
  contextSnapshot: true,
  resolutionNote: true,
};

const CUSTOMER_SAFE_DETAIL_SELECT = {
  ...ESCALATION_LIST_SELECT,
  resolutionNote: true,
  // Customers see handoff confirmation + routing state, not the ops snapshot bag.
};

function withPublicRouting(ticket) {
  if (!ticket) return ticket;
  const snapRouting = ticket.contextSnapshot?.routing;
  const routing =
    toPublicRouting(snapRouting) ||
    (ticket.routingPool || ticket.routingStatus
      ? toPublicRouting({
          pool: ticket.routingPool,
          status: ticket.routingStatus,
          eligibleConsultantCount: snapRouting?.eligibleConsultantCount ?? null,
          reason: snapRouting?.reason ?? null,
          routedAt: snapRouting?.routedAt ?? null,
          requiredPermissions: snapRouting?.requiredPermissions ?? [],
        })
      : null);
  const { contextSnapshot, ...rest } = ticket;
  const out = {
    ...rest,
    routing,
    handoff: handoffModePublicInfo(ticket),
  };
  if (contextSnapshot !== undefined) {
    const safeSnap = { ...contextSnapshot };
    if (safeSnap.routing) {
      safeSnap.routing = toPublicRouting(safeSnap.routing);
    }
    out.contextSnapshot = safeSnap;
  }
  return out;
}

async function getEscalationOrThrow(id, select = ESCALATION_DETAIL_SELECT) {
  const ticket = await prisma.escalationTicket.findUnique({ where: { id }, select });
  if (!ticket) {
    throw new AppError(404, "Escalation not found");
  }
  return ticket;
}

async function buildContextSnapshot(conversationId, extraContext) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: MESSAGE_SNAPSHOT_SELECT,
  });

  return {
    messages,
    messageCount: messages.length,
    capturedAt: new Date().toISOString(),
    ...(extraContext && typeof extraContext === "object" ? extraContext : {}),
  };
}

async function assertConversationOwned(conversationId, userId) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, userId: true, status: true },
  });
  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }
  return conversation;
}

/**
 * Create an EscalationTicket for any trigger. Idempotent for active tickets
 * on the same conversation (returns existing — no duplicate queue spam).
 */
export async function createEscalationFromTrigger({
  conversationId,
  userId,
  trigger,
  bookingId,
  extraContext,
  skipOwnershipCheck = false,
} = {}) {
  if (!conversationId) throw new AppError(400, "conversationId is required");
  if (!userId) throw new AppError(400, "userId is required");

  const normalized = normalizeEscalationTrigger(trigger);
  if (!ESCALATION_TRIGGERS.includes(normalized) && !ESCALATION_TRIGGERS.includes(trigger)) {
    throw new AppError(400, "Invalid escalation trigger");
  }
  // Prefer PRD names when writing new rows.
  const writeTrigger = ESCALATION_TRIGGERS.includes(normalized) ? normalized : trigger;

  if (!skipOwnershipCheck) {
    await assertConversationOwned(conversationId, userId);
  } else {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });
    if (!conversation) throw new AppError(404, "Conversation not found");
    if (conversation.userId !== userId) {
      throw new AppError(403, "Conversation ownership mismatch");
    }
  }

  const existing = await prisma.escalationTicket.findFirst({
    where: {
      conversationId,
      status: { in: ACTIVE_ESCALATION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: ESCALATION_DETAIL_SELECT,
  });
  if (existing) {
    return { ...withPublicRouting(existing), deduplicated: true };
  }

  let resolvedBookingId = bookingId ?? null;
  if (resolvedBookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: resolvedBookingId, userId },
      select: { id: true },
    });
    if (!booking) {
      throw new AppError(404, "Booking not found for this user");
    }
  }

  const priority = DEFAULT_PRIORITY_BY_TRIGGER[writeTrigger] ?? 0;
  const preferredLanguage =
    (typeof extraContext?.preferredLanguage === "string" &&
      extraContext.preferredLanguage.trim()) ||
    (typeof extraContext?.customerLanguage === "string" &&
      extraContext.customerLanguage.trim()) ||
    null;

  const routingBuilt = await buildEscalationRouting({
    trigger: writeTrigger,
    priority,
    preferredLanguage,
  });
  const publicRouting = toPublicRouting(routingBuilt);

  const contextSnapshot = await buildContextSnapshot(conversationId, {
    ...extraContext,
    trigger: writeTrigger,
    reasonDetail: extraContext?.reasonDetail || extraContext?.customerNote || null,
    routing: publicRouting,
  });

  const [ticket] = await prisma.$transaction([
    prisma.escalationTicket.create({
      data: {
        conversationId,
        userId,
        trigger: writeTrigger,
        bookingId: resolvedBookingId,
        priority,
        routingPool: publicRouting?.pool ?? null,
        routingStatus: publicRouting?.status ?? null,
        handoffMode: HANDOFF_MODE.IMPLEMENTED,
        contextSnapshot,
      },
      select: ESCALATION_DETAIL_SELECT,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "ESCALATED" },
    }),
  ]);

  await notifyEscalationCreated(ticket).catch(() => ({ enqueued: 0 }));

  try {
    const { enqueueOpsEvent } = await import("../operations/operations.service.js");
    await enqueueOpsEvent({
      type: "ESCALATION_CREATED",
      aggregateType: "EscalationTicket",
      aggregateId: ticket.id,
      idempotencyKey: `ops:escalation:created:${ticket.id}`,
      payload: {
        escalationId: ticket.id,
        userId: ticket.userId,
        bookingId: ticket.bookingId,
        trigger: ticket.trigger,
        conversationId: ticket.conversationId,
        routingPool: ticket.routingPool,
        routingStatus: ticket.routingStatus,
      },
    });
  } catch {
    /* ops enqueue must not block escalations */
  }

  return { ...withPublicRouting(ticket), deduplicated: false };
}

/** Customer-facing create with optional intent auto-detect from note. */
export async function requestEscalationForCustomer(userId, body = {}) {
  const conversationId = body.conversationId;
  if (!conversationId) throw new AppError(400, "conversationId is required");

  let trigger = body.trigger
    ? normalizeEscalationTrigger(body.trigger)
    : detectEscalationIntentFromMessage(body.note || body.reasonDetail || "") ||
      "CUSTOMER_REQUEST";

  // Customers may self-request ordinary support categories, but not triggers
  // that grant queue priority or assert supplier fault — VIP_BOOKING,
  // SUPPLIER_FAILURE, AI_DISCOUNT_LIMIT and JOURNEY_DISRUPTION stay ops-only.
  // These mirror the categories the support form actually offers; omitting
  // VISA_UNCERTAIN / COMPLEX_ITINERARY / OTHER 400'd three of its seven options.
  const customerAllowed = new Set([
    "CUSTOMER_REQUEST",
    "MEDICAL_ASSISTANCE",
    "MEDICAL",
    "SPECIAL_SERVICE_REQUEST",
    "SSR",
    "REFUND_DISPUTE",
    "VISA_UNCERTAIN",
    "COMPLEX_ITINERARY",
    "OTHER",
  ]);
  if (!customerAllowed.has(trigger)) {
    throw new AppError(400, "Customers cannot self-assign this escalation trigger");
  }
  trigger = normalizeEscalationTrigger(trigger);

  return createEscalationFromTrigger({
    conversationId,
    userId,
    trigger,
    bookingId: body.bookingId || null,
    extraContext: {
      customerNote: body.note || body.reasonDetail || null,
      reasonDetail: body.reasonDetail || body.note || null,
      source: "customer_request",
    },
  });
}

export async function listMyEscalations(userId, { status, page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const where = { userId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.escalationTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: ESCALATION_LIST_SELECT,
    }),
    prisma.escalationTicket.count({ where }),
  ]);

  return {
    items: items.map((t) => withPublicRouting(t)),
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getMyEscalationById(userId, id) {
  const ticket = await prisma.escalationTicket.findFirst({
    where: { id, userId },
    select: CUSTOMER_SAFE_DETAIL_SELECT,
  });
  if (!ticket) throw new AppError(404, "Escalation not found");
  return withPublicRouting(ticket);
}

export async function listEscalations({ status, pool, page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const where = {
    ...(status ? { status } : {}),
    ...(pool ? { routingPool: String(pool).toUpperCase() } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.escalationTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      skip,
      take,
      select: ESCALATION_LIST_SELECT,
    }),
    prisma.escalationTicket.count({ where }),
  ]);

  return {
    items: items.map((t) => withPublicRouting(t)),
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getEscalationById(id) {
  const ticket = await getEscalationOrThrow(id, ESCALATION_DETAIL_SELECT);
  const actions = await listConsultantActions(id);
  return {
    ...withPublicRouting(ticket),
    writeBackActions: actions,
  };
}

export async function applyEscalationConsultantAction(
  id,
  consultantUser,
  permissions,
  body,
) {
  return applyConsultantAction(id, consultantUser, permissions, body);
}

export async function claimEscalation(id, consultantUserId) {
  const ticket = await getEscalationOrThrow(id, {
    id: true,
    status: true,
    userId: true,
    conversationId: true,
    trigger: true,
    priority: true,
    routingPool: true,
    routingStatus: true,
    contextSnapshot: true,
  });
  if (ticket.status !== "OPEN") {
    throw new AppError(409, `Cannot claim escalation in status ${ticket.status}`);
  }

  const eligibility = await assertConsultantEligibleForTicket(
    consultantUserId,
    ticket.contextSnapshot?.routing || {
      pool: ticket.routingPool,
      status: ticket.routingStatus,
      requiredPermissions:
        ticket.contextSnapshot?.routing?.requiredPermissions ||
        (ticket.routingPool === "VIP"
          ? ["ops:escalations:write", "ops:escalations:vip"]
          : ticket.routingPool === "MEDICAL"
            ? ["ops:escalations:write", "ops:escalations:medical"]
            : ["ops:escalations:write"]),
    },
  );
  if (!eligibility.ok) {
    throw new AppError(
      403,
      eligibility.message || "Not eligible for this escalation routing pool",
    );
  }

  const updated = await prisma.escalationTicket.update({
    where: { id },
    data: { status: "ASSIGNED", assignedToUserId: consultantUserId },
    select: ESCALATION_DETAIL_SELECT,
  });

  await notifyEscalationStatusChange(updated, { event: "ASSIGNED" }).catch(() => ({
    enqueued: 0,
  }));

  return withPublicRouting(updated);
}

export async function assignEscalation(id, actorUserId, { assignedToUserId } = {}) {
  const ticket = await getEscalationOrThrow(id, {
    id: true,
    status: true,
    routingPool: true,
    routingStatus: true,
    contextSnapshot: true,
  });
  if (ticket.status === "RESOLVED" || ticket.status === "CANCELLED") {
    throw new AppError(409, `Cannot assign closed escalation (${ticket.status})`);
  }

  const targetId = assignedToUserId || actorUserId;
  if (!targetId) throw new AppError(400, "assignedToUserId is required");

  const eligibility = await assertConsultantEligibleForTicket(
    targetId,
    ticket.contextSnapshot?.routing || {
      pool: ticket.routingPool,
      status: ticket.routingStatus,
      requiredPermissions:
        ticket.contextSnapshot?.routing?.requiredPermissions ||
        (ticket.routingPool === "VIP"
          ? ["ops:escalations:write", "ops:escalations:vip"]
          : ticket.routingPool === "MEDICAL"
            ? ["ops:escalations:write", "ops:escalations:medical"]
            : ["ops:escalations:write"]),
    },
  );
  if (!eligibility.ok) {
    throw new AppError(
      403,
      eligibility.message || "Assignee is not eligible for this escalation routing pool",
    );
  }

  const updated = await prisma.escalationTicket.update({
    where: { id },
    data: {
      status: ticket.status === "OPEN" ? "ASSIGNED" : ticket.status,
      assignedToUserId: targetId,
    },
    select: ESCALATION_DETAIL_SELECT,
  });

  if (ticket.status === "OPEN") {
    await notifyEscalationStatusChange(updated, { event: "ASSIGNED" }).catch(() => ({
      enqueued: 0,
    }));
  }

  return withPublicRouting(updated);
}

export async function startEscalation(id, consultantUserId) {
  const ticket = await getEscalationOrThrow(id, {
    id: true,
    status: true,
    assignedToUserId: true,
  });
  if (!["OPEN", "ASSIGNED"].includes(ticket.status)) {
    throw new AppError(409, `Cannot start work in status ${ticket.status}`);
  }

  const updated = await prisma.escalationTicket.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      assignedToUserId: ticket.assignedToUserId ?? consultantUserId,
    },
    select: ESCALATION_DETAIL_SELECT,
  });

  await notifyEscalationStatusChange(updated, { event: "IN_PROGRESS" }).catch(() => ({
    enqueued: 0,
  }));

  return withPublicRouting(updated);
}

export async function resolveEscalation(
  id,
  consultantUserId,
  { resolutionNote, outcome } = {},
) {
  const ticket = await getEscalationOrThrow(id, {
    id: true,
    status: true,
    assignedToUserId: true,
  });
  if (ticket.status === "RESOLVED" || ticket.status === "CANCELLED") {
    throw new AppError(409, `Escalation already closed (${ticket.status})`);
  }

  const resolutionOutcome =
    typeof outcome === "string" && RESOLUTION_OUTCOMES.includes(outcome)
      ? outcome
      : "OTHER";

  const updated = await prisma.escalationTicket.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolutionNote,
      resolutionOutcome,
      resolvedAt: new Date(),
      assignedToUserId: ticket.assignedToUserId ?? consultantUserId,
    },
    select: ESCALATION_DETAIL_SELECT,
  });

  await prisma.escalationAction
    .create({
      data: {
        escalationId: id,
        actionType: "LOG_RESOLUTION_OUTCOME",
        status: "SUCCEEDED",
        actorUserId: consultantUserId,
        bookingId: updated.bookingId || null,
        idempotencyKey: `esc-resolve-outcome:${id}`,
        result: { resolutionOutcome, resolutionNote },
      },
    })
    .catch(async (e) => {
      if (String(e?.code) !== "P2002") throw e;
    });

  await writeAudit({
    userId: consultantUserId,
    action: "escalation.resolve",
    resourceType: "EscalationTicket",
    resourceId: id,
    metadata: { resolutionOutcome },
  }).catch(() => {});

  await notifyEscalationStatusChange(updated, { event: "RESOLVED" }).catch(() => ({
    enqueued: 0,
  }));

  return withPublicRouting(updated);
}

export async function cancelEscalation(id, actorUserId, { note } = {}) {
  const ticket = await getEscalationOrThrow(id, {
    id: true,
    status: true,
    assignedToUserId: true,
  });
  if (ticket.status === "RESOLVED" || ticket.status === "CANCELLED") {
    throw new AppError(409, `Escalation already closed (${ticket.status})`);
  }

  const updated = await prisma.escalationTicket.update({
    where: { id },
    data: {
      status: "CANCELLED",
      resolutionNote: note || ticket.resolutionNote || "Cancelled",
      resolvedAt: new Date(),
      assignedToUserId: ticket.assignedToUserId ?? actorUserId,
    },
    select: ESCALATION_DETAIL_SELECT,
  });

  await notifyEscalationStatusChange(updated, { event: "CANCELLED" }).catch(() => ({
    enqueued: 0,
  }));

  return withPublicRouting(updated);
}

/**
 * System helpers for non-customer-request triggers (VIP / complex / supplier).
 * Callers must already have authoritative context — these never invent it.
 */
export async function escalateIfVip(params) {
  const evaluation = await evaluateVipBookingEscalation(params);
  if (!evaluation.shouldEscalate) {
    return { escalated: false, evaluation };
  }
  if (!params.conversationId) {
    return {
      escalated: false,
      evaluation,
      message: "Provide conversationId to open a handoff ticket",
    };
  }
  const ticket = await createEscalationFromTrigger({
    conversationId: params.conversationId,
    userId: params.userId,
    trigger: "VIP_BOOKING",
    bookingId: evaluation.bookingId || params.bookingId,
    extraContext: { vipEvaluation: evaluation, source: "vip_booking" },
  });
  return { escalated: true, evaluation, ticket };
}

export async function escalateIfComplexItinerary(params) {
  const evaluation = await evaluateComplexItineraryEscalation(params);
  if (!evaluation.shouldEscalate) {
    return { escalated: false, evaluation };
  }
  if (!params.conversationId) {
    return {
      escalated: false,
      evaluation,
      message: "Provide conversationId to open a handoff ticket",
    };
  }
  const ticket = await createEscalationFromTrigger({
    conversationId: params.conversationId,
    userId: params.userId,
    trigger: "COMPLEX_ITINERARY",
    bookingId: evaluation.bookingId || params.bookingId,
    extraContext: {
      complexEvaluation: evaluation,
      reasonDetail: evaluation.reason,
      source: "complex_itinerary",
    },
  });
  return { escalated: true, evaluation, ticket };
}

export async function escalateIfSupplierFailure(params) {
  const evaluation = evaluateSupplierFailureEscalation(params);
  if (!evaluation.shouldEscalate) {
    return { escalated: false, evaluation };
  }
  if (!params.conversationId || !params.userId) {
    return {
      escalated: false,
      evaluation,
      message: "conversationId and userId required for handoff",
    };
  }
  const ticket = await createEscalationFromTrigger({
    conversationId: params.conversationId,
    userId: params.userId,
    trigger: "SUPPLIER_FAILURE",
    bookingId: params.bookingId || null,
    extraContext: {
      supplierFailure: evaluation,
      reasonDetail: evaluation.reason,
      source: "supplier_failure",
    },
  });
  return { escalated: true, evaluation, ticket };
}

export {
  detectEscalationIntentFromMessage,
  evaluateComplexItineraryFromBooking,
  evaluateComplexItineraryEscalation,
  evaluateSupplierFailureEscalation,
  evaluateVipBookingEscalation,
} from "./escalations.detect.js";

export {
  CONSULTANT_ACTION_TYPES,
  RESOLUTION_OUTCOMES,
  HANDOFF_MODE,
} from "./escalations.writeback.js";
