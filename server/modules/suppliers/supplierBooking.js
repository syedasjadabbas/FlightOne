/**
 * Module 03 — supplier booking / revalidation capabilities.
 *
 * Search adapters may already be live (Travelport). Book / ticket workbench
 * APIs are NOT wired yet. AirPrice (revalidation) is wired when Travelport is
 * configured. This module is the single choke point so booking orchestration
 * never pretends a hold or ticket succeeded, and never invents prices.
 *
 * Never invents PNRs, ticket numbers, or live fares.
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../../lib/customError.js";
import { isTravelportConfigured } from "./travelport/config.js";
import { travelportFetch } from "./travelport/http.js";
import { bookingRefsForRevalidation } from "./suppliers.service.js";
import {
  bookHeldReservationWithTravelport,
  cancelTravelportHold,
  cancelTravelportReservation,
} from "./travelport/book.js";
import { ticketHeldReservationWithTravelport } from "./travelport/ticket.js";
import {
  retrieveTravelportReservation,
  modifyTravelportReservation,
} from "./travelport/retrieve.js";
import { getTravelportSeatMap } from "./travelport/seats.js";
import {
  quoteTravelportExchange,
  reissueTravelportTicket,
} from "./travelport/exchange.js";
import {
  voidTravelportTicket,
  quoteTravelportRefund,
} from "./travelport/refund.js";
import { divideTravelportReservation } from "./travelport/divide.js";
import {
  readTravelportQueue,
  countTravelportQueue,
} from "./travelport/queues.js";
import {
  bookRateHawkReservation,
  cancelRateHawkHold,
  confirmRateHawkVoucher,
  getRateHawkCapability,
  isRateHawkConfigured,
  prebookRateHawk,
} from "./ratehawk.adapter.js";
import { withCircuitBreaker } from "./adapter.js";

export const TRAVELPORT_CIRCUIT_AIRPRICE = "TRAVELPORT_AIRPRICE";
export const TRAVELPORT_CIRCUIT_BOOK = "TRAVELPORT_BOOK";
export const TRAVELPORT_CIRCUIT_TICKET = "TRAVELPORT_TICKET";

export const SUPPLIER_BOOKING_UNCONFIGURED = "SUPPLIER_BOOKING_UNCONFIGURED";
export const SUPPLIER_TICKETING_UNCONFIGURED = "SUPPLIER_TICKETING_UNCONFIGURED";
export const SUPPLIER_REVALIDATE_UNCONFIGURED = "SUPPLIER_REVALIDATE_UNCONFIGURED";

/** Test-only reserve/ticket doubles. Production must never set these. */
let reserveInventoryOverride = null;
let ticketInventoryOverride = null;

export function setReserveSupplierInventoryOverrideForTests(fn) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot override supplier reserve in production");
  }
  reserveInventoryOverride = typeof fn === "function" ? fn : null;
}

export function setTicketSupplierInventoryOverrideForTests(fn) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot override supplier ticket in production");
  }
  ticketInventoryOverride = typeof fn === "function" ? fn : null;
}

function allowSimulatedBooking() {
  // Explicit opt-in for local state-machine tests only — never in production.
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_SIMULATED_BOOKING === "true"
  );
}

/** Supplier code minted for offers served from the offline demo corpus. */
export const DEMO_SUPPLIER_CODE = "GALILEO_DEMO";

/**
 * Demo fares reserve and "ticket" without any supplier call.
 *
 * Deliberately a SEPARATE code from GALILEO: reusing GALILEO would route these
 * bookings into live Travelport reserve/ticket, which would either fail or —
 * worse — act on a real GDS with fabricated fare data. Gated on demo mode and
 * hard-blocked in production so it can never mint a ticket for a real booking.
 */
function allowDemoBooking() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEMO_FLIGHT_INVENTORY === "true"
  );
}

/**
 * @param {string | null | undefined} supplierCode
 * @param {{ product?: string } | null} [booking]
 */
