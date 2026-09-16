import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import * as galileoAdapter from "./galileo.adapter.js";
import * as ratehawkAdapter from "./ratehawk.adapter.js";
import * as staysSearch from "./travelport/staysSearch.js";
import { isTravelportConfigured } from "./travelport/config.js";
import { mergeSupplierOffers, withCircuitBreaker } from "./adapter.js";
import { attachAuthoritativeSellPrices } from "../pricing/pricing.service.js";
import { attachSupplierReliability } from "./supplierReliability.js";
import {
  buildSupplierSearchCacheKey,
  withSupplierSearchCache,
} from "./searchCache.js";
import { enqueueSearchEvent } from "../dashboard/dashboard.service.js";

const OFFER_SNAPSHOT_TTL_MS =
  Number(process.env.SUPPLIER_OFFER_SNAPSHOT_TTL_MS) || 12 * 60 * 1000; // 12 min (GDS search cache)

/**
 * Build persisted supplier refs with itinerary/fare separation preserved.
 * @param {import('./adapter.js').SupplierOffer} offer
 */
export function buildSnapshotPayload(offer) {
  const details = offer.details ?? {};
  const fareRules = offer.fareRules ?? {};

  const booking = {
    transactionId: details.transactionId ?? null,
    // CatalogProductOffering id only — never flightRefs[0] (AirPrice/book reject flight ids).
    offeringId: details.offeringId != null && String(details.offeringId).trim()
      ? String(details.offeringId)
      : null,
    productRef: details.productRef ?? null,
    brandRef: fareRules.brandRef ?? null,
    combinabilityCode: details.combinabilityCode ?? null,
    flightRefs: details.flightRefs ?? null,
    returnFlightRefs: details.returnFlightRefs ?? null,
    contentSource: details.contentSource ?? null,
    bookHash: details.bookHash ?? fareRules.bookHash ?? null,
    hid: details.hid ?? null,
  };

  const itinerary = {
    origin: details.origin ?? null,
    destination: details.destination ?? null,
    departureDate: details.departureDate ?? null,
    returnDate: details.returnDate ?? null,
    cabinClass: details.cabinClass ?? null,
    cabin: details.cabin ?? null,
    carrier: details.carrier ?? null,
    carriers: details.carriers ?? null,
    stops: details.stops ?? null,
    returnStops: details.returnStops ?? null,
    durationMinutes: details.durationMinutes ?? null,
    returnDurationMinutes: details.returnDurationMinutes ?? null,
    departTimeLocal: details.departTimeLocal ?? null,
    arriveTimeLocal: details.arriveTimeLocal ?? null,
    flightNumber: details.flightNumber ?? null,
    aircraft: details.aircraft ?? null,
    segments: details.segments ?? null,
    returnSegments: details.returnSegments ?? null,
    paymentTimeLimit: details.paymentTimeLimit ?? null,
    seatsAvailable: details.seatsAvailable ?? null,
    cityCode: details.cityCode ?? null,
    checkInDate: details.checkInDate ?? null,
    checkOutDate: details.checkOutDate ?? null,
  };

  const fare = {
    ...fareRules,
    priceBreakdown: offer.priceBreakdown ?? null,
    bookHash: details.bookHash ?? fareRules.bookHash ?? null,
  };

  return { booking, itinerary, fare };
}

/** Flat booking refs used for AirPrice / revalidation equality checks. */
export function bookingRefsForRevalidation(supplierBookingRefs) {
  if (!supplierBookingRefs || typeof supplierBookingRefs !== "object") return null;
  if (supplierBookingRefs.booking && typeof supplierBookingRefs.booking === "object") {
    return supplierBookingRefs.booking;
  }
  return supplierBookingRefs;
}

/**
 * @param {string} userId
 * @param {import('./adapter.js').SupplierOffer} offer
 */
function assertPersistableOffer(userId, offer) {
  if (!userId || userId === "internal") {
    throw new AppError(400, "Cannot persist supplier offer snapshot without a user scope");
  }
  if (!offer?.offerId || !offer?.supplierCode) {
    throw new AppError(400, "Cannot persist supplier offer snapshot without supplier offer identity");
  }
  if (!Number.isInteger(offer.amountMinor) || offer.amountMinor <= 0) {
    throw new AppError(400, "Cannot persist supplier offer snapshot without a positive net fare");
  }
}

/**
 * @param {string} userId
 * @param {import('./adapter.js').SupplierOffer} offer
 * @param {number} ttlMs
 * @param {Date} expiresAt
 */
function snapshotCreateData(userId, offer, ttlMs, expiresAt) {
  return {
    userId,
    supplierCode: offer.supplierCode,
    supplierOfferId: offer.offerId,
    product: offer.product === "HOTEL" ? "HOTEL" : "FLIGHT",
    currency: offer.currency,
    netMinor: offer.amountMinor,
    supplierBookingRefs: buildSnapshotPayload(offer),
    ttlMs,
    expiresAt,
  };
}

/**
 * Persist a supplier offer snapshot so the booking engine can reference it
 * at quote time without trusting the client for fare data.
 *
 * @param {{ userId: string, offer: import('./adapter.js').SupplierOffer }} params
 * @returns {Promise<import('@prisma/client').SupplierOfferSnapshot>}
 */
