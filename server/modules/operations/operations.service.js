/**
 * Module 15 — Operations Platform service.
 * Event outbox + internal ledger + fail-closed external adapters.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import logger from "../../lib/logger.js";
import { writeAudit } from "../../lib/audit.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { isMinorAmount, isValidCurrencyCode, assertNonNegativeMinorAmount } from "../../lib/money.js";
import { OPS_EVENT_TYPES } from "./operations.validators.js";
import { getCrmCapability, pushCrmEvent } from "./integrations/crm/crm.adapter.js";
import { getMidOfficeCapability, pushMidOfficeEvent } from "./integrations/midoffice/midoffice.adapter.js";
import { getBackOfficeCapability, pushBackOfficeEvent } from "./integrations/backoffice/backoffice.adapter.js";
import { getAccountingCapability, pushAccountingEvent } from "./integrations/accounting/accounting.adapter.js";
import { getFinanceCapability, getFinanceSnapshot } from "./integrations/finance/finance.service.js";
import {
  getCommissionCapability,
  listCommissions,
  recordCommissionForTicketedBooking,
} from "./integrations/commissions/commissions.service.js";
import {
  getReconciliationCapability,
  reconcileBooking,
} from "./integrations/reconciliation/reconciliation.service.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_DRAIN_LIMIT = 50;
const MAX_DRAIN_LIMIT = 500;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_STALE_MS = 15 * 60 * 1000;

const OUTBOX_SELECT = {
  id: true,
  type: true,
  aggregateType: true,
  aggregateId: true,
  payload: true,
  status: true,
  attempts: true,
  lastError: true,
  idempotencyKey: true,
  createdAt: true,
  deliveredAt: true,
  processingStartedAt: true,
};

const INTEGRATION_PUSHERS = [
  { integration: "crm", push: pushCrmEvent },
  { integration: "midoffice", push: pushMidOfficeEvent },
  { integration: "backoffice", push: pushBackOfficeEvent },
  { integration: "accounting", push: pushAccountingEvent },
];

function outboxMaxAttempts(env = process.env) {
  const n = Number(env.OPS_OUTBOX_MAX_ATTEMPTS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ATTEMPTS;
}

function outboxStaleMs(env = process.env) {
  const n = Number(env.OPS_OUTBOX_STALE_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_MS;
}

/** UI-facing status: PENDING with prior attempts → RETRYING. */
export function outboxDisplayStatus(row) {
  if (row?.status === "PENDING" && Number(row.attempts) > 0) return "RETRYING";
  return row?.status;
}

const ACCOUNTING_SELECT = {
  id: true,
  bookingId: true,
  entryType: true,
  currency: true,
  amountMinor: true,
  memo: true,
  idempotencyKey: true,
  sourceEventId: true,
  companyId: true,
  userId: true,
  supplierCode: true,
  paymentId: true,
  createdAt: true,
};

const RECON_SELECT = {
  id: true,
  supplierCode: true,
  externalRef: true,
  bookingId: true,
  expectedMinor: true,
  invoicedMinor: true,
  currency: true,
  status: true,
  notes: true,
  mismatchReason: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
};

const AUDIT_SELECT = {
  id: true,
  userId: true,
  action: true,
  resourceType: true,
  resourceId: true,
  metadata: true,
  ip: true,
  userAgent: true,
  createdAt: true,
};

function paginationArgs({ page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  return { take, skip, currentPage };
}

function paginatedResult(items, total, take, currentPage) {
  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

function companyIdFromMetadata(metadata) {
  const raw = metadata && typeof metadata === "object" ? metadata.companyId : null;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function insertAccountingEntryIdempotent(tx, entry) {
  if (entry.idempotencyKey) {
    const existingEntry = await tx.accountingEntry.findUnique({
      where: { idempotencyKey: entry.idempotencyKey },
      select: { id: true },
    });
    if (existingEntry) return { created: false, id: existingEntry.id };
  }
  const created = await tx.accountingEntry.create({ data: entry, select: { id: true } });
  return { created: true, id: created.id };
}

/**
 * Authoritative booking financials — never trust outbox/payload amounts.
 */
async function loadBookingFinancials(tx, bookingId) {
  if (!bookingId) return null;
  return tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      currency: true,
      amountMinor: true,
      netMinor: true,
      marginMinor: true,
      supplierCode: true,
      metadata: true,
    },
  });
}

