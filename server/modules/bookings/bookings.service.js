/**
 * Module 03 — AI Booking Engine: explicit, auditable booking state machine.
 *
 * QUOTED -> RESERVED -> TICKETED -> ACTIVE -> COMPLETED | CANCELLED | REFUNDED
 *
 * Invariants enforced here (dev guide §7):
 *  - Every transition is written through `applyTransition`, which updates the
 *    booking row and appends an append-only `BookingTransition` audit row in
 *    the same DB transaction. There are no silent status changes.
 *  - Illegal transitions throw `AppError(400, ...)` — the allowed-transition
 *    table below is the single source of truth.
 *  - `reserveBooking`/`ticketBooking` re-validate price via Module 05's
 *    margin engine (`../pricing/pricing.service.js#priceOffer`) before
 *    allowing the transition ("server is the real authority"). Live supplier
 *    inventory/fare revalidation (AirPrice / RateHawk confirm) is gated by
 *    `../suppliers/supplierBooking.js` — if those APIs are unconfigured the
 *    transition is blocked with an honest 503 (never a fake PNR/ticket).
 *  - Ticketing is idempotent under retry: calling `ticket` on an
 *    already-TICKETED booking returns the existing booking with no new
 *    audit row and no re-issue.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { assertMinorAmount, assertNonNegativeMinorAmount, marginMinor } from "../../lib/money.js";
// Module 05 — Pricing & Margin Engine is the pricing authority for this
// module (dev guide §7: "server is the real authority"). Bookings calls into
// it rather than computing/re-deriving prices itself.
import * as pricingService from "../pricing/pricing.service.js";
import { getEffectivePermissions } from "../../lib/permissions.service.js";
// Module 06 — Corporate Travel: policy/credit gate before RESERVE (dev guide
// §7: "corporate spend is policy- and budget-gated before commitment, not
// after"). Only invoked when `booking.metadata.companyId` is set — personal
// bookings never touch this module.
import * as corporateService from "../corporate/corporate.service.js";
// Module 07 — Traveller Vault: auto-ingests the TICKET/HOTEL_VOUCHER
// document(s) on a successful ticket transition, no manual upload step
// (module doc: "documents issued by Module 03 land here automatically").
import * as vaultService from "../vault/vault.service.js";
import {
  assertSupplierCanReserve,
  assertSupplierCanTicket,
  assertSupplierRevalidateOrBlock,
  getSupplierBookingCapability,
  revalidateSupplierOffer,
  reserveSupplierInventory,
  releaseSupplierHold,
  ticketSupplierInventory,
} from "../suppliers/supplierBooking.js";
import { bookingRefsForRevalidation } from "../suppliers/suppliers.service.js";
import { BOOKING_ALLOWED_TRANSITIONS } from "./bookings.constants.js";
import * as paymentsService from "../payments/payments.service.js";

/** RateHawk prebook rotates book_hash; compare other booking refs only. */
function refsForEqualityCheck(refs, supplierCode) {
  if (!refs || typeof refs !== "object") return null;
  if (String(supplierCode || "").toUpperCase() === "RATEHAWK") {
    const { bookHash, ...rest } = refs;
    return rest;
  }
  return refs;
}

const MAX_PAGE_SIZE = 100;
const QUOTE_TTL_MS = Number(process.env.BOOKING_QUOTE_TTL_MS) || 15 * 60 * 1000; // 15m
const RESERVE_HOLD_MS = Number(process.env.BOOKING_RESERVE_HOLD_MS) || 30 * 60 * 1000; // 30m
const ATTEMPT_LOCK_STALE_MS = Number(process.env.BOOKING_ATTEMPT_LOCK_STALE_MS) || 2 * 60 * 1000; // 2m

async function reclaimStaleAttemptLock(booking, field) {
  if (!booking?.[field] || booking.status === "RESERVED" || booking.status === "TICKETED") {
    return;
  }
  const age = Date.now() - new Date(booking.updatedAt).getTime();
  if (age < ATTEMPT_LOCK_STALE_MS) return;
  await prisma.booking.update({
    where: { id: booking.id },
    data: { [field]: null },
  });
}

/**
 * Fire-and-forget hook into Module 15's event outbox (dynamic import avoids
 * a static import cycle — modules/operations/ has no reason to import back
 * into bookings). Never throws: an outbox write failure must not fail the
 * booking transition it's reporting on (dev guide §7 posture — the booking
 * state machine, not the sync layer, is the source of truth).
 */
async function enqueueOpsEventSafe(event) {
  try {
    const { enqueueOpsEvent } = await import("../operations/operations.service.js");
    await enqueueOpsEvent(event);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to enqueue ops event", {
      type: event?.type,
      aggregateId: event?.aggregateId,
      err: e,
    });
  }
}

/**
 * Auto-escalate fulfilment failures to Module 13 (Human Agent Escalation)
 * and record immutable audit trail per SDS UF-03.6 and UF-03.7.
 */