export function getSupplierBookingCapability(supplierCode, booking = null) {
  const code = supplierCode ? String(supplierCode).trim().toUpperCase() : null;
  const product = booking?.product ? String(booking.product).toUpperCase() : null;
  const travelport = isTravelportConfigured();
  const simulated = allowSimulatedBooking();
  const demo = allowDemoBooking();
  const testDouble =
    Boolean(reserveInventoryOverride || ticketInventoryOverride) &&
    process.env.NODE_ENV !== "production";

  const reasons = [];
  let searchConfigured = false;
  let bookLive = false;
  let ticketLive = false;

  if (code === "GALILEO" || code === "TRAVELPORT") {
    searchConfigured = travelport;
    if (product === "HOTEL") {
      reasons.push(
        "Travelport Stays hotel book/voucher APIs are not wired — hotel confirmation uses RateHawk",
      );
    } else {
      bookLive = travelport;
      ticketLive = travelport;
    }
    if (!travelport) {
      reasons.push("Travelport credentials are not configured");
    }
  } else if (code === "RATEHAWK") {
    const rh = getRateHawkCapability();
    searchConfigured = rh.canSearch;
    bookLive = rh.canReserve;
    ticketLive = rh.canTicket;
    reasons.push(...rh.reasons);
  } else if (code === DEMO_SUPPLIER_CODE) {
    if (demo) {
      searchConfigured = true;
      bookLive = true;
      ticketLive = true;
      reasons.push(
        "Demo corpus fare — reserved and ticketed locally with a DEMO- reference, never sent to a supplier",
      );
    } else {
      reasons.push(
        "Demo corpus fare, but DEMO_FLIGHT_INVENTORY is not enabled — this booking cannot be fulfilled",
      );
    }
  } else if (!code) {
    reasons.push("Booking has no supplierCode — cannot revalidate or reserve inventory");
  } else {
    reasons.push(`No booking adapter registered for supplier ${code}`);
  }

  const canRevalidateLive =
    (code === "GALILEO" || code === "TRAVELPORT") && travelport && product !== "HOTEL";
  const canReserve = Boolean(bookLive || simulated || testDouble);
  const canTicket = Boolean(ticketLive || testDouble);
  // Simulated reserve is allowed for state-machine tests, but ticketing still
  // requires a real/test-double supplier response — never fabricate tickets.
  if (simulated && !ticketLive && !testDouble) {
    reasons.push(
      "ALLOW_SIMULATED_BOOKING=true allows reserve without a live PNR; ticketing still requires a real supplier or test double",
    );
  }

  const mode = simulated
    ? "simulated"
    : bookLive || ticketLive || testDouble
      ? "live"
      : "unconfigured";

  return {
    supplierCode: code,
    searchConfigured,
    canRevalidateLive,
    canReserve,
    canTicket,
    mode,
    reasons: simulated
      ? [
          ...reasons,
          "ALLOW_SIMULATED_BOOKING=true — simulated reserve allowed without inventing PNRs (dev/test only)",
        ]
      : reasons,
  };
}

/**
 * Adapter-boundary inspection for live AirPrice (no network, no invented success).
 */
export function inspectTravelportAirPriceBoundary(booking) {
  const configured = isTravelportConfigured();
  const refs = bookingRefsForRevalidation(booking?.supplierBookingRefs) || {};
  const hasSupplierRefs = Boolean(refs.transactionId && refs.offeringId && refs.productRef);
  return {
    configured,
    hasSupplierRefs,
    canAttemptLiveAirPrice: configured && hasSupplierRefs,
    endpoint: "/price/offers/buildfromcatalogproductofferings",
  };
}

/**
 * Live AirPrice revalidation against Travelport TripServices.
 * POST /price/offers/buildfromcatalogproductofferings (reference payload).
 *
 * Returns null when required refs are missing or Travelport is unconfigured.
 *
 * @param {{ supplierOfferId: string, supplierBookingRefs: object, currency: string }} booking
 * @returns {Promise<{status:"ok"|"unavailable"|"expired", netMinor?: number, currency?: string, details?: object}> | null}
 */