function buildTicketedAccountingEntries(booking, eventId) {
  if (
    !booking ||
    !isValidCurrencyCode(booking.currency) ||
    !isMinorAmount(booking.amountMinor) ||
    !isMinorAmount(booking.netMinor)
  ) {
    return [];
  }

  const companyId = companyIdFromMetadata(booking.metadata);
  const marginMinor =
    isMinorAmount(booking.marginMinor) && booking.marginMinor >= 0
      ? booking.marginMinor
      : Math.max(0, booking.amountMinor - booking.netMinor);

  const base = {
    bookingId: booking.id,
    currency: booking.currency,
    companyId,
    userId: booking.userId,
    supplierCode: booking.supplierCode || null,
    sourceEventId: eventId || null,
  };

  const entries = [
    {
      ...base,
      entryType: "REVENUE",
      amountMinor: booking.amountMinor,
      memo: "Ticket revenue (selling amount)",
      idempotencyKey: `acct:revenue:${booking.id}`,
    },
    {
      ...base,
      entryType: "COST",
      amountMinor: booking.netMinor,
      memo: "Supplier net cost",
      idempotencyKey: `acct:cost:${booking.id}`,
    },
  ];

  if (isMinorAmount(marginMinor)) {
    entries.push({
      ...base,
      entryType: "MARGIN",
      amountMinor: marginMinor,
      memo: "Booking margin (selling − supplier net)",
      idempotencyKey: `acct:margin:${booking.id}`,
    });
  }

  return entries;
}