async function escalateTicketingFailureSafe({ booking, userId, error, details }) {
  try {
    const { escalateIfSupplierFailure } = await import("../escalations/escalations.service.js");
    let conversationId = booking.metadata?.conversationId;
    if (!conversationId) {
      const latestConv = await prisma.conversation.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (latestConv) {
        conversationId = latestConv.id;
      } else {
        const created = await prisma.conversation.create({
          data: {
            userId,
            title: `Fulfilment Escalation for Booking ${booking.id}`,
            metadata: { channel: "SYSTEM", source: "fulfilment_escalation" },
          },
          select: { id: true },
        });
        conversationId = created.id;
      }
    }

    const failureMsg = error?.message || details?.reason || "Supplier ticketing failed";
    const escResult = await escalateIfSupplierFailure({
      conversationId,
      userId,
      bookingId: booking.id,
      supplierCode: booking.supplierCode || "GALILEO",
      errorCode: "SUPPLIER_TICKETING_FAILED",
      message: failureMsg,
      failureClass: "HARD",
      requiresHumanIntervention: true,
    });

    const existingMeta = booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        metadata: {
          ...existingMeta,
          supplierBooking: {
            ...(existingMeta.supplierBooking || {}),
            ticket: {
              status: "failed",
              at: new Date().toISOString(),
              error: failureMsg,
              details: details ?? null,
            },
            escalation: escResult?.escalated
              ? {
                  ticketId: escResult.ticket?.id ?? null,
                  status: escResult.ticket?.status ?? "OPEN",
                  trigger: "SUPPLIER_FAILURE",
                  escalatedAt: new Date().toISOString(),
                }
              : null,
          },
        },
      },
    });

    await writeAudit({
      userId,
      action: "SUPPLIER_FULFILMENT_FAILED",
      resourceType: "Booking",
      resourceId: booking.id,
      metadata: {
        supplierCode: booking.supplierCode,
        externalRef: booking.externalRef,
        error: failureMsg,
        escalated: escResult?.escalated ?? false,
        escalationTicketId: escResult?.ticket?.id ?? null,
      },
    });

    await enqueueOpsEventSafe({
      type: "BOOKING_FULFILMENT_FAILED",
      aggregateType: "BOOKING",
      aggregateId: booking.id,
      payload: {
        bookingId: booking.id,
        userId,
        supplierCode: booking.supplierCode,
        externalRef: booking.externalRef,
        error: failureMsg,
        escalationId: escResult?.ticket?.id ?? null,
      },
    });

    return escResult;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to auto-escalate ticketing failure", { bookingId: booking?.id, err: e });
    return null;
  }
}

/**
 * Module 10 — Rewards & Referrals earn hook (dynamic import avoids a static
 * import cycle, same rationale/posture as `enqueueOpsEventSafe` above — a
 * failure to earn rewards must never fail the ticketing transition it's
 * reacting to; it already committed above).
 */