async function airPriceWithTravelport(booking) {
  if (!isTravelportConfigured()) return null;

  const refs = bookingRefsForRevalidation(booking?.supplierBookingRefs);
  const transactionId = refs?.transactionId;
  // The offering id is embedded in the offerId: "TP-<offeringId>_<...>" or plain offerId.
  // The offering id in the selection equals the offeringId embedded in the snapshot's refs.
  const offeringId = refs?.offeringId ?? null;
  const productRef = refs?.productRef ?? null;

  if (!transactionId || !offeringId || !productRef) {
    return null;
  }

  const traceId = `fo-reval-${randomUUID()}`;
  const body = {
    OfferQueryBuildFromCatalogProductOfferings: {
      BuildFromCatalogProductOfferingsRequest: {
        "@type": "BuildFromCatalogProductOfferingsRequestAir",
        CatalogProductOfferingsIdentifier: {
          Identifier: { value: transactionId },
        },
        CatalogProductOfferingSelection: [
          {
            CatalogProductOfferingIdentifier: {
              Identifier: { value: offeringId },
            },
            ProductIdentifier: [
              {
                Identifier: { value: productRef },
              },
            ],
          },
        ],
      },
    },
  };

  try {
    return await withCircuitBreaker(
      TRAVELPORT_CIRCUIT_AIRPRICE,
      async () => {
        const { json } = await travelportFetch("/price/offers/buildfromcatalogproductofferings", {
          method: "POST",
          body,
          traceId,
        });

        const offerList =
          json?.OfferListResponse?.Offer ||
          json?.Offer ||
          [];

        if (!offerList.length) {
          return { status: "unavailable", details: { reason: "no offers returned from AirPrice" } };
        }

        const offer = offerList[0];
        const price = offer?.Price || offer?.price;
        const total = price?.TotalPrice ?? price?.Total ?? price?.totalPrice;
        const currencyCode =
          price?.CurrencyCode?.value || price?.CurrencyCode || booking.currency || "PKR";
        const decimals =
          typeof price?.CurrencyCode?.decimalPlace === "number"
            ? price.CurrencyCode.decimalPlace
            : 2;
        const netMinor =
          typeof total === "number" ? Math.round(total * 10 ** decimals) : null;

        if (!netMinor) {
          return { status: "unavailable", details: { reason: "AirPrice returned no price" } };
        }

        return {
          status: "ok",
          netMinor,
          currency: currencyCode,
          details: {
            supplierBookingRefs: refs,
            traceId,
          },
        };
      },
      {
        isFailure: (v) => v?.status === "unavailable",
        onOpen: "return",
        openResult: () => ({
          status: "unavailable",
          details: { reason: "TRAVELPORT_AIRPRICE circuit open", code: "SUPPLIER_CIRCUIT_OPEN" },
        }),
      },
    );
  } catch (err) {
    // Any Travelport error means availability/price could not be confirmed.
    const msg = err instanceof AppError ? err.message : String(err?.message || err);
    return {
      status: "unavailable",
      details: { reason: `AirPrice failed: ${msg}` },
    };
  }
}

/**
 * Live inventory/fare revalidation before reserve/ticket.
 * Returns a structured result — never invents a new net fare.
 *
 * @returns {Promise<{
 *   status: "ok" | "unconfigured" | "unavailable" | "expired",
 *   netMinor?: number,
 *   currency?: string,
 *   details?: object & { supplierBookingRefs?: any },
 * }>}
 */
