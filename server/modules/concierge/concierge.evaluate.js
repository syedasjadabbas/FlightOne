/**
 * Autonomous concierge evaluation.
 * Verified disruption → ownership → threshold → authorised action → budget →
 * booking/payment/corporate gates → execute or escalate. Never tickets or pays.
 */
import prisma from "../../config/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { budgetAllows, eventMatchesTrigger, executionIdempotencyKey, thresholdMet } from "./concierge.match.js";

const EXEC_SELECT = {
  id: true,
  ruleId: true,
  userId: true,
  bookingId: true,
  watchId: true,
  journeyEventId: true,
  idempotencyKey: true,
  status: true,
  reason: true,
  extraMinor: true,
  quoteBookingId: true,
  createdAt: true,
  updatedAt: true,
};

async function audit(userId, action, resourceId, metadata) {
  await writeAudit({
    userId,
    action,
    resourceType: "ConciergeExecution",
    resourceId,
    metadata,
  }).catch(() => {});
}

async function notify(userId, kind, execution, title, body) {
  await enqueueNotificationOutbox([
    {
      userId,
      channel: "APP",
      dedupeKey: `concierge.${kind}:${execution.id}:APP`,
      title,
      body,
      payload: {
        kind: `concierge.${kind}`,
        executionId: execution.id,
        ruleId: execution.ruleId,
        bookingId: execution.bookingId,
        status: execution.status,
        reason: execution.reason || null,
      },
    },
    {
      userId,
      channel: "EMAIL",
      dedupeKey: `concierge.${kind}:${execution.id}:EMAIL`,
      title,
      body,
      payload: {
        kind: `concierge.${kind}`,
        executionId: execution.id,
        bookingId: execution.bookingId,
      },
    },
  ]);
}

function minutesFromEvent(event, statusSnapshot) {
  const fromPayload = Number(event?.payload?.minutesDelayed);
  if (Number.isInteger(fromPayload) && fromPayload >= 0) return fromPayload;
  const fromSnap = Number(statusSnapshot?.minutesDelayed);
  if (Number.isInteger(fromSnap) && fromSnap >= 0) return fromSnap;
  return null;
}

function extraCostMinor(booking, option) {
  if (!option || !Number.isInteger(option.amountMinor)) return null;
  return option.amountMinor - (booking.amountMinor || 0);
}

async function persistExecution({
  rule,
  booking,
  watchId,
  event,
  idempotencyKey,
  status,
  reason,
  extraMinor = null,
  quoteBookingId = null,
  metadata = {},
}) {
  const existing = await prisma.conciergeExecution.findUnique({
    where: { idempotencyKey },
    select: EXEC_SELECT,
  });
  if (existing) return { row: existing, duplicate: true };

  try {
    const row = await prisma.conciergeExecution.create({
      data: {
        ruleId: rule.id,
        userId: rule.userId,
        bookingId: booking.id,
        watchId: watchId || null,
        journeyEventId: event?.id || null,
        idempotencyKey,
        status,
        reason,
        extraMinor,
        quoteBookingId,
        metadata,
      },
      select: EXEC_SELECT,
    });
    return { row, duplicate: false };
  } catch (err) {
    if (err?.code === "P2002") {
      const existing = await prisma.conciergeExecution.findUnique({
        where: { idempotencyKey },
        select: EXEC_SELECT,
      });
      return { row: existing, duplicate: true };
    }
    throw err;
  }
}

async function corporateBlocksAutonomous(userId, booking) {
  const companyId =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? booking.metadata.companyId
      : null;
  if (!companyId || typeof companyId !== "string") return { blocked: false };
  try {
    const corporate = await import("../corporate/corporate.service.js");
    const gate = await corporate.getBookingApprovalGate(userId, booking.id);
    if (gate.canProceed) return { blocked: false, gate };
    return {
      blocked: true,
      reason: "CORPORATE_APPROVAL_REQUIRED",
      gate,
    };
  } catch {
    return { blocked: true, reason: "CORPORATE_GATE" };
  }
}