async function earnRewardsSafe(booking) {
  try {
    const { earnForBooking } = await import("../rewards/rewards.service.js");
    await earnForBooking({
      bookingId: booking.id,
      userId: booking.userId,
      amountMinor: booking.amountMinor,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to earn rewards for booking", { bookingId: booking?.id, err: e });
  }
}

/**
 * Best-effort Module 07 vault ingestion. Never throws: a vault-write failure
 * must not fail the ticket transition it's attached to, same posture as
 * `enqueueOpsEventSafe` above.
 */
async function ingestVaultDocumentsSafe({
  userId,
  bookingId,
  product,
  ticketNumbers,
  voucherRefs,
  externalRef,
  travellerSnapshot,
  currency,
  amountMinor,
}) {
  try {
    await vaultService.ingestBookingDocuments({
      userId,
      bookingId,
      product,
      ticketNumbers,
      voucherRefs,
      externalRef,
      travellerSnapshot,
      currency,
      amountMinor,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to auto-ingest vault document(s)", { bookingId, product, err: e });
  }
}

/**
 * Enqueue confirmed booking & ticket notification across in-app, email, and WhatsApp channels.
 * Strictly per SDS Appendix D: Booking confirmed / ticketed + documents -> App, Email, WhatsApp.
 * Swallow errors; notification failures must never fail the ticketing transition.
 */
async function sendBookingConfirmationNotificationSafe(ticketed) {
  try {
    const { enqueueNotificationOutbox } = await import("../../lib/notifications/enqueue.js");
    const productLabel =
      ticketed.product === "FLIGHT"
        ? "Flight"
        : ticketed.product === "HOTEL"
          ? "Hotel"
          : "Trip";
    const ref = ticketed.externalRef || ticketed.id;
    const ticketNumbers =
      ticketed.metadata?.ticketNumbers ||
      (Array.isArray(ticketed.metadata?.tickets)
        ? ticketed.metadata.tickets.map((t) => t.ticketNumber || t).filter(Boolean)
        : null);

    const ticketSuffix = ticketNumbers?.length ? ` (Ticket: ${ticketNumbers.join(", ")})` : "";
    const title = `${productLabel} Booking Confirmed (${ref})`;
    const body = `Your ${productLabel.toLowerCase()} booking ${ticketed.id} has been confirmed with reference ${ref}${ticketSuffix}.`;

    // Extract phone for WhatsApp / SMS routing
    const primaryTraveller = Array.isArray(ticketed.travellerSnapshot)
      ? ticketed.travellerSnapshot[0]
      : null;
    const phone =
      ticketed.metadata?.phone ||
      ticketed.metadata?.contactPhone ||
      primaryTraveller?.phone ||
      primaryTraveller?.mobileNumber ||
      null;

    const basePayload = {
      bookingId: ticketed.id,
      status: ticketed.status,
      product: ticketed.product,
      externalRef: ticketed.externalRef,
      amountMinor: ticketed.amountMinor,
      currency: ticketed.currency,
      ticketNumbers: ticketNumbers || [],
      phone,
    };

    await enqueueNotificationOutbox([
      {
        userId: ticketed.userId,
        channel: "APP",
        dedupeKey: `booking:confirmed:${ticketed.id}:app`,
        title,
        body,
        payload: basePayload,
      },
      {
        userId: ticketed.userId,
        channel: "EMAIL",
        dedupeKey: `booking:confirmed:${ticketed.id}:email`,
        title,
        body,
        payload: basePayload,
      },
      {
        userId: ticketed.userId,
        channel: "WHATSAPP",
        dedupeKey: `booking:confirmed:${ticketed.id}:whatsapp`,
        title,
        body,
        payload: basePayload,
      },
    ]);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to enqueue booking confirmation notification", {
      bookingId: ticketed?.id,
      err: e,
    });
  }
}

/**
 * Best-effort Module 09 journey-watch creation on ticketing (dynamic import
 * — modules/journey/ has no reason to import back into bookings — swallow
 * errors; a watch-creation failure must never fail the ticket transition
 * itself, same posture as enqueueOpsEventSafe/ingestVaultDocumentsSafe
 * above). `flightNumber`/`departAt` aren't Booking columns (Module 03 is
 * product-agnostic — FLIGHT/HOTEL/PACKAGE) so they're read from
 * `booking.metadata`, if the caller supplied them at quote/create time;
 * both are optional and `ensureWatchForBooking` itself no-ops-to-error for
 * a non-FLIGHT/ineligible booking rather than throwing into this caller.
 */
async function ensureJourneyWatchSafe(booking) {
  try {
    const { ensureWatchForBooking } = await import("../journey/journey.service.js");
    await ensureWatchForBooking({
      bookingId: booking.id,
      userId: booking.userId,
      flightNumber: booking.metadata?.flightNumber,
      departAt: booking.metadata?.departAt,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to ensure journey watch for booking", { bookingId: booking?.id, err: e });
  }
}

/**
 * Module 08 — Visa Intelligence best-effort warning stub (dynamic import,
 * swallowed — same posture as `enqueueOpsEventSafe` above and
 * `visa.service.js#tryKnowledgeRetrieve`: a visa-lookup failure, or Module 08
 * not being wired up in a given deployment, must never block quote/booking
 * creation). Only meaningful when the caller supplied both a nationality and
 * a destination in `metadata`; returns `null` (no-op) otherwise or on error.
 */
async function tryVisaCheckSafe(nationality, destination, { userId, transitCountries } = {}) {
  try {
    const { checkVisaForBooking } = await import("../visa/visa.service.js");
    return await checkVisaForBooking({
      nationality,
      destination,
      transitCountries,
      userId,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to check visa requirement for booking", { nationality, destination, err: e });
    return null;
  }
}

/** Allowed transitions — single source of truth lives in bookings.constants.js. */
const ALLOWED_TRANSITIONS = BOOKING_ALLOWED_TRANSITIONS;

const BOOKING_SELECT = {
  id: true,
  userId: true,
  status: true,
  product: true,
  currency: true,
  amountMinor: true,
  netMinor: true,
  marginMinor: true,
  supplierCode: true,
  supplierOfferSnapshotId: true,
  supplierOfferId: true,
  supplierOfferCreatedAt: true,
  supplierOfferTtlMs: true,
  supplierOfferExpiresAt: true,
  supplierBookingRefs: true,
  externalRef: true,
  idempotencyKey: true,
  quoteExpiresAt: true,
  reservedUntil: true,
  travellerSnapshot: true,
  fareRules: true,
  metadata: true,
  reservationAttemptId: true,
  ticketAttemptId: true,
  createdAt: true,
  updatedAt: true,
};

const BOOKING_LIST_SELECT = {
  id: true,
  status: true,
  product: true,
  currency: true,
  amountMinor: true,
  netMinor: true,
  marginMinor: true,
  supplierCode: true,
  externalRef: true,
  quoteExpiresAt: true,
  reservedUntil: true,
  createdAt: true,
  updatedAt: true,
};

const TRANSITION_SELECT = {
  id: true,
  fromStatus: true,
  toStatus: true,
  actor: true,
  actorUserId: true,
  reason: true,
  createdAt: true,
};

function assertTransitionAllowed(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(400, `Cannot transition booking from ${fromStatus} to ${toStatus}`);
  }
}

async function getOwnedBookingOrThrow(userId, bookingId, select = BOOKING_SELECT) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select,
  });
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }
  return booking;
}

/**
 * Server-only: resolve agent discretionary discount authority for a booking
 * actor. Never trust client-supplied agentDiscountMaxBps / tier claims.
 */
async function agentDiscountAuthorityForUser(userId, requestedDiscountBps) {
  if (!requestedDiscountBps) return {};
  const eff = await getEffectivePermissions(userId);
  const agentDiscountMaxBps = await pricingService.resolveAgentDiscountMaxBps(eff);
  return { agentDiscountMaxBps };
}

/**
 * Re-price against Module 05's margin engine and compare the result to the
 * server's canonical `amountMinor` — a drift (from a markup rule, promo, or
 * config change since the quote was issued) means the quote is stale and the
 * transition must not proceed (dev guide §7: "re-price... at every step" /
 * "a price shown in a chat message is not the price charged"). Also keeps
 * the pre-existing client-confirmation check: the price the customer last
 * saw client-side must match the stored price too. Either mismatch is
 * persisted to `metadata` (outside of, and regardless of, the eventual
 * transition) so pricing/ops can see every rejected attempt, then the
 * rejection is thrown.
 *
 * Validates a booking transition against Module 05's pricing/margin engine
 * using the authoritative supplier net fare provided by supplier
 * revalidation (Module 03).
 */
async function revalidatePrice(booking, clientAmountMinor, authoritativeSupplier = {}) {
  if (clientAmountMinor !== undefined && clientAmountMinor !== null) {
    assertMinorAmount(clientAmountMinor, "clientAmountMinor");
  }

  let metadata = { ...(booking.metadata || {}) };
  if (clientAmountMinor !== undefined && clientAmountMinor !== null) {
    metadata.clientAmountMinor = clientAmountMinor;
  }

  const pricingInput = booking.metadata?.pricing?.input;
  let priced = null;
  if (pricingInput) {
    const netMinor = authoritativeSupplier.netMinor ?? booking.netMinor;
    const currency = authoritativeSupplier.currency ?? booking.currency;
    const supplierCode =
      authoritativeSupplier.supplierCode ?? booking.supplierCode ?? undefined;
    const agentAuthority = await agentDiscountAuthorityForUser(
      booking.userId,
      pricingInput.requestedDiscountBps,
    );
    priced = await pricingService.priceOffer({
      netMinor,
      currency,
      product: booking.product,
      supplierCode,
      route: pricingInput.route,
      cabin: pricingInput.cabin,
      segment: pricingInput.segment,
      promoCode: pricingInput.promoCode,
      requestedDiscountBps: pricingInput.requestedDiscountBps,
      previousAmountMinor: booking.amountMinor,
      ...(pricingInput.companyMarkupBps !== undefined
        ? { companyMarkupBps: pricingInput.companyMarkupBps }
        : {}),
      ...agentAuthority,
    });
    metadata.pricing = { ...priced, input: pricingInput };
  }

  const clientDrift =
    clientAmountMinor !== undefined &&
    clientAmountMinor !== null &&
    clientAmountMinor !== booking.amountMinor;
  const engineDrift = Boolean(priced?.priceChanged);

  if (clientDrift || engineDrift) {
    await prisma.booking.update({ where: { id: booking.id }, data: { metadata } });
    const err = new AppError(409, "price changed");
    err.code = "PRICE_CHANGED";
    err.details = {
      previousAmountMinor: booking.amountMinor,
      newAmountMinor: engineDrift && priced ? priced.amountMinor : booking.amountMinor,
      currency: booking.currency,
      reason: engineDrift ? "server_reprice" : "client_mismatch",
      appliedRules: priced?.appliedRules ?? null,
    };
    throw err;
  }

  return metadata;
}

function assertQuoteNotExpired(booking) {
  if (booking.quoteExpiresAt && booking.quoteExpiresAt < new Date()) {
    throw new AppError(409, "Quote expired — request a new quote before reserving");
  }
}

async function applyTransition(booking, toStatus, { actor, actorUserId, reason, data = {} }) {
  assertTransitionAllowed(booking.status, toStatus);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: toStatus, ...data },
      select: BOOKING_SELECT,
    });
    await tx.bookingTransition.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus,
        actor,
        actorUserId: actorUserId ?? null,
        reason: reason ?? null,
      },
    });
    return updated;
  });
}