export async function revalidateSupplierOffer(booking) {
  const cap = getSupplierBookingCapability(booking?.supplierCode);

  // Demo corpus: the snapshot IS the source of truth — there is no supplier to
  // re-price against. Echo the stored net fare rather than inventing one, so
  // the booking engine's "never fabricate a fare" rule still holds.
  if (booking?.supplierCode === DEMO_SUPPLIER_CODE) {
    if (!cap.canReserve) {
      return { status: "unconfigured", details: { capability: cap } };
    }
    return {
      status: "ok",
      netMinor: booking.netMinor ?? booking.amountMinor,
      currency: booking.currency,
      details: {
        demo: true,
        capability: cap,
        supplierBookingRefs: bookingRefsForRevalidation(booking?.supplierBookingRefs),
        reason: "Demo corpus fare — snapshot price accepted without a supplier re-price",
      },
    };
  }

  // Live path: Travelport AirPrice when credentials are configured.
  if (
    isTravelportConfigured() &&
    (booking?.supplierCode === "GALILEO" || booking?.supplierCode === "TRAVELPORT")
  ) {
    const result = await airPriceWithTravelport(booking);
    if (result) return result;
    // Fall through to simulated / unconfigured.
  }

  if (cap.mode === "simulated") {
    // Simulation is controlled by supplierOfferId patterns so tests can
    // represent supplier price drift, unavailable offers, and expirations.
    const offerId = booking?.supplierOfferId;
    const bookingRefs = bookingRefsForRevalidation(booking?.supplierBookingRefs);
    if (!offerId || !bookingRefs) {
      return {
        status: "unavailable",
        details: { reason: "missing supplier offer refs", capability: cap },
      };
    }

    // Supported patterns:
    // - SIM-<minor>                → stable
    // - SIM-<quoted>-><current>  → drift (current used at revalidation)
    // - SIM-UNAVAILABLE           → unavailable
    // - SIM-EXPIRED               → expired
    const mDrift = String(offerId).match(/^SIM-(\d+)->(\d+)$/);
    if (mDrift) {
      const current = Number(mDrift[2]);
      return {
        status: "ok",
        netMinor: current,
        currency: booking.currency,
        details: {
          supplierBookingRefs: bookingRefs,
          offerId,
          capability: cap,
        },
      };
    }

    const mStable = String(offerId).match(/^SIM-(\d+)$/);
    if (mStable) {
      const netMinor = Number(mStable[1]);
      return {
        status: "ok",
        netMinor,
        currency: booking.currency,
        details: {
          supplierBookingRefs: bookingRefs,
          offerId,
          capability: cap,
        },
      };
    }

    if (String(offerId) === "SIM-UNAVAILABLE") {
      return { status: "unavailable", details: { reason: "simulated unavailable", capability: cap } };
    }
    if (String(offerId) === "SIM-EXPIRED") {
      return { status: "expired", details: { reason: "simulated expired", capability: cap } };
    }

    return {
      status: "unavailable",
      details: { reason: "unknown simulation offerId pattern", capability: cap },
    };
  }

  if (booking?.supplierCode === "RATEHAWK" && isRateHawkConfigured()) {
    return prebookRateHawk(booking);
  }

  return {
    status: "unconfigured",
    details: { capability: cap },
  };
}

/**
 * Attempt supplier inventory hold. Unconfigured → no side effects.
 * Live path creates a real Travelport held PNR. Never invents locators.
 */
function canAttemptLiveTravelportBook(booking) {
  if (!isTravelportConfigured()) return false;
  if (booking?.product === "HOTEL") return false;
  const code = booking?.supplierCode;
  if (code !== "GALILEO" && code !== "TRAVELPORT") return false;
  if (String(booking?.supplierOfferId || "").startsWith("SIM-")) return false;
  const refs = bookingRefsForRevalidation(booking?.supplierBookingRefs);
  return Boolean(refs?.transactionId && refs?.offeringId && refs?.productRef);
}

export async function reserveSupplierInventory(booking) {
  if (booking?.externalRef) {
    return {
      status: "ok",
      externalRef: booking.externalRef,
      details: { idempotent: true },
    };
  }

  if (reserveInventoryOverride) {
    return reserveInventoryOverride(booking);
  }

  const cap = getSupplierBookingCapability(booking?.supplierCode, booking);

  // Demo corpus: no supplier exists to call. The DEMO- prefix keeps these
  // references obviously non-real wherever a locator is displayed or exported.
  if (booking?.supplierCode === DEMO_SUPPLIER_CODE) {
    if (!cap.canReserve) {
      return { status: "unconfigured", externalRef: null, details: { capability: cap } };
    }
    return {
      status: "ok",
      externalRef: `DEMO-${String(booking.id ?? "").slice(-6).toUpperCase() || "000000"}`,
      details: { demo: true, reason: "Demo corpus fare — no supplier reservation was made" },
    };
  }

  if (booking?.supplierCode === "RATEHAWK" || booking?.product === "HOTEL") {
    if (isRateHawkConfigured() && booking?.supplierCode === "RATEHAWK") {
      const live = await bookRateHawkReservation(booking);
      if (live.status === "ok" && live.externalRef) {
        return {
          status: "ok",
          externalRef: live.externalRef,
          details: { ...live.details, voucherRefs: live.voucherRefs },
        };
      }
      if (live.status === "failed" || live.status === "DATA_UNAVAILABLE") {
        return { status: live.status === "DATA_UNAVAILABLE" ? "DATA_UNAVAILABLE" : "failed", externalRef: null, details: live.details };
      }
    }
  }

  if (canAttemptLiveTravelportBook(booking)) {
    const live = await withCircuitBreaker(
      TRAVELPORT_CIRCUIT_BOOK,
      () => bookHeldReservationWithTravelport(booking),
      {
        isFailure: (v) => v?.status === "failed",
        onOpen: "return",
        openResult: () => ({
          status: "failed",
          externalRef: null,
          details: { reason: "TRAVELPORT_BOOK circuit open", code: "SUPPLIER_CIRCUIT_OPEN" },
        }),
      },
    );
    if (live.status === "ok" && live.externalRef) {
      return { status: "ok", externalRef: live.externalRef, details: live.details };
    }
    if (live.status === "failed") {
      return { status: "failed", externalRef: null, details: live.details };
    }
  }

  if (cap.mode === "simulated" || allowSimulatedBooking()) {
    return {
      status: "simulated",
      externalRef: null,
      details: {
        warning: "No supplier PNR/confirmation created — simulated reserve for tests only",
        capability: cap,
      },
    };
  }
  return {
    status: "unconfigured",
    details: { capability: cap },
  };
}