async function buildPaymentAccountingEntry(tx, { paymentId, bookingId, eventId }) {
  let payment = null;
  if (paymentId) {
    payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        bookingId: true,
        userId: true,
        currency: true,
        amountMinor: true,
        status: true,
      },
    });
  } else if (bookingId) {
    payment = await tx.payment.findFirst({
      where: { bookingId, status: { in: ["CAPTURED", "AUTHORIZED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingId: true,
        userId: true,
        currency: true,
        amountMinor: true,
        status: true,
      },
    });
  }
  if (!payment || !["CAPTURED", "AUTHORIZED"].includes(payment.status)) return null;
  if (!isValidCurrencyCode(payment.currency) || !isMinorAmount(payment.amountMinor)) return null;

  const booking = await loadBookingFinancials(tx, payment.bookingId);
  return {
    bookingId: payment.bookingId,
    entryType: "PAYMENT",
    currency: payment.currency,
    amountMinor: payment.amountMinor,
    memo: `Payment ${payment.status.toLowerCase()}`,
    idempotencyKey: `acct:payment:${payment.id}`,
    sourceEventId: eventId || null,
    companyId: companyIdFromMetadata(booking?.metadata),
    userId: payment.userId,
    supplierCode: booking?.supplierCode || null,
    paymentId: payment.id,
  };
}

async function buildRefundAndCreditEntries(tx, { bookingId, refundCaseId, eventId }) {
  const entries = [];
  const booking = await loadBookingFinancials(tx, bookingId);
  if (!booking) return entries;

  const companyId = companyIdFromMetadata(booking.metadata);
  let refundMinor = null;
  let currency = booking.currency;

  if (refundCaseId) {
    const refundCase = await tx.refundCase.findUnique({
      where: { id: refundCaseId },
      select: {
        id: true,
        bookingId: true,
        calculation: {
          select: {
            currency: true,
            refundableMinor: true,
            travelCreditMinor: true,
          },
        },
      },
    });
    if (refundCase?.calculation) {
      currency = refundCase.calculation.currency || currency;
      refundMinor = refundCase.calculation.refundableMinor;
      if (
        isMinorAmount(refundCase.calculation.travelCreditMinor) &&
        refundCase.calculation.travelCreditMinor > 0
      ) {
        entries.push({
          bookingId,
          entryType: "CREDIT",
          currency,
          amountMinor: refundCase.calculation.travelCreditMinor,
          memo: "Travel credit issued",
          idempotencyKey: `acct:credit:${refundCaseId}`,
          sourceEventId: eventId || null,
          companyId,
          userId: booking.userId,
          supplierCode: booking.supplierCode || null,
        });
      }
    } else {
      const credit = await tx.travelCredit.findFirst({
        where: { refundCaseId },
        select: { id: true, currency: true, amountMinor: true },
      });
      if (credit && isMinorAmount(credit.amountMinor) && credit.amountMinor > 0) {
        entries.push({
          bookingId,
          entryType: "CREDIT",
          currency: credit.currency,
          amountMinor: credit.amountMinor,
          memo: "Travel credit issued",
          idempotencyKey: `acct:credit:${refundCaseId}`,
          sourceEventId: eventId || null,
          companyId,
          userId: booking.userId,
          supplierCode: booking.supplierCode || null,
        });
      }
    }
  }

  if (!isMinorAmount(refundMinor)) {
    // Fail closed: without calculation, use booking selling amount only as last resort
    // when a completed refund event fires (existing workflow always sends calculation when available).
    refundMinor = booking.amountMinor;
  }

  if (isValidCurrencyCode(currency) && isMinorAmount(refundMinor)) {
    entries.unshift({
      bookingId,
      entryType: "REFUND",
      currency,
      amountMinor: refundMinor,
      memo: "Booking refund",
      idempotencyKey: refundCaseId
        ? `acct:refund:${bookingId}:${refundCaseId}`
        : `acct:refund:${bookingId}:${eventId || "evt"}`,
      sourceEventId: eventId || null,
      companyId,
      userId: booking.userId,
      supplierCode: booking.supplierCode || null,
    });
  }

  return entries;
}

export async function enqueueOpsEvent({
  type,
  aggregateType,
  aggregateId,
  payload,
  idempotencyKey,
} = {}) {
  if (!type || !OPS_EVENT_TYPES.includes(type)) {
    throw new AppError(400, "Invalid ops event type");
  }
  if (!aggregateType) throw new AppError(400, "aggregateType is required");
  if (!aggregateId) throw new AppError(400, "aggregateId is required");

  if (idempotencyKey) {
    const existing = await prisma.opsOutboxEvent.findUnique({
      where: { idempotencyKey },
      select: OUTBOX_SELECT,
    });
    if (existing) return { ...existing, deduplicated: true };
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.opsOutboxEvent.create({
      data: {
        type,
        aggregateType,
        aggregateId,
        payload: payload ?? {},
        idempotencyKey: idempotencyKey || null,
      },
      select: OUTBOX_SELECT,
    });

    if (type === "BOOKING_TICKETED") {
      const bookingId = payload?.bookingId || aggregateId;
      const booking = await loadBookingFinancials(tx, bookingId);
      if (!booking) {
        logger.warn("ops.accounting.skip — BOOKING_TICKETED booking not found", {
          aggregateId,
          bookingId,
        });
      } else {
        // Ignore forged payload amounts — ledger truth is Booking row only.
        const entries = buildTicketedAccountingEntries(booking, event.id);
        for (const entry of entries) {
          await insertAccountingEntryIdempotent(tx, entry);
        }
        await recordCommissionForTicketedBooking({
          bookingId: booking.id,
          eventId: event.id,
          tx,
        });
      }
    }

    if (type === "PAYMENT_CAPTURED") {
      const paymentEntry = await buildPaymentAccountingEntry(tx, {
        paymentId: payload?.paymentId || (aggregateType === "Payment" ? aggregateId : null),
        bookingId: payload?.bookingId || null,
        eventId: event.id,
      });
      if (paymentEntry) {
        await insertAccountingEntryIdempotent(tx, paymentEntry);
      } else {
        logger.warn("ops.accounting.skip — PAYMENT_CAPTURED payment missing/invalid", {
          aggregateId,
          paymentId: payload?.paymentId,
        });
      }
    }

    if (type === "BOOKING_REFUNDED") {
      const bookingId = payload?.bookingId || aggregateId;
      const refundEntries = await buildRefundAndCreditEntries(tx, {
        bookingId,
        refundCaseId: payload?.refundCaseId || null,
        eventId: event.id,
      });
      for (const entry of refundEntries) {
        await insertAccountingEntryIdempotent(tx, entry);
      }
    }

    return { ...event, deduplicated: false };
  });
}