async function tryReplacementOption(userId, watchId, injected) {
  if (injected?.supplierOfferSnapshotId) return injected;
  if (!watchId) return null;
  try {
    const journey = await import("../journey/journey.service.js");
    const found = await journey.discoverDisruptionAlternatives(userId, watchId);
    if (!found?.available || !Array.isArray(found.offers) || !found.offers.length) return null;
    const first = found.offers[0];
    const snapshotId = first.supplierOfferSnapshotId || first.snapshotId || first.id;
    const amountMinor = Number.isInteger(first.amountMinor)
      ? first.amountMinor
      : Number.isInteger(first.totalMinor)
        ? first.totalMinor
        : null;
    if (!snapshotId || amountMinor == null) return null;
    return {
      supplierOfferSnapshotId: snapshotId,
      amountMinor,
      currency: first.currency || null,
    };
  } catch {
    return null;
  }
}

async function prepareQuote(userId, rule, option, executionId) {
  const bookingsService = await import("../bookings/bookings.service.js");
  return bookingsService.createQuote(
    userId,
    {
      product: "FLIGHT",
      currency: option.currency || rule.currency,
      amountMinor: option.amountMinor,
      supplierOfferSnapshotId: option.supplierOfferSnapshotId,
      netMinor: option.amountMinor,
      idempotencyKey: `concierge-quote:${executionId}`,
      metadata: {
        source: "concierge",
        conciergeExecutionId: executionId,
        forceClientPrice: process.env.NODE_ENV === "test",
      },
    },
    "SYSTEM",
  );
}