/**
 * Create a new QUOTED booking. Idempotent on `idempotencyKey`: a retry with
 * the same key for the same user returns the existing booking instead of
 * creating a duplicate (dev guide §7: "idempotency key per booking attempt").
 */
export async function createQuote(
  userId,
  {
    product,
    currency,
    amountMinor,
    supplierOfferSnapshotId,
    netMinor,
    supplierCode,
    route,
    cabin,
    segment,
    promoCode,
    requestedDiscountBps,
    travellerSnapshot,
    fareRules,
    idempotencyKey,
    metadata,
  },
  actor = "CUSTOMER",
) {
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      select: BOOKING_SELECT,
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new AppError(409, "Idempotency key already used by another booking");
      }
      return existing;
    }
  }

  if (!supplierOfferSnapshotId) {
    throw new AppError(409, "Missing supplier offer reference");
  }

  const supplierSnapshot = await prisma.supplierOfferSnapshot.findFirst({
    where: { id: supplierOfferSnapshotId, userId },
    select: {
      id: true,
      supplierCode: true,
      supplierOfferId: true,
      product: true,
      currency: true,
      netMinor: true,
      supplierBookingRefs: true,
      createdAt: true,
      expiresAt: true,
      ttlMs: true,
    },
  });

  if (!supplierSnapshot) {
    throw new AppError(409, "Invalid supplier offer reference");
  }
  if (supplierSnapshot.expiresAt && supplierSnapshot.expiresAt < new Date()) {
    throw new AppError(409, "Quote expired — request a new quote before reserving");
  }
  if (supplierSnapshot.product !== product) {
    throw new AppError(409, "Supplier offer product mismatch");
  }
  if (supplierSnapshot.currency !== currency) {
    throw new AppError(409, "Supplier offer currency changed");
  }

  // Module 05 (pricing.service.js) is the pricing authority (dev guide §7).
  // Client-supplied amountMinor / forceClientPrice must never become financial
  // truth outside controlled NODE_ENV=test fixtures.
  const forceClientPrice =
    metadata?.forceClientPrice === true && process.env.NODE_ENV === "test";

  // Module 06 — never trust client companyId without membership verification.
  let verifiedCompanyId = null;
  let companyMarkupBps;
  const rawCompanyId =
    metadata?.companyId && typeof metadata.companyId === "string"
      ? metadata.companyId.trim()
      : null;
  if (rawCompanyId) {
    const corpCtx = await corporateService.resolveCorporateQuoteContext(userId, rawCompanyId);
    verifiedCompanyId = corpCtx.companyId;
    companyMarkupBps = corpCtx.companyMarkupBps;
  }

  let finalAmountMinor;
  let margin;
  let pricingSnapshot = null;

  const pricingInput = {
    route,
    cabin,
    segment,
    promoCode,
    requestedDiscountBps,
    ...(companyMarkupBps !== undefined ? { companyMarkupBps } : {}),
  };

  if (forceClientPrice) {
    assertNonNegativeMinorAmount(amountMinor, "amountMinor");
    finalAmountMinor = amountMinor;
    margin = marginMinor(finalAmountMinor, supplierSnapshot.netMinor);
  } else {
    const agentAuthority = await agentDiscountAuthorityForUser(
      userId,
      pricingInput.requestedDiscountBps,
    );
    const priced = await pricingService.priceOffer({
      netMinor: supplierSnapshot.netMinor,
      currency,
      product,
      supplierCode: supplierSnapshot.supplierCode,
      route: pricingInput.route,
      cabin: pricingInput.cabin,
      segment: pricingInput.segment,
      promoCode: pricingInput.promoCode,
      requestedDiscountBps: pricingInput.requestedDiscountBps,
      ...(companyMarkupBps !== undefined ? { companyMarkupBps } : {}),
      ...agentAuthority,
    });
    finalAmountMinor = priced.amountMinor;
    margin = priced.marginMinor;
    // Persisted so reserve/ticket-time revalidation can recompute the same
    // price later (booking rows don't carry route/cabin/segment/promoCode as
    // their own columns — that stays owned by prisma/pricing.prisma).
    pricingSnapshot = { ...priced, input: pricingInput };
  }

  const bookingMetadata = { ...(metadata || {}) };
  delete bookingMetadata.forceClientPrice;
  // Only persist a server-verified companyId (strip forged ids).
  if (verifiedCompanyId) {
    bookingMetadata.companyId = verifiedCompanyId;
    const policyEvaluation = await corporateService.evaluatePolicy({
      companyId: verifiedCompanyId,
      amountMinor: finalAmountMinor,
      cabin: cabin ?? bookingMetadata.cabin,
      airline: bookingMetadata.airline,
      departureDate: bookingMetadata.departureDate,
    });
    bookingMetadata.policyEvaluation = {
      withinPolicy: policyEvaluation.withinPolicy,
      violations: policyEvaluation.violations,
      policyId: policyEvaluation.policy?.id ?? null,
      // Explicit: policy evaluation is not an approval decision.
      approvalStatus: null,
      note: "Policy evaluation only — booking still requires APPROVED approval before pay/reserve",
    };

    // Module 06 project codes — optional; validate same-company + active.
    // Never trust client-supplied projectCode / projectCodeName strings.
    const rawProjectCodeId =
      metadata?.projectCodeId && typeof metadata.projectCodeId === "string"
        ? metadata.projectCodeId.trim()
        : null;
    if (rawProjectCodeId) {
      const projectCode = await corporateService.resolveActiveProjectCode(
        verifiedCompanyId,
        rawProjectCodeId,
      );
      bookingMetadata.projectCodeId = projectCode.id;
      bookingMetadata.projectCode = projectCode.code;
      bookingMetadata.projectCodeName = projectCode.name;
    } else {
      delete bookingMetadata.projectCodeId;
      delete bookingMetadata.projectCode;
      delete bookingMetadata.projectCodeName;
    }
  } else {
    delete bookingMetadata.companyId;
    delete bookingMetadata.policyEvaluation;
    delete bookingMetadata.projectCodeId;
    delete bookingMetadata.projectCode;
    delete bookingMetadata.projectCodeName;
  }

  // Always persist pricing input so reserve/ticket-time revalidation can
  // re-run Module 05 (even when forceClientPrice was used).
  bookingMetadata.pricing = pricingSnapshot ?? { input: pricingInput };

  // Module 08 — Visa Intelligence: non-blocking warning stub, only when the
  // caller told us who's travelling where (see tryVisaCheckSafe above).
  // Module 08 — informational visa warning (never a hard booking block).
  // Prefer explicit metadata; fall back to profile nationality when destination is known.
  const visaDestination = metadata?.destination;
  const visaNationality = metadata?.nationality;
  if (visaDestination || visaNationality) {
    const visaCheck = await tryVisaCheckSafe(visaNationality, visaDestination, {
      userId,
      transitCountries: metadata?.transitCountries,
    });
    if (visaCheck) {
      bookingMetadata.visaCheck = visaCheck;
    }
  }

  const snapshotFare =
    supplierSnapshot.supplierBookingRefs &&
    typeof supplierSnapshot.supplierBookingRefs === "object" &&
    supplierSnapshot.supplierBookingRefs.fare
      ? supplierSnapshot.supplierBookingRefs.fare
      : null;

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        userId,
        product,
        currency: supplierSnapshot.currency,
        amountMinor: finalAmountMinor,
        netMinor: supplierSnapshot.netMinor,
        marginMinor: margin,
        supplierCode: supplierSnapshot.supplierCode,
        supplierOfferSnapshotId: supplierSnapshot.id,
        supplierOfferId: supplierSnapshot.supplierOfferId,
        supplierOfferCreatedAt: supplierSnapshot.createdAt,
        supplierOfferTtlMs: supplierSnapshot.ttlMs,
        supplierOfferExpiresAt: supplierSnapshot.expiresAt,
        supplierBookingRefs: supplierSnapshot.supplierBookingRefs,
        travellerSnapshot: travellerSnapshot ?? null,
        fareRules: fareRules ?? snapshotFare ?? null,
        idempotencyKey: idempotencyKey ?? null,
        status: "QUOTED",
        quoteExpiresAt: supplierSnapshot.expiresAt,
        metadata: Object.keys(bookingMetadata).length ? bookingMetadata : null,
      },
      select: BOOKING_SELECT,
    });
    await tx.bookingTransition.create({
      data: {
        bookingId: created.id,
        fromStatus: null,
        toStatus: "QUOTED",
        actor,
        actorUserId: userId,
        reason: "Quote created",
      },
    });
    return created;
  });

  // Module 15 — Operations Platform: booking-created event (see comment on
  // enqueueOpsEventSafe above).
  await enqueueOpsEventSafe({
    type: "BOOKING_CREATED",
    aggregateType: "Booking",
    aggregateId: booking.id,
    idempotencyKey: `ops:booking:created:${booking.id}`,
    payload: {
      bookingId: booking.id,
      userId,
      product,
      status: booking.status,
      currency: booking.currency,
      amountMinor: booking.amountMinor,
      netMinor: booking.netMinor,
    },
  });

  return booking;
}