export async function releaseSupplierHold(booking) {
  const code = String(booking?.supplierCode || "").toUpperCase();
  if (code === "RATEHAWK") {
    return cancelRateHawkHold(booking);
  }
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return cancelTravelportHold(booking);
  }
  return { status: "skipped", reason: "no cancel adapter for supplier" };
}

/**
 * Ticket / voucher issuance. Never reports success without supplier ticket numbers
 * or hotel voucher/confirmation refs.
 */
export async function ticketSupplierInventory(booking) {
  if (ticketInventoryOverride) {
    return ticketInventoryOverride(booking);
  }

  const existingTickets = booking?.metadata?.supplierBooking?.ticket?.ticketNumbers;
  const existingVouchers = booking?.metadata?.supplierBooking?.ticket?.voucherRefs;
  if (Array.isArray(existingTickets) && existingTickets.length > 0) {
    return {
      status: "ok",
      externalRef: booking.externalRef ?? null,
      ticketNumbers: existingTickets,
      details: { idempotent: true },
    };
  }
  if (Array.isArray(existingVouchers) && existingVouchers.length > 0) {
    return {
      status: "ok",
      externalRef: booking.externalRef ?? null,
      voucherRefs: existingVouchers,
      details: { idempotent: true },
    };
  }

  const code = String(booking?.supplierCode || "").toUpperCase();

  // Demo corpus: issue a clearly-marked DEMO ticket number. Never routed to
  // Travelport — these fares are historical and were never held with a carrier.
  if (code === DEMO_SUPPLIER_CODE) {
    const cap = getSupplierBookingCapability(code, booking);
    if (!cap.canTicket) {
      return { status: "unconfigured", details: { capability: cap } };
    }
    return {
      status: "ok",
      externalRef: booking?.externalRef ?? null,
      ticketNumbers: [`DEMO-${String(booking?.id ?? "").slice(-8).toUpperCase() || "00000000"}`],
      details: { demo: true, reason: "Demo corpus fare — no ticket was issued with a carrier" },
    };
  }

  if (code === "RATEHAWK" || booking?.product === "HOTEL") {
    if (isRateHawkConfigured() && code === "RATEHAWK") {
      const live = await confirmRateHawkVoucher(booking);
      if (live.status === "ok" && (live.voucherRefs?.length || live.externalRef)) {
        return {
          status: "ok",
          externalRef: live.externalRef ?? booking.externalRef,
          voucherRefs: live.voucherRefs ?? [live.externalRef],
          details: live.details,
        };
      }
      if (live.status === "failed") {
        return { status: "failed", details: live.details };
      }
    }
    return {
      status: "unconfigured",
      details: { capability: getSupplierBookingCapability(code, booking) },
    };
  }

  if ((code === "GALILEO" || code === "TRAVELPORT") && isTravelportConfigured()) {
    if (String(booking?.supplierOfferId || "").startsWith("SIM-")) {
      return {
        status: "unconfigured",
        details: { reason: "SIM offers cannot be ticketed against live Travelport" },
      };
    }
    const live = await withCircuitBreaker(
      TRAVELPORT_CIRCUIT_TICKET,
      () => ticketHeldReservationWithTravelport(booking),
      {
        isFailure: (v) => v?.status === "failed",
        onOpen: "return",
        openResult: () => ({
          status: "failed",
          details: { reason: "TRAVELPORT_TICKET circuit open", code: "SUPPLIER_CIRCUIT_OPEN" },
        }),
      },
    );
    if (live.status === "ok" && live.ticketNumbers?.length) {
      return {
        status: "ok",
        externalRef: live.externalRef ?? booking.externalRef,
        ticketNumbers: live.ticketNumbers,
        details: live.details,
      };
    }
    if (live.status === "failed") {
      return { status: "failed", details: live.details };
    }
  }

  return {
    status: "unconfigured",
    details: { capability: getSupplierBookingCapability(code, booking) },
  };
}