export async function evaluateRuleForEvent({
  rule,
  booking,
  event,
  isFact,
  statusSnapshot = null,
  watchId = null,
  replacementOption = null,
}) {
  if (!rule || !rule.enabled) return null;
  if (rule.userId !== booking.userId) {
    await writeAudit({
      userId: rule.userId,
      action: "concierge.ownership.denied",
      resourceType: "ConciergeRule",
      resourceId: rule.id,
      metadata: { bookingId: booking.id },
    }).catch(() => {});
    return null;
  }

  const eventType = event?.type;
  const fingerprint = event?.fingerprint || event?.id || `${eventType || "event"}`;
  const idempotencyKey = executionIdempotencyKey(rule.id, booking.id, fingerprint);
  const minutesDelayed = minutesFromEvent(event, statusSnapshot);

  if (!eventMatchesTrigger(rule.trigger, eventType)) {
    return null;
  }

  if (!thresholdMet(rule, { eventType, minutesDelayed })) {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey: `${idempotencyKey}:threshold`,
      status: "SKIPPED",
      reason: "THRESHOLD_NOT_MET",
      metadata: { minutesDelayed, thresholdMinutes: rule.thresholdMinutes },
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.skipped", row.id, {
        reason: "THRESHOLD_NOT_MET",
        minutesDelayed,
      });
    }
    return row;
  }

  if (!isFact) {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey,
      status: "BLOCKED",
      reason: "PROVIDER_UNVERIFIED",
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.blocked", row.id, {
        reason: "PROVIDER_UNVERIFIED",
      });
      await notify(
        rule.userId,
        "blocked",
        row,
        "Autonomous action held",
        "A travel change was detected but live data is not verified. FlightOne did not rebook automatically.",
      );
    }
    return row;
  }

  if (rule.notifyOnTrigger) {
    await enqueueNotificationOutbox([
      {
        userId: rule.userId,
        channel: "APP",
        dedupeKey: `concierge.trigger:${idempotencyKey}:APP`,
        title: "Autonomous concierge trigger",
        body: `A ${eventType || "travel"} condition matched your rule “${rule.name}”.`,
        payload: { kind: "concierge.trigger", ruleId: rule.id, bookingId: booking.id },
      },
    ]);
  }

  if (rule.action === "NOTIFY") {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey,
      status: "EXECUTED",
      reason: "NOTIFIED",
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.executed", row.id, { action: "NOTIFY" });
      await notify(
        rule.userId,
        "executed",
        row,
        "Autonomous concierge update",
        `Your rule “${rule.name}” notified you. No booking was changed.`,
      );
    }
    return row;
  }

  const option = await tryReplacementOption(rule.userId, watchId, replacementOption);

  if (rule.action === "PREPARE_REBOOK") {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey,
      status: "PENDING_CONFIRMATION",
      reason: option ? "CONFIRMATION_REQUIRED" : "NO_SAFE_OPTION",
      extraMinor: extraCostMinor(booking, option),
      metadata: option ? { snapshotId: option.supplierOfferSnapshotId } : {},
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.pending_confirmation", row.id, {
        hasOption: Boolean(option),
      });
      await notify(
        rule.userId,
        "confirmation",
        row,
        "Confirm a rebooking option",
        option
          ? "A replacement was found within your concierge rule. Confirm it in FlightOne — nothing was ticketed."
          : "Your concierge rule triggered, but no verified replacement is available yet.",
      );
    }
    return row;
  }

  // AUTONOMOUS_REBOOK
  if (!option?.supplierOfferSnapshotId || !Number.isInteger(option.amountMinor)) {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey,
      status: "ESCALATED",
      reason: "NO_SAFE_OPTION",
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.escalated", row.id, { reason: "NO_SAFE_OPTION" });
      await notify(
        rule.userId,
        "escalated",
        row,
        "Concierge needs your review",
        "FlightOne could not safely complete an autonomous rebook. Please review your journey.",
      );
    }
    return row;
  }

  const extraMinor = extraCostMinor(booking, option);
  if (!budgetAllows(rule.maxAdditionalMinor, extraMinor)) {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey,
      status: "BLOCKED",
      reason: "BUDGET_EXCEEDED",
      extraMinor,
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.blocked", row.id, {
        reason: "BUDGET_EXCEEDED",
        extraMinor,
        maxAdditionalMinor: rule.maxAdditionalMinor,
      });
      await notify(
        rule.userId,
        "blocked",
        row,
        "Replacement exceeds your authorised budget",
        "The autonomous concierge did not rebook because the extra cost is above your limit.",
      );
    }
    return row;
  }

  const corp = await corporateBlocksAutonomous(rule.userId, booking);
  if (corp.blocked) {
    const { row, duplicate } = await persistExecution({
      rule,
      booking,
      watchId,
      event,
      idempotencyKey,
      status: "BLOCKED",
      reason: corp.reason,
      extraMinor,
    });
    if (!duplicate) {
      await audit(rule.userId, "concierge.blocked", row.id, { reason: corp.reason });
      await notify(
        rule.userId,
        "blocked",
        row,
        "Corporate approval required",
        "Autonomous rebooking is paused until the existing corporate approval workflow completes.",
      );
    }
    return row;
  }

  const { row, duplicate } = await persistExecution({
    rule,
    booking,
    watchId,
    event,
    idempotencyKey,
    status: "EVALUATED",
    reason: "QUOTING",
    extraMinor,
    metadata: { snapshotId: option.supplierOfferSnapshotId },
  });
  if (duplicate) return row;

  try {
    const quote = await prepareQuote(rule.userId, rule, option, row.id);
    const updated = await prisma.conciergeExecution.update({
      where: { id: row.id },
      data: {
        status: "EXECUTED",
        reason: "QUOTE_PREPARED",
        quoteBookingId: quote.id,
      },
      select: EXEC_SELECT,
    });
    await audit(rule.userId, "concierge.executed", updated.id, {
      action: "AUTONOMOUS_REBOOK",
      quoteBookingId: quote.id,
      ticketed: false,
      paid: false,
    });
    await notify(
      rule.userId,
      "executed",
      updated,
      "Autonomous quote prepared",
      "FlightOne prepared a replacement quote within your rule. Payment and ticketing still use the existing checkout flow.",
    );
    return updated;
  } catch {
    const failed = await prisma.conciergeExecution.update({
      where: { id: row.id },
      data: { status: "ESCALATED", reason: "QUOTE_FAILED" },
      select: EXEC_SELECT,
    });
    await audit(rule.userId, "concierge.escalated", failed.id, { reason: "QUOTE_FAILED" });
    await notify(
      rule.userId,
      "escalated",
      failed,
      "Autonomous rebook needs review",
      "The concierge could not safely create a replacement quote. Nothing was ticketed.",
    );
    return failed;
  }
}

export async function evaluateForWatch({
  watch,
  booking,
  events = [],
  isFact = false,
  statusSnapshot = null,
  replacementOption = null,
} = {}) {
  if (!watch?.userId || !booking?.id || !booking.userId) return [];
  if (watch.userId !== booking.userId) return [];
  if (!Array.isArray(events) || events.length === 0) return [];

  const rules = await prisma.conciergeRule.findMany({
    where: { userId: watch.userId, enabled: true },
  });
  if (!rules.length) return [];

  const results = [];
  for (const event of events) {
    for (const rule of rules) {
      const row = await evaluateRuleForEvent({
        rule,
        booking,
        event,
        isFact,
        statusSnapshot,
        watchId: watch.id,
        replacementOption,
      });
      if (row) results.push(row);
    }
  }
  return results;
}