export async function listBookings(userId, { page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: BOOKING_LIST_SELECT,
    }),
    prisma.booking.count({ where: { userId } }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function payBooking(userId, bookingId, body) {
  return paymentsService.payBooking(userId, bookingId, body);
}

export async function getBookingById(userId, bookingId) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: {
      ...BOOKING_SELECT,
      payments: {
        select: {
          id: true,
          status: true,
          provider: true,
          amountMinor: true,
          currency: true,
          providerPaymentId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      transitions: {
        orderBy: { createdAt: "asc" },
        select: TRANSITION_SELECT,
      },
    },
  });
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }
  return {
    ...booking,
    supplierCapability: getSupplierBookingCapability(booking.supplierCode, booking),
    paymentCapability: paymentsService.getPaymentCapability(),
  };
}

export async function reserveBooking(
  userId,
  bookingId,
  { clientAmountMinor, travellerSnapshot, requestIp } = {},
  actor = "CUSTOMER",
) {
  let booking = await getOwnedBookingOrThrow(userId, bookingId);
  if (booking.status === "RESERVED") {
    return booking;
  }
  assertTransitionAllowed(booking.status, "RESERVED");
  assertQuoteNotExpired(booking);

  if (travellerSnapshot && typeof travellerSnapshot === "object") {
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { travellerSnapshot },
      select: BOOKING_SELECT,
    });
  }

  if (requestIp && typeof requestIp === "string" && requestIp.trim()) {
    const meta = {
      ...(booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {}),
      requestIp: requestIp.trim(),
    };
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { metadata: meta },
      select: BOOKING_SELECT,
    });
  }

  await reclaimStaleAttemptLock(booking, "reservationAttemptId");
  booking = await getOwnedBookingOrThrow(userId, bookingId);
  const supplierRevalidate = await revalidateSupplierOffer(booking);
  if (supplierRevalidate?.status === "unconfigured") {
    assertSupplierRevalidateOrBlock(supplierRevalidate);
  }
  if (supplierRevalidate?.status === "unavailable") {
    throw new AppError(409, "Supplier offer unavailable — request a new quote");
  }
  if (supplierRevalidate?.status === "expired") {
    throw new AppError(409, "Quote expired — request a new quote before reserving");
  }

  const metadata = await revalidatePrice(booking, clientAmountMinor, {
    netMinor: supplierRevalidate?.netMinor,
    currency: supplierRevalidate?.currency,
    supplierCode: booking.supplierCode ?? undefined,
  });

  const quotedRefs = bookingRefsForRevalidation(booking.supplierBookingRefs);
  const returnedRefs = bookingRefsForRevalidation(
    supplierRevalidate?.details?.supplierBookingRefs,
  );
  if (
    quotedRefs &&
    returnedRefs &&
    JSON.stringify(refsForEqualityCheck(quotedRefs, booking.supplierCode)) !==
      JSON.stringify(refsForEqualityCheck(returnedRefs, booking.supplierCode))
  ) {
    throw new AppError(409, "Supplier offer changed — request a new quote");
  }

  if (
    returnedRefs?.bookHash &&
    String(booking.supplierCode || "").toUpperCase() === "RATEHAWK" &&
    returnedRefs.bookHash !== quotedRefs?.bookHash
  ) {
    const nextRefs =
      booking.supplierBookingRefs?.booking && typeof booking.supplierBookingRefs.booking === "object"
        ? {
            ...booking.supplierBookingRefs,
            booking: { ...booking.supplierBookingRefs.booking, bookHash: returnedRefs.bookHash },
          }
        : { ...(booking.supplierBookingRefs || {}), bookHash: returnedRefs.bookHash };
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { supplierBookingRefs: nextRefs },
      select: BOOKING_SELECT,
    });
  }

  const companyId = booking.metadata?.companyId;
  if (companyId) {
    await corporateService.assertCorporateBookingAllowed({
      userId,
      companyId,
      bookingId: booking.id,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      cabin: booking.metadata?.cabin ?? booking.metadata?.pricing?.input?.cabin,
    });
  }

  const payment = await paymentsService.getSuccessfulPayment(booking.id, userId);
  const pendingHold = !payment
    ? await prisma.payment.findFirst({
        where: { bookingId: booking.id, userId, status: "PENDING" },
      })
    : null;
  if (!payment && !pendingHold) {
    const cap = paymentsService.getPaymentCapability();
    if (!companyId && !cap.canCapture) {
      const err = new AppError(503, "Payment gateway is not configured");
      err.code = paymentsService.PAYMENT_UNCONFIGURED;
      err.details = { capability: cap };
      throw err;
    }
    const err = new AppError(402, "Payment required before supplier reservation");
    err.code = "PAYMENT_REQUIRED";
    throw err;
  }

  assertSupplierCanReserve(booking);

  const attemptId = `rsv_${booking.id}_${Date.now()}`;
  const claimed = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      userId,
      status: "QUOTED",
      reservationAttemptId: null,
    },
    data: { reservationAttemptId: attemptId },
  });
  if (claimed.count === 0) {
    const latest = await getOwnedBookingOrThrow(userId, bookingId);
    if (latest.status === "RESERVED") return latest;
    throw new AppError(409, "Reservation already in progress");
  }

  let supplierHold;
  try {
    supplierHold = await reserveSupplierInventory({ ...booking, reservationAttemptId: attemptId });
  } catch (e) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationAttemptId: null },
    });
    throw e;
  }

  if (supplierHold.status === "unconfigured") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationAttemptId: null },
    });
    assertSupplierCanReserve(booking);
  }

  if (supplierHold.status === "failed" || supplierHold.status === "DATA_UNAVAILABLE") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationAttemptId: null },
    });
    await paymentsService.voidSuccessfulPayments(booking.id, userId, {
      reason: "voided after supplier reservation failure",
    });
    await releaseSupplierHold(booking).catch(() => {});
    const status = supplierHold.status === "DATA_UNAVAILABLE" ? 422 : 409;
    const err = new AppError(
      status,
      supplierHold.details?.reason || "Supplier reservation failed",
    );
    if (supplierHold.status === "DATA_UNAVAILABLE") err.code = "DATA_UNAVAILABLE";
    throw err;
  }

  if (supplierHold.status === "ok" && !supplierHold.externalRef) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationAttemptId: null },
    });
    throw new AppError(409, "Supplier reservation returned no locator");
  }

  metadata.supplierBooking = {
    ...(metadata.supplierBooking && typeof metadata.supplierBooking === "object"
      ? metadata.supplierBooking
      : {}),
    reserve: {
      status: supplierHold.status,
      at: new Date().toISOString(),
      details: supplierHold.details ?? null,
    },
    payment: (payment || pendingHold)
      ? {
          id: (payment || pendingHold).id,
          status: (payment || pendingHold).status,
          provider: (payment || pendingHold).provider,
        }
      : null,
  };

  const reserved = await applyTransition(booking, "RESERVED", {
    actor,
    actorUserId: userId,
    reason:
      supplierHold.status === "simulated"
        ? "Reserved (simulated — no supplier PNR)"
        : "Reserved with supplier",
    data: {
      metadata,
      externalRef: supplierHold.externalRef ?? null,
      reservedUntil: new Date(Date.now() + RESERVE_HOLD_MS),
    },
  });

  if (companyId) {
    await corporateService.consumeCredit(companyId, booking.amountMinor, {
      actorUserId: userId,
      bookingId: booking.id,
    });
  }

  await enqueueOpsEventSafe({
    type: "BOOKING_RESERVED",
    aggregateType: "Booking",
    aggregateId: reserved.id,
    payload: {
      bookingId: reserved.id,
      userId,
      status: reserved.status,
      currency: reserved.currency,
      amountMinor: reserved.amountMinor,
      netMinor: reserved.netMinor,
      externalRef: reserved.externalRef,
    },
  });

  return reserved;
}