async function recordExternalSync(tx, { integration, event, result }) {
  const idempotencyKey = `sync:${integration}:${event.id}`;
  const existing = await tx.opsExternalSync.findUnique({ where: { idempotencyKey } });
  if (existing?.status === "DELIVERED") return existing;

  const data = {
    integration,
    eventId: event.id,
    eventType: event.type,
    status: result.status,
    externalRef: result.externalRef || null,
    response: result.response
      ? {
          // Never persist Authorization/API keys — adapters already omit them.
          status: result.status,
          retryable: result.retryable ?? null,
          externalRef: result.externalRef || null,
          // Keep a shallow provider ack only (no nested secrets expected).
          ack: result.response?.id || result.response?.externalRef || null,
          capabilityState: result.response?.capability?.state || null,
        }
      : null,
    error: result.error || null,
  };

  if (existing) {
    return tx.opsExternalSync.update({ where: { idempotencyKey }, data });
  }

  try {
    return await tx.opsExternalSync.create({
      data: { ...data, idempotencyKey },
    });
  } catch (e) {
    if (String(e?.code) === "P2002") {
      return tx.opsExternalSync.findUnique({ where: { idempotencyKey } });
    }
    throw e;
  }
}

async function reclaimStaleProcessingClaims({ env = process.env } = {}) {
  const staleBefore = new Date(Date.now() - outboxStaleMs(env));
  const result = await prisma.opsOutboxEvent.updateMany({
    where: {
      status: "PROCESSING",
      OR: [
        { processingStartedAt: { lt: staleBefore } },
        { processingStartedAt: null },
      ],
    },
    data: {
      status: "PENDING",
      processingStartedAt: null,
      lastError: "Reclaimed stale PROCESSING claim",
    },
  });
  return result.count;
}

/**
 * Atomically claim PENDING rows (FOR UPDATE SKIP LOCKED) → PROCESSING.
 * Prevents concurrent workers from delivering the same event twice.
 */
async function claimPendingOutboxEvents({ take, eventId } = {}) {
  if (eventId) {
    return prisma.$queryRaw`
      UPDATE "OpsOutboxEvent"
      SET
        status = 'PROCESSING'::"OpsOutboxStatus",
        "processingStartedAt" = NOW(),
        attempts = attempts + 1
      WHERE id = ${eventId}
        AND status = 'PENDING'::"OpsOutboxStatus"
      RETURNING
        id, type, "aggregateType", "aggregateId", payload, status::text AS status,
        attempts, "lastError", "idempotencyKey", "createdAt", "deliveredAt", "processingStartedAt"
    `;
  }

  return prisma.$queryRaw`
    UPDATE "OpsOutboxEvent" AS o
    SET
      status = 'PROCESSING'::"OpsOutboxStatus",
      "processingStartedAt" = NOW(),
      attempts = attempts + 1
    WHERE o.id IN (
      SELECT id FROM "OpsOutboxEvent"
      WHERE status = 'PENDING'::"OpsOutboxStatus"
      ORDER BY "createdAt" ASC
      LIMIT ${take}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      id, type, "aggregateType", "aggregateId", payload, status::text AS status,
      attempts, "lastError", "idempotencyKey", "createdAt", "deliveredAt", "processingStartedAt"
  `;
}

async function pushWithIdempotentSkip(integration, pushFn, event, { fetchImpl } = {}) {
  const idempotencyKey = `sync:${integration}:${event.id}`;
  const existing = await prisma.opsExternalSync.findUnique({
    where: { idempotencyKey },
    select: { status: true, externalRef: true },
  });
  if (existing?.status === "DELIVERED") {
    return {
      integration,
      status: "DELIVERED",
      retryable: false,
      externalRef: existing.externalRef,
      skippedPush: true,
    };
  }
  const result = await pushFn(event, { fetchImpl });
  return { integration, skippedPush: false, ...result };
}

function resolveOutboxTerminalState(pushes, attempts, maxAttempts) {
  const allSkipped = pushes.every((p) => p.status === "SKIPPED_UNCONFIGURED");
  if (allSkipped) {
    return {
      status: "SKIPPED_UNCONFIGURED",
      lastError:
        "All external integrations UNCONFIGURED — event retained; not delivered externally",
      deliveredAt: null,
      deferred: false,
    };
  }

  const failures = pushes.filter((p) => p.status === "FAILED");
  if (!failures.length) {
    return {
      status: "DELIVERED",
      lastError: null,
      deliveredAt: new Date(),
      deferred: false,
    };
  }

  const err = failures
    .map((f) => `${f.integration}:${f.error}`)
    .join("; ")
    .slice(0, 1000);
  const anyRetryable = failures.some((f) => f.retryable !== false);
  if (anyRetryable && attempts < maxAttempts) {
    return {
      status: "PENDING",
      lastError: err,
      deliveredAt: null,
      deferred: true,
    };
  }
  return {
    status: "FAILED",
    lastError: err,
    deliveredAt: null,
    deferred: false,
  };
}