export async function persistOfferSnapshot({ userId, offer }) {
  assertPersistableOffer(userId, offer);
  const ttlMs = OFFER_SNAPSHOT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);
  return prisma.supplierOfferSnapshot.create({
    data: snapshotCreateData(userId, offer, ttlMs, expiresAt),
  });
}

/**
 * Batch-persist offer snapshots (one round-trip). Order matches input offers.
 *
 * @param {{ userId: string, offers: import('./adapter.js').SupplierOffer[] }} params
 * @returns {Promise<import('@prisma/client').SupplierOfferSnapshot[]>}
 */
export async function persistOfferSnapshots({ userId, offers }) {
  if (!Array.isArray(offers) || offers.length === 0) return [];
  for (const offer of offers) assertPersistableOffer(userId, offer);

  const ttlMs = OFFER_SNAPSHOT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);
  const data = offers.map((offer) => snapshotCreateData(userId, offer, ttlMs, expiresAt));

  return prisma.supplierOfferSnapshot.createManyAndReturn({ data });
}

/**
 * Attach persisted snapshot metadata to a supplier offer for the booking flow.
 * @param {import('./adapter.js').SupplierOffer} offer
 * @param {import('@prisma/client').SupplierOfferSnapshot} snapshot
 */
export function enrichOfferWithSnapshot(offer, snapshot) {
  const payload = snapshot.supplierBookingRefs ?? {};
  return {
    ...offer,
    supplierOfferSnapshotId: snapshot.id,
    snapshotId: snapshot.id,
    snapshotExpiresAt: snapshot.expiresAt.toISOString(),
    snapshotTtlMs: snapshot.ttlMs,
    supplierBookingRefs: payload,
    itinerarySnapshot: payload.itinerary ?? null,
    fareRulesSnapshot: payload.fare ?? null,
  };
}

function instrumentSearch({ userId, product, offers }) {
  const primary = offers[0]?.supplierCode || (product === "FLIGHT" ? "GALILEO" : "RATEHAWK");
  enqueueSearchEvent({
    userId: userId || null,
    product,
    supplierCode: primary,
    resultCount: offers.length,
    success: offers.length > 0,
    errorCode: offers.length ? null : "NO_RESULTS",
  });
}

/**
 * Raw GDS/hotel adapter search — short-TTL + single-flight cached by product+query.
 * Snapshot persistence / pricing / dashboard events stay outside the cache so
 * authenticated requests still get fresh snapshot ids.
 */
async function searchSupplierOffers(product, query) {
  const cacheKey = buildSupplierSearchCacheKey(product, query);
  return withSupplierSearchCache(cacheKey, async () => {
    if (product === "FLIGHT") {
      const debug =
        process.env.NODE_ENV !== "production" || process.env.FLIGHT_SEARCH_DEBUG === "true";
      if (debug) {
        console.info("[flight-search] travelport request", {
          product,
          origin: query.origin,
          destination: query.destination,
          departureDate: query.departureDate,
          returnDate: query.returnDate ?? null,
          passengers: query.passengers ?? 1,
          cabinClass: query.cabinClass ?? "ECONOMY",
          preferredCarriers: query.preferredCarriers ?? null,
          cacheKey,
        });
      }
      const started = Date.now();
      const galileo = await withCircuitBreaker("GALILEO", () =>
        galileoAdapter.searchFlights(query),
      ).catch((err) => {
        console.error("[flight-search] Galileo adapter failed", err?.message || err);
        return [];
      });
      const offers = mergeSupplierOffers([galileo]);
      if (debug) {
        console.info(
          `[flight-search] travelport response: ${offers.length} offers (${Date.now() - started}ms)`,
        );
      }
      return offers;
    }

    if (product === "HOTEL") {
      const hotelBatches = [];
      const rh = await withCircuitBreaker("RATEHAWK", () =>
        ratehawkAdapter.searchHotels(query),
      ).catch((err) => {
        console.error("[hotel-search] RateHawk adapter failed", err?.message || err);
        return [];
      });
      hotelBatches.push(rh);
      if (isTravelportConfigured()) {
        const stays = await withCircuitBreaker("TRAVELPORT_STAYS", () =>
          staysSearch.searchHotels(query),
        ).catch((err) => {
          console.error("[hotel-search] Travelport Stays failed", err?.message || err);
          return [];
        });
        hotelBatches.push(stays);
      }
      return mergeSupplierOffers(hotelBatches);
    }

    throw new AppError(400, `Unsupported product: ${product}`);
  });
}

/**
 * Route a validated search request to the right adapter. When `userId` is
 * provided, real supplier offers are persisted as user-scoped snapshots and
 * returned with `supplierOfferSnapshotId` for the booking quote flow.
 */
export async function search({ product, query, userId }) {
  let offers = await searchSupplierOffers(product, query);

  // Real fulfillment history only — omit when sample is thin (never invent %).
  offers = await attachSupplierReliability(offers);

  // Funnel instrumentation — never on the critical path (buffered createMany).
  instrumentSearch({ userId, product, offers });

  if (!userId) {
    // Still attach sell prices for anonymous search display (net stays amountMinor).
    return attachAuthoritativeSellPrices(offers);
  }

  const snapshots = await persistOfferSnapshots({ userId, offers });
  /** @type {import('./adapter.js').SupplierOffer[]} */
  const enriched = offers.map((offer, i) => enrichOfferWithSnapshot(offer, snapshots[i]));
  return attachAuthoritativeSellPrices(enriched);
}