export async function ticketBooking(userId, bookingId, { clientAmountMinor } = {}, actor = "CUSTOMER") {
  let booking = await getOwnedBookingOrThrow(userId, bookingId);

  // Idempotent under retry — never double-issue a ticket (dev guide §7).
  // JourneyWatch may already have promoted TICKETED → ACTIVE.
  if (booking.status === "TICKETED" || booking.status === "ACTIVE" || booking.status === "COMPLETED") {
    return booking;
  }

  assertQuoteNotExpired(booking);
  assertTransitionAllowed(booking.status, "TICKETED");

  const supplierRevalidate = await revalidateSupplierOffer(booking);
  if (supplierRevalidate?.status === "unconfigured") {
    assertSupplierRevalidateOrBlock(supplierRevalidate);
  }
  if (supplierRevalidate?.status === "unavailable") {
    throw new AppError(409, "Supplier offer unavailable — request a new quote");
  }
  if (supplierRevalidate?.status === "expired") {
    throw new AppError(409, "Quote expired — request a new quote before ticketing");
  }

  const metadata = await revalidatePrice(booking, clientAmountMinor, {
    netMinor: supplierRevalidate?.netMinor,
    currency: supplierRevalidate?.currency,
    supplierCode: booking.supplierCode ?? undefined,
  });

  const quotedRefs = bookingRefsForRevalidation(booking.supplierBookingRefs);
  const returnedRefs = bookingRefsForRevalidation(
    supplierRevalidate?.details?.supplierBookingRefs,
  );
  if (
    quotedRefs &&
    returnedRefs &&
    JSON.stringify(refsForEqualityCheck(quotedRefs, booking.supplierCode)) !==
      JSON.stringify(refsForEqualityCheck(returnedRefs, booking.supplierCode))
  ) {
    throw new AppError(409, "Supplier offer changed — request a new quote");
  }

  assertSupplierCanTicket(booking);

  const companyId = booking.metadata?.companyId;
  if (companyId) {
    await corporateService.assertCorporateBookingAllowed({
      userId,
      companyId,
      bookingId: booking.id,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      cabin: booking.metadata?.cabin ?? booking.metadata?.pricing?.input?.cabin,
    });
  }

  const payment = await paymentsService.getSuccessfulPayment(booking.id, userId);
  if (!payment) {
    const err = new AppError(402, "Payment required before ticketing");
    err.code = "PAYMENT_REQUIRED";
    throw err;
  }

  await reclaimStaleAttemptLock(booking, "ticketAttemptId");
  booking = await getOwnedBookingOrThrow(userId, bookingId);

  const attemptId = `tkt_${booking.id}_${Date.now()}`;
  const claimed = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      userId,
      status: "RESERVED",
      ticketAttemptId: null,
    },
    data: { ticketAttemptId: attemptId },
  });
  if (claimed.count === 0) {
    const latest = await getOwnedBookingOrThrow(userId, bookingId);
    if (latest.status === "TICKETED") return latest;
    throw new AppError(409, "Ticketing already in progress");
  }

  let supplierTicket = null;
  let lastErr = null;
  const maxAttempts = 3; // 1 initial + 2 retries per SDS UF-03.7
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      supplierTicket = await ticketSupplierInventory({
        ...booking,
        ticketAttemptId: attemptId,
        ticketingAttemptNumber: attempt,
      });
      if (supplierTicket.status === "ok" || supplierTicket.status === "unconfigured") {
        break;
      }
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  if (lastErr && (!supplierTicket || supplierTicket.status === "failed")) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { ticketAttemptId: null },
    });
    await escalateTicketingFailureSafe({
      booking,
      userId,
      error: lastErr,
      details: { reason: lastErr.message },
    });
    throw lastErr;
  }

  if (supplierTicket.status === "unconfigured") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { ticketAttemptId: null },
    });
    assertSupplierCanTicket(booking);
  }

  if (supplierTicket.status === "failed" || supplierTicket.status === "simulated") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { ticketAttemptId: null },
    });
    if (supplierTicket.status === "failed") {
      // Keep RESERVED so the customer can retry; auto-escalate to Module 13 per SDS UF-03.7
      await escalateTicketingFailureSafe({
        booking,
        userId,
        error: null,
        details: supplierTicket.details,
      });
      throw new AppError(
        409,
        supplierTicket.details?.reason || "Supplier ticketing failed",
      );
    }
    throw new AppError(
      503,
      "Supplier ticketing is not configured — refusing fabricated ticket success",
    );
  }

  const ticketNumbers = supplierTicket.ticketNumbers;
  const voucherRefs = supplierTicket.voucherRefs;
  if (
    (!Array.isArray(ticketNumbers) || ticketNumbers.length === 0) &&
    (!Array.isArray(voucherRefs) || voucherRefs.length === 0)
  ) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { ticketAttemptId: null },
    });
    throw new AppError(409, "Supplier ticket response returned no ticket/voucher references");
  }

  metadata.supplierBooking = {
    ...(metadata.supplierBooking && typeof metadata.supplierBooking === "object"
      ? metadata.supplierBooking
      : {}),
    ticket: {
      status: supplierTicket.status,
      at: new Date().toISOString(),
      ticketNumbers: ticketNumbers ?? null,
      voucherRefs: voucherRefs ?? null,
      details: supplierTicket.details ?? null,
    },
  };

  const ticketed = await applyTransition(booking, "TICKETED", {
    actor,
    actorUserId: userId,
    reason: "Ticket/voucher issued by supplier",
    data: {
      metadata,
      externalRef: supplierTicket.externalRef ?? booking.externalRef,
      reservedUntil: null,
      ticketAttemptId: null,
    },
  });

  const promoCode = metadata?.pricing?.input?.promoCode;
  if (promoCode) {
    try {
      await pricingService.redeemPromoCode(promoCode);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to redeem promo code usage", { promoCode, bookingId: booking.id, err: e });
    }
  }

  await ingestVaultDocumentsSafe({
    userId,
    bookingId: ticketed.id,
    product: ticketed.product,
    ticketNumbers: ticketNumbers ?? null,
    voucherRefs: voucherRefs ?? null,
    externalRef: ticketed.externalRef,
    travellerSnapshot: ticketed.travellerSnapshot,
    currency: ticketed.currency,
    amountMinor: ticketed.amountMinor,
  });

  await sendBookingConfirmationNotificationSafe(ticketed);

  await enqueueOpsEventSafe({
    type: "BOOKING_TICKETED",
    aggregateType: "Booking",
    aggregateId: ticketed.id,
    idempotencyKey: `ops:booking:ticketed:${ticketed.id}`,
    payload: {
      bookingId: ticketed.id,
      userId,
      status: ticketed.status,
      currency: ticketed.currency,
      amountMinor: ticketed.amountMinor,
      netMinor: ticketed.netMinor,
      supplierCode: ticketed.supplierCode,
      externalRef: ticketed.externalRef,
      ticketNumbers: ticketNumbers ?? null,
      voucherRefs: voucherRefs ?? null,
    },
  });

  await ensureJourneyWatchSafe(ticketed);
  await earnRewardsSafe(ticketed);

  return ticketed;
}