/**
 * Reset FAILED / SKIPPED_UNCONFIGURED outbox rows to PENDING for retry-safe re-drain.
 * Does not invent external success — drain still runs real adapters.
 */
export async function retryFailedOutbox({ limit, eventId, actorUserId } = {}) {
  const take = Math.min(limit || DEFAULT_DRAIN_LIMIT, MAX_DRAIN_LIMIT);
  const where = eventId
    ? { id: eventId, status: { in: ["FAILED", "SKIPPED_UNCONFIGURED"] } }
    : { status: { in: ["FAILED", "SKIPPED_UNCONFIGURED"] } };

  const updated = await prisma.opsOutboxEvent.updateMany({
    where,
    data: {
      status: "PENDING",
      lastError: null,
      processingStartedAt: null,
    },
  });

  if (actorUserId) {
    await writeAudit({
      userId: actorUserId,
      action: "ops.outbox.retry",
      resourceType: "OpsOutboxEvent",
      resourceId: eventId || "batch",
      metadata: { reset: updated.count },
    });
  }

  return drainOutbox({ limit: take, actorUserId });
}

/**
 * Drain PENDING outbox events through CRM / mid / back / accounting adapters.
 * Uses claim locking; never fabricates DELIVERED when providers are unconfigured.
 */
export async function drainOutbox({
  limit,
  actorUserId,
  eventId,
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  const take = Math.min(limit || DEFAULT_DRAIN_LIMIT, MAX_DRAIN_LIMIT);
  const maxAttempts = outboxMaxAttempts(env);

  await reclaimStaleProcessingClaims({ env });

  const claimed = await claimPendingOutboxEvents({ take, eventId });
  if (!claimed.length) {
    return {
      delivered: 0,
      failed: 0,
      deferred: 0,
      unconfigured: 0,
      claimed: 0,
      results: [],
    };
  }

  const results = [];
  let delivered = 0;
  let failed = 0;
  let deferred = 0;
  let unconfigured = 0;

  for (const evt of claimed) {
    const pushes = [];
    for (const { integration, push } of INTEGRATION_PUSHERS) {
      // Sequential per integration is fine; keep fan-out bounded by event batch.
      // eslint-disable-next-line no-await-in-loop
      pushes.push(
        await pushWithIdempotentSkip(integration, push, evt, { fetchImpl }),
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const r of pushes) {
        if (r.skippedPush && r.status === "DELIVERED") continue;
        await recordExternalSync(tx, {
          integration: r.integration,
          event: evt,
          result: r,
        });
      }
    });

    const terminal = resolveOutboxTerminalState(pushes, evt.attempts, maxAttempts);
    await prisma.opsOutboxEvent.update({
      where: { id: evt.id },
      data: {
        status: terminal.status,
        lastError: terminal.lastError,
        deliveredAt: terminal.deliveredAt,
        processingStartedAt: null,
      },
    });

    if (terminal.status === "DELIVERED") delivered += 1;
    else if (terminal.status === "FAILED") failed += 1;
    else if (terminal.status === "SKIPPED_UNCONFIGURED") unconfigured += 1;
    else if (terminal.deferred) deferred += 1;

    results.push({
      eventId: evt.id,
      status: terminal.status,
      deferred: terminal.deferred,
      pushes: pushes.map((p) => ({
        integration: p.integration,
        status: p.status,
        retryable: p.retryable ?? null,
        skippedPush: Boolean(p.skippedPush),
        error: p.error || null,
      })),
    });

    logger.info("ops.outbox.drain", {
      id: evt.id,
      type: evt.type,
      status: terminal.status,
      pushes: pushes.map((p) => ({
        i: p.integration,
        s: p.status,
        skip: Boolean(p.skippedPush),
      })),
    });
  }

  if (actorUserId) {
    await writeAudit({
      userId: actorUserId,
      action: "ops.outbox.drain",
      resourceType: "OpsOutboxEvent",
      resourceId: "batch",
      metadata: {
        delivered,
        failed,
        deferred,
        unconfigured,
        claimed: claimed.length,
      },
    });
  }

  return {
    delivered,
    failed,
    deferred,
    unconfigured,
    claimed: claimed.length,
    results,
  };
}

