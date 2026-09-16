/**
 * Supplier reliability from real Booking fulfillment history.
 *
 * fulfillmentRate = ticketed/active/completed bookings / all bookings for that
 * supplierCode. Published only when sample size meets MIN_BOOKINGS — never invent
 * a default percentage for thin or missing history.
 *
 * Results are cached briefly — fulfillment rates change slowly and every search
 * used to hit Booking.groupBy.
 */
import prisma from "../../config/prisma.js";
import { withCache, invalidateSwrCache } from "../../lib/swr-cache.js";

const REVENUE_STATUSES = ["TICKETED", "ACTIVE", "COMPLETED"];

/** Minimum bookings before a fulfillment rate is treated as trustworthy. */
export const MIN_RELIABILITY_BOOKINGS = 5;

const RELIABILITY_CACHE_TTL_MS =
  Number(process.env.SUPPLIER_RELIABILITY_CACHE_TTL_MS) || 60_000;

/**
 * Pure aggregation used by loadSupplierFulfillmentRates (and unit tests).
 * @param {Array<{ supplierCode: string | null, status: string, _count: { _all: number } }>} rows
 * @param {{ minBookings?: number }} [opts]
 * @returns {Map<string, { bookings: number, fulfillmentRate: number, reliabilityPct: number }>}
 */
export function fulfillmentRatesFromRows(rows, opts = {}) {
  const minBookings = opts.minBookings ?? MIN_RELIABILITY_BOOKINGS;
  /** @type {Map<string, { bookings: number, fulfilled: number }>} */
  const agg = new Map();
  for (const row of rows || []) {
    const code = (row.supplierCode || "").toUpperCase();
    if (!code) continue;
    if (!agg.has(code)) agg.set(code, { bookings: 0, fulfilled: 0 });
    const entry = agg.get(code);
    entry.bookings += row._count._all;
    if (REVENUE_STATUSES.includes(row.status)) {
      entry.fulfilled += row._count._all;
    }
  }

  /** @type {Map<string, { bookings: number, fulfillmentRate: number, reliabilityPct: number }>} */
  const out = new Map();
  for (const [code, entry] of agg) {
    if (entry.bookings < minBookings) continue;
    const fulfillmentRate = entry.fulfilled / entry.bookings;
    out.set(code, {
      bookings: entry.bookings,
      fulfillmentRate,
      reliabilityPct: Math.round(fulfillmentRate * 100),
    });
  }
  return out;
}

/**
 * One groupBy for the requested supplier codes (no per-offer queries).
 * Cached — safe because rates are coarse historical signals, not quote-critical.
 * @param {string[]} supplierCodes
 * @returns {Promise<Map<string, { bookings: number, fulfillmentRate: number, reliabilityPct: number }>>}
 */
export async function loadSupplierFulfillmentRates(supplierCodes) {
  const codes = [
    ...new Set(
      (supplierCodes || [])
        .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
        .filter(Boolean),
    ),
  ].sort();
  if (!codes.length) return new Map();

  const cacheKey = `supplier-reliability:${codes.join(",")}`;
  return withCache(cacheKey, RELIABILITY_CACHE_TTL_MS, async () => {
    const rows = await prisma.booking.groupBy({
      by: ["supplierCode", "status"],
      where: { supplierCode: { in: codes } },
      _count: { _all: true },
    });
    return fulfillmentRatesFromRows(rows);
  });
}

/** Test / admin escape hatch — drops a specific codeset or nothing (use clearSwrCache). */
export function invalidateSupplierReliabilityCache(supplierCodes = []) {
  const codes = [
    ...new Set(
      (supplierCodes || [])
        .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
        .filter(Boolean),
    ),
  ].sort();
  if (!codes.length) return;
  invalidateSwrCache(`supplier-reliability:${codes.join(",")}`);
}

/**
 * Attach supplierReliability (0–100) when historical fulfillment is available.
 * Offers without enough history omit the field (unavailable — not a fake default).
 * @template {{ supplierCode?: string, supplierReliability?: number }} T
 * @param {T[]} offers
 * @param {Map<string, { reliabilityPct: number }> | null} [preloaded]
 * @returns {Promise<T[]>}
 */
export async function attachSupplierReliability(offers, preloaded = null) {
  if (!Array.isArray(offers) || offers.length === 0) return offers || [];

  let rates = preloaded;
  if (!rates) {
    const codes = offers.map((o) => o.supplierCode).filter(Boolean);
    try {
      rates = await loadSupplierFulfillmentRates(codes);
    } catch (err) {
      console.error(
        "[supplier-reliability] fulfillment lookup failed — leaving signals unavailable",
        err?.message || err,
      );
      return offers;
    }
  }

  if (!rates.size) {
    return offers.map((offer) => {
      if (offer.supplierReliability == null) return offer;
      const { supplierReliability: _drop, ...rest } = offer;
      return /** @type {T} */ (rest);
    });
  }

  return offers.map((offer) => {
    const code = typeof offer.supplierCode === "string" ? offer.supplierCode.toUpperCase() : "";
    const hit = code ? rates.get(code) : null;
    if (!hit) {
      if (offer.supplierReliability == null) return offer;
      const { supplierReliability: _drop, ...rest } = offer;
      return /** @type {T} */ (rest);
    }
    return { ...offer, supplierReliability: hit.reliabilityPct };
  });
}