/**
 * Explicit customer acceptance of a Module 05 reprice after PRICE_CHANGED.
 * Recomputes the authoritative price and, only if it matches `acceptedAmountMinor`,
 * updates the booking quote so reserve/ticket can continue.
 */
export async function acceptPriceChange(userId, bookingId, { acceptedAmountMinor }) {
  assertNonNegativeMinorAmount(acceptedAmountMinor, "acceptedAmountMinor");
  const booking = await getOwnedBookingOrThrow(userId, bookingId);
  if (booking.status !== "QUOTED") {
    throw new AppError(409, `Cannot accept a price change for status ${booking.status}`);
  }
  assertQuoteNotExpired(booking);

  const supplierRevalidate = await revalidateSupplierOffer(booking);
  if (supplierRevalidate?.status === "unavailable") {
    throw new AppError(409, "Supplier offer unavailable — request a new quote");
  }
  if (supplierRevalidate?.status === "expired") {
    throw new AppError(409, "Quote expired — request a new quote");
  }

  const pricingInput = booking.metadata?.pricing?.input || {};
  const netMinor = supplierRevalidate?.netMinor ?? booking.netMinor;
  const currency = supplierRevalidate?.currency ?? booking.currency;
  if (currency !== booking.currency) {
    throw new AppError(409, "Supplier offer currency changed");
  }

  const agentAuthority = await agentDiscountAuthorityForUser(
    userId,
    pricingInput.requestedDiscountBps,
  );
  const priced = await pricingService.priceOffer({
    netMinor,
    currency,
    product: booking.product,
    supplierCode: booking.supplierCode ?? undefined,
    route: pricingInput.route,
    cabin: pricingInput.cabin,
    segment: pricingInput.segment,
    promoCode: pricingInput.promoCode,
    requestedDiscountBps: pricingInput.requestedDiscountBps,
    previousAmountMinor: booking.amountMinor,
    ...(pricingInput.companyMarkupBps !== undefined
      ? { companyMarkupBps: pricingInput.companyMarkupBps }
      : {}),
    ...agentAuthority,
  });

  if (priced.amountMinor !== acceptedAmountMinor) {
    const err = new AppError(409, "price changed");
    err.code = "PRICE_CHANGED";
    err.details = {
      previousAmountMinor: booking.amountMinor,
      newAmountMinor: priced.amountMinor,
      currency: booking.currency,
      reason: "server_reprice",
      appliedRules: priced.appliedRules,
    };
    throw err;
  }

  const metadata = {
    ...(booking.metadata || {}),
    pricing: { ...priced, input: pricingInput },
    priceAcceptedAt: new Date().toISOString(),
    previousAmountMinor: booking.amountMinor,
  };

  return prisma.booking.update({
    where: { id: booking.id },
    data: {
      amountMinor: priced.amountMinor,
      netMinor,
      marginMinor: priced.marginMinor,
      metadata,
    },
    select: BOOKING_SELECT,
  });
}