export async function listOutbox({ status, page, pageSize } = {}) {
  const { take, skip, currentPage } = paginationArgs({ page, pageSize });
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.opsOutboxEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: OUTBOX_SELECT,
    }),
    prisma.opsOutboxEvent.count({ where }),
  ]);
  const withDisplay = items.map((row) => ({
    ...row,
    displayStatus: outboxDisplayStatus(row),
  }));
  return paginatedResult(withDisplay, total, take, currentPage);
}

export async function listAccounting({ bookingId, entryType, companyId, page, pageSize } = {}) {
  const { take, skip, currentPage } = paginationArgs({ page, pageSize });
  const where = {
    ...(bookingId ? { bookingId } : {}),
    ...(entryType ? { entryType } : {}),
    ...(companyId ? { companyId } : {}),
  };
  const [items, total, aggregates] = await Promise.all([
    prisma.accountingEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: ACCOUNTING_SELECT,
    }),
    prisma.accountingEntry.count({ where }),
    prisma.accountingEntry.groupBy({
      by: ["currency", "entryType"],
      where,
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
  ]);
  return {
    ...paginatedResult(items, total, take, currentPage),
    aggregates: aggregates.map((row) => ({
      currency: row.currency,
      entryType: row.entryType,
      amountMinorSum: row._sum.amountMinor ?? 0,
      count: row._count._all,
    })),
  };
}

export async function createReconciliationItem(body = {}) {
  // Prefer booking-based reconcile when bookingId present
  let item;
  if (body.bookingId) {
    item = await reconcileBooking(body);
  } else {
    assertNonNegativeMinorAmount(body.expectedMinor, "expectedMinor");
    let status = "OPEN";
    let mismatchReason = null;
    if (body.invoicedMinor !== undefined && body.invoicedMinor !== null) {
      assertNonNegativeMinorAmount(body.invoicedMinor, "invoicedMinor");
      status = body.invoicedMinor === body.expectedMinor ? "MATCHED" : "MISMATCH";
      if (status === "MISMATCH") {
        mismatchReason = `expected=${body.expectedMinor} invoiced=${body.invoicedMinor}`;
      }
    } else {
      status = "DATA_UNAVAILABLE";
      mismatchReason = "No invoiced amount";
    }

    const key =
      body.idempotencyKey ||
      `recon:manual:${body.supplierCode}:${body.externalRef || "noref"}:${body.expectedMinor}:${body.invoicedMinor ?? "none"}`;

    const existing = await prisma.supplierReconItem.findUnique({ where: { idempotencyKey: key } }).catch(() => null);
    if (existing) {
      item = { ...existing, deduplicated: true };
    } else {
      item = await prisma.supplierReconItem.create({
        data: {
          supplierCode: body.supplierCode,
          externalRef: body.externalRef ?? null,
          bookingId: body.bookingId ?? null,
          expectedMinor: body.expectedMinor,
          invoicedMinor: body.invoicedMinor ?? null,
          currency: body.currency || null,
          status,
          notes: body.notes || null,
          mismatchReason,
          idempotencyKey: key,
        },
        select: RECON_SELECT,
      });
    }
  }

  if (body.actorUserId && !item.deduplicated) {
    await writeAudit({
      userId: body.actorUserId,
      action: "ops.reconcile.create",
      resourceType: "SupplierReconItem",
      resourceId: item.id,
      metadata: {
        bookingId: item.bookingId,
        status: item.status,
        mismatchReason: item.mismatchReason || null,
      },
    });
  }

  return item;
}

export async function listReconciliation({ status, page, pageSize } = {}) {
  const { take, skip, currentPage } = paginationArgs({ page, pageSize });
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.supplierReconItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: RECON_SELECT,
    }),
    prisma.supplierReconItem.count({ where }),
  ]);
  return paginatedResult(items, total, take, currentPage);
}

