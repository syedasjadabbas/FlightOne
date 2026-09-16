/**
 * Pure travel-history pattern helpers (no DB).
 * Used by history.service.js and Ava personalization soft context.
 */

const IATA3 = /^[A-Z]{3}$/;
const AIRLINE = /^[A-Z0-9]{2,3}$/;
const CABINS = new Set(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]);

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function pickString(obj, keys) {
  if (!obj) return null;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizeIata(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return IATA3.test(c) ? c : null;
}

function normalizeAirline(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return AIRLINE.test(c) ? c : null;
}

function normalizeCabin(raw) {
  if (!raw) return null;
  const c = String(raw).trim().toUpperCase().replace(/\s+/g, "_");
  return CABINS.has(c) ? c : null;
}

/**
 * Best-effort extract of route/airline/cabin from Booking.metadata shapes
 * used by Module 03 (origin/destination, nested offer, pricing.input, etc.).
 */
export function extractBookingTripSignals(booking) {
  const meta = asObject(booking?.metadata) || {};
  const pricingInput = asObject(meta.pricing?.input) || {};
  const offer = asObject(meta.offer) || asObject(meta.flight) || {};
  const itinerary = asObject(meta.itinerary) || {};

  const origin =
    normalizeIata(
      pickString(meta, ["origin", "originCode", "from", "fromCode"]) ||
        pickString(pricingInput, ["origin", "originCode"]) ||
        pickString(offer, ["origin", "originCode"]) ||
        pickString(itinerary, ["origin", "originCode"]),
    ) || null;

  const destination =
    normalizeIata(
      pickString(meta, ["destination", "destinationCode", "to", "toCode"]) ||
        pickString(pricingInput, ["destination", "destinationCode"]) ||
        pickString(offer, ["destination", "destinationCode"]) ||
        pickString(itinerary, ["destination", "destinationCode"]),
    ) || null;

  const airline =
    normalizeAirline(
      pickString(meta, ["airline", "airlineCode", "carrier", "marketingCarrier"]) ||
        pickString(pricingInput, ["airline", "airlineCode", "carrier"]) ||
        pickString(offer, ["airline", "airlineCode", "carrier"]),
    ) || null;

  const cabin =
    normalizeCabin(
      pickString(meta, ["cabin", "cabinClass", "preferredCabin"]) ||
        pickString(pricingInput, ["cabin", "cabinClass"]) ||
        pickString(offer, ["cabin", "cabinClass"]),
    ) || null;

  const route = origin && destination ? `${origin}-${destination}` : null;

  return {
    product: booking?.product || null,
    status: booking?.status || null,
    origin,
    destination,
    route,
    airline,
    cabin,
  };
}

function topCounted(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/**
 * Aggregate soft trip patterns for Ava — never invents missing route facts.
 */
export function buildTravelHistoryPatterns(bookings, { routeLimit = 5, airlineLimit = 5 } = {}) {
  const routeCounts = new Map();
  const airlineCounts = new Map();
  const cabinCounts = new Map();
  const productCounts = new Map();
  const recentTrips = [];

  for (const booking of bookings || []) {
    const signal = extractBookingTripSignals(booking);
    if (signal.product) {
      productCounts.set(signal.product, (productCounts.get(signal.product) || 0) + 1);
    }
    if (signal.route) {
      routeCounts.set(signal.route, (routeCounts.get(signal.route) || 0) + 1);
    }
    if (signal.airline) {
      airlineCounts.set(signal.airline, (airlineCounts.get(signal.airline) || 0) + 1);
    }
    if (signal.cabin) {
      cabinCounts.set(signal.cabin, (cabinCounts.get(signal.cabin) || 0) + 1);
    }
    if (signal.route || signal.airline) {
      recentTrips.push({
        product: signal.product,
        route: signal.route,
        airline: signal.airline,
        cabin: signal.cabin,
        status: signal.status,
      });
    }
  }

  return {
    frequentRoutes: topCounted(routeCounts, routeLimit).map((x) => x.value),
    frequentAirlines: topCounted(airlineCounts, airlineLimit).map((x) => x.value),
    frequentCabins: topCounted(cabinCounts, 3).map((x) => x.value),
    productMix: topCounted(productCounts, 5).map((x) => x.value),
    recentTrips: recentTrips.slice(0, 5),
  };
}