export async function cancelBooking(
  userId,
  bookingId,
  { reason, actorUserId } = {},
  actor = "CUSTOMER",
) {
  const booking = await getOwnedBookingOrThrow(userId, bookingId);

  let supplierRelease = null;
  if (booking.status === "RESERVED" || booking.externalRef) {
    try {
      supplierRelease = await releaseSupplierHold(booking);
    } catch (e) {
      supplierRelease = { status: "failed", reason: e?.message || "supplier release threw" };
    }
  }

  const supplierCancelFailed =
    supplierRelease &&
    supplierRelease.status === "failed";

  const cancelled = await applyTransition(booking, "CANCELLED", {
    actor,
    actorUserId: actorUserId ?? userId,
    reason: supplierCancelFailed
      ? `${reason ?? "Cancelled"} (supplier cancel failed: ${supplierRelease.reason || "unknown"})`
      : reason ?? "Cancelled",
    data: {
      reservationAttemptId: null,
      ticketAttemptId: null,
      reservedUntil: null,
      metadata: {
        ...(booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {}),
        ...(supplierRelease
          ? {
              supplierCancel: {
                status: supplierRelease.status,
                reason: supplierRelease.reason || null,
                at: new Date().toISOString(),
              },
            }
          : {}),
      },
    },
  });

  if (booking.status === "QUOTED" || booking.status === "RESERVED") {
    await paymentsService.voidSuccessfulPayments(booking.id, userId, {
      reason: "voided after booking cancellation",
    }).catch(() => {});
  }

  await vaultService.onBookingCancelled(cancelled);

  // Module 06 — restore corporate credit if this booking consumed it at RESERVE.
  await corporateService.releaseCreditForBooking(cancelled.id, {
    actorUserId: actorUserId ?? userId,
    reason: "booking_cancelled",
  });

  await enqueueOpsEventSafe({
    type: "BOOKING_CANCELLED",
    aggregateType: "Booking",
    aggregateId: cancelled.id,
    payload: {
      bookingId: cancelled.id,
      userId,
      status: cancelled.status,
      currency: cancelled.currency,
      amountMinor: cancelled.amountMinor,
      reason: reason ?? "Cancelled",
    },
  });

  return cancelled;
}

// Module 14 (Refund & Reissue Engine) is the caller that actually drives a
// booking into REFUNDED (via its own `completeRefundCase`, using
// `applyTransition`'s same append-only BookingTransition pattern but
// through the ops-gated path, since the acting user isn't the booking's own
// customer) — see `modules/refunds/refunds.service.js#completeRefundCase`,
// which reports `BOOKING_REFUNDED` into the Module 15 outbox itself, the
// same way every hook in this file does.