export async function listAuditLog({ userId, resourceType, resourceId, page, pageSize } = {}) {
  const { take, skip, currentPage } = paginationArgs({ page, pageSize });
  const where = {
    ...(userId ? { userId } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(resourceId ? { resourceId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: AUDIT_SELECT,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paginatedResult(items, total, take, currentPage);
}

export async function getIntegrationStatus() {
  const [crm, mid, back, accounting, finance, commissions, reconciliation] = await Promise.all([
    Promise.resolve(getCrmCapability()),
    Promise.resolve(getMidOfficeCapability()),
    Promise.resolve(getBackOfficeCapability()),
    Promise.resolve(getAccountingCapability()),
    Promise.resolve(getFinanceCapability()),
    getCommissionCapability(),
    Promise.resolve(getReconciliationCapability()),
  ]);
  return { crm, midoffice: mid, backoffice: back, accounting, finance, commissions, reconciliation };
}

export async function getOperationsOverview() {
  const [
    pendingOutbox,
    processingOutbox,
    failedOutbox,
    deliveredOutbox,
    unconfiguredOutbox,
    retryingOutbox,
    accountingCount,
    commissionCount,
    reconOpen,
    reconMismatch,
    integrations,
  ] = await Promise.all([
    prisma.opsOutboxEvent.count({ where: { status: "PENDING", attempts: 0 } }),
    prisma.opsOutboxEvent.count({ where: { status: "PROCESSING" } }),
    prisma.opsOutboxEvent.count({ where: { status: "FAILED" } }),
    prisma.opsOutboxEvent.count({ where: { status: "DELIVERED" } }),
    prisma.opsOutboxEvent.count({ where: { status: "SKIPPED_UNCONFIGURED" } }),
    prisma.opsOutboxEvent.count({ where: { status: "PENDING", attempts: { gt: 0 } } }),
    prisma.accountingEntry.count(),
    prisma.commissionRecord.count(),
    prisma.supplierReconItem.count({
      where: { status: { in: ["OPEN", "DATA_UNAVAILABLE", "REQUIRES_REVIEW"] } },
    }),
    prisma.supplierReconItem.count({
      where: { status: { in: ["MISMATCH", "DISCREPANCY"] } },
    }),
    getIntegrationStatus(),
  ]);

  return {
    outbox: {
      pending: pendingOutbox + retryingOutbox,
      processing: processingOutbox,
      retrying: retryingOutbox,
      failed: failedOutbox,
      delivered: deliveredOutbox,
      unconfigured: unconfiguredOutbox,
    },
    accountingEntries: accountingCount,
    commissions: commissionCount,
    reconciliation: { needsAttention: reconOpen, mismatches: reconMismatch },
    integrations,
  };
}

export {
  getFinanceSnapshot,
  listCommissions,
  reconcileBooking,
};

/** Ava grounding — never invents ops/external status. */
export async function buildAvaOperationsGuidance(userId, bookingId) {
  if (!bookingId) {
    return {
      promptBlock:
        "OPERATIONS: No bookingId — answer booking/refund status from Modules 03/14 only. Never invent CRM sync, accounting postings, or reconciliation.",
    };
  }
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, status: true, currency: true, amountMinor: true },
  });
  if (!booking) {
    return {
      promptBlock:
        "OPERATIONS: Booking not found for user — never invent ticketing/refund/accounting status.",
    };
  }
  const [payments, refunds, integrations] = await Promise.all([
    prisma.payment.findMany({
      where: { bookingId },
      select: { status: true, amountMinor: true, provider: true },
      take: 5,
    }),
    prisma.refundCase.findMany({
      where: { bookingId },
      select: { status: true, paymentRefundStatus: true },
      take: 5,
    }),
    getIntegrationStatus(),
  ]);
  return {
    promptBlock: [
      `OPERATIONS context for booking ${booking.id}: bookingStatus=${booking.status};`,
      `payments=${payments.map((p) => p.status).join(",") || "none"};`,
      `refundCases=${refunds.map((r) => `${r.status}/${r.paymentRefundStatus || "n/a"}`).join(",") || "none"};`,
      `CRM=${integrations.crm.state}; midOffice=${integrations.midoffice.state}; accountingExternal=${integrations.accounting.state}.`,
      "Customer-facing truth remains booking/payment/refund modules — never claim CRM/accounting sync succeeded unless status is VERIFIED/DELIVERED for that integration.",
    ].join(" "),
  };
}
