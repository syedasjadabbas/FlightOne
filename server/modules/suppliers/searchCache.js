/**
 * Short-TTL + single-flight cache for supplier GDS searches.
 *
 * Multi-city / open-jaw Ava queries fan out duplicate OD/date (+ carrier-probe)
 * HTTP calls within the same second. Without coalescing, each becomes a
 * Travelport CatalogSearch. Cache key MUST include every query field that
 * changes GDS results — see buildSupplierSearchCacheKey.
 *
 * Expected impact (sample open-jaw: LHE/ISB → LON 2n → SFO 15d → MCO return):
 *   Before: ~40–100+ outbound Travelport CatalogSearch calls (duplicate OD/date
 *           + discovery probes + alt-airport pairs across dual origins).
 *   After:  identical product+query keys collapse to 1 Travelport call per TTL
 *           window (~8s); expect ~50–70% fewer outbound GDS calls for that shape.
 */
import { withCache, clearSwrCache, invalidateSwrCache } from "../../lib/swr-cache.js";

/** Default 8s — long enough to collapse one chat turn's fan-out, short for fare freshness. */
export const SUPPLIER_SEARCH_CACHE_TTL_MS =
  Number(process.env.SUPPLIER_SEARCH_CACHE_TTL_MS) || 8_000;

/** Cap concurrent Travelport CatalogSearch executions per process. */
export const SUPPLIER_SEARCH_MAX_CONCURRENCY =
  Number(process.env.SUPPLIER_SEARCH_MAX_CONCURRENCY) || 4;

let activeSearches = 0;
/** @type {Array<() => void>} */
const waitQueue = [];

/**
 * Stable cache key for product + flight/hotel query.
 * Preferred carriers are sorted so ["QR","EK"] and ["EK","QR"] share one entry.
 *
 * @param {"FLIGHT"|"HOTEL"} product
 * @param {Record<string, unknown>} query
 * @returns {string}
 */
export function buildSupplierSearchCacheKey(product, query = {}) {
  const q = query && typeof query === "object" ? query : {};
  const carriers = Array.isArray(q.preferredCarriers)
    ? [...q.preferredCarriers]
        .map((c) => String(c || "").trim().toUpperCase())
        .filter(Boolean)
        .sort()
    : [];

  if (product === "HOTEL") {
    return JSON.stringify({
      product: "HOTEL",
      cityCode: String(q.cityCode || "").toUpperCase(),
      regionId: q.regionId ?? null,
      checkInDate: q.checkInDate ?? null,
      checkOutDate: q.checkOutDate ?? null,
      rooms: q.rooms ?? 1,
      guests: q.guests ?? 1,
      hotelName: q.hotelName ?? null,
      requestedCurrency: q.requestedCurrency
        ? String(q.requestedCurrency).toUpperCase()
        : null,
    });
  }

  return JSON.stringify({
    product: "FLIGHT",
    origin: String(q.origin || "").toUpperCase(),
    destination: String(q.destination || "").toUpperCase(),
    departureDate: q.departureDate ?? null,
    returnDate: q.returnDate ?? null,
    passengers: q.passengers ?? 1,
    cabinClass: String(q.cabinClass || "ECONOMY").toUpperCase(),
    preferredCarriers: carriers,
    carrierPreferenceType: carriers.length
      ? String(q.carrierPreferenceType || "Permitted")
      : null,
    requestedCurrency: q.requestedCurrency
      ? String(q.requestedCurrency).toUpperCase()
      : null,
  });
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withSupplierSearchConcurrency(fn) {
  const max = Math.max(1, SUPPLIER_SEARCH_MAX_CONCURRENCY);
  if (activeSearches >= max) {
    await new Promise((resolve) => {
      waitQueue.push(resolve);
    });
  }
  activeSearches += 1;
  try {
    return await fn();
  } finally {
    activeSearches -= 1;
    const next = waitQueue.shift();
    if (next) next();
  }
}

/**
 * Coalesce + short-TTL memoize a supplier search compute.
 * @template T
 * @param {string} cacheKey
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withSupplierSearchCache(cacheKey, fn) {
  return withCache(
    `supplier-search:${cacheKey}`,
    SUPPLIER_SEARCH_CACHE_TTL_MS,
    () => withSupplierSearchConcurrency(fn),
  );
}

/** Test helper — drop all SWR entries (including supplier-search:*). */
export function clearSupplierSearchCacheForTests() {
  clearSwrCache();
  activeSearches = 0;
  waitQueue.length = 0;
}

export function invalidateSupplierSearchCacheKey(cacheKey) {
  invalidateSwrCache(`supplier-search:${cacheKey}`);
}