export function assertSupplierCanReserve(booking) {
  const cap = getSupplierBookingCapability(booking?.supplierCode, booking);
  if (cap.canReserve) return cap;
  const err = new AppError(
    503,
    `Supplier reservation unavailable: ${cap.reasons.join("; ") || "unconfigured"}`,
  );
  err.code = SUPPLIER_BOOKING_UNCONFIGURED;
  err.details = { capability: cap };
  throw err;
}

export function assertSupplierCanTicket(booking) {
  const cap = getSupplierBookingCapability(booking?.supplierCode, booking);
  if (cap.canTicket) return cap;
  const err = new AppError(
    503,
    `Supplier ticketing unavailable: ${cap.reasons.join("; ") || "unconfigured"}`,
  );
  err.code = SUPPLIER_TICKETING_UNCONFIGURED;
  err.details = { capability: cap };
  throw err;
}

export function assertSupplierRevalidateOrBlock(revalidateResult) {
  if (revalidateResult?.status === "ok" || revalidateResult?.status === "simulated") {
    return revalidateResult;
  }
  const err = new AppError(
    503,
    "Live inventory/fare revalidation is not configured — booking cannot proceed",
  );
  err.code = SUPPLIER_REVALIDATE_UNCONFIGURED;
  err.details = revalidateResult?.details ?? null;
  throw err;
}

export async function retrieveSupplierReservation(locator, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return retrieveTravelportReservation(locator);
  }
  return { status: "unconfigured", details: { reason: `Retrieve not supported for supplier ${code}` } };
}

export async function modifySupplierReservation(locator, modifications, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return modifyTravelportReservation(locator, modifications);
  }
  return { status: "unconfigured", details: { reason: `Modify not supported for supplier ${code}` } };
}

export async function getSupplierSeatMap(params, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return getTravelportSeatMap(params);
  }
  return { status: "unconfigured", details: { reason: `Seat map not supported for supplier ${code}` } };
}

export async function quoteSupplierExchange(params, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return quoteTravelportExchange(params);
  }
  return { status: "unconfigured", details: { reason: `Exchange quote not supported for supplier ${code}` } };
}

export async function reissueSupplierTicket(params, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return reissueTravelportTicket(params);
  }
  return { status: "unconfigured", details: { reason: `Reissue not supported for supplier ${code}` } };
}

export async function voidSupplierTicket(ticketNumber, opts, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return voidTravelportTicket(ticketNumber, opts);
  }
  return { status: "unconfigured", details: { reason: `Void not supported for supplier ${code}` } };
}

export async function quoteSupplierRefund(params, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return quoteTravelportRefund(params);
  }
  return { status: "unconfigured", details: { reason: `Refund quote not supported for supplier ${code}` } };
}

export async function divideSupplierReservation(locator, params, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return divideTravelportReservation(locator, params);
  }
  return { status: "unconfigured", details: { reason: `Divide PNR not supported for supplier ${code}` } };
}

export async function readSupplierQueues(opts, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return readTravelportQueue(opts);
  }
  return { status: "unconfigured", details: { reason: `Queues not supported for supplier ${code}` } };
}

export async function countSupplierQueue(opts, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return countTravelportQueue(opts);
  }
  return { status: "unconfigured", count: 0, details: { reason: `Queues not supported for supplier ${code}` } };
}

export async function cancelSupplierReservation(locator, supplierCode = "GALILEO") {
  const code = String(supplierCode || "").toUpperCase();
  if (code === "GALILEO" || code === "TRAVELPORT") {
    return cancelTravelportReservation(locator);
  }
  return { status: "skipped", reason: `no cancel adapter for supplier ${code}` };
}

