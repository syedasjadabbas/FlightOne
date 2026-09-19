/**
 * Phase 3 carbon reporting — flight/hotel estimates with documented factors.
 * Never invents grams when origin/destination, distance, or nights are missing.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { extractBookingTripSignals } from "../profile/historyPatterns.js";
import { requireCompanyMembership } from "./corporate.service.js";

export const CARBON_METHOD_CODE = "FO_FACTORS_V1";
export const CARBON_METHOD_VERSION = "1.0";
export const CARBON_METHOD_NOTE =
  "Illustrative FlightOne factor table FO_FACTORS_V1 — not a certified life-cycle assessment. Flight: 115 g CO₂e per passenger-km (great-circle). Hotel: 20_000 g CO₂e per room-night.";

/** g CO₂e per passenger-km */
export const FLIGHT_GRAMS_PER_KM = 115;
/** g CO₂e per hotel room-night */
export const HOTEL_GRAMS_PER_NIGHT = 20_000;

/** Published airport coordinates used only when both ends of a route are known. */
export const AIRPORT_COORDS = Object.freeze({
  LHE: { lat: 31.5216, lon: 74.4036 },
  DXB: { lat: 25.2532, lon: 55.3657 },
  KHI: { lat: 24.9065, lon: 67.1608 },
  ISB: { lat: 33.5607, lon: 72.8516 },
  JED: { lat: 21.6796, lon: 39.1565 },
  LHR: { lat: 51.47, lon: -0.4543 },
  LGW: { lat: 51.1537, lon: -0.1821 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  AUH: { lat: 24.433, lon: 54.6511 },
  DOH: { lat: 25.2731, lon: 51.6081 },
});

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function extractNights(booking) {
  const meta = asObject(booking?.metadata) || {};
  if (Number.isInteger(meta.nights) && meta.nights > 0) return meta.nights;
  const checkIn = meta.checkIn || meta.checkInDate || meta.arrivalDate;
  const checkOut = meta.checkOut || meta.checkOutDate || meta.departureDate;
  if (checkIn && checkOut) {
    const a = new Date(`${String(checkIn).slice(0, 10)}T00:00:00.000Z`);
    const b = new Date(`${String(checkOut).slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      const days = Math.round((b.getTime() - a.getTime()) / 86400000);
      if (days > 0) return days;
    }
  }
  return null;
}

export function estimateBookingCarbon(booking) {
  const product = booking?.product;
  const method = {
    code: CARBON_METHOD_CODE,
    version: CARBON_METHOD_VERSION,
    note: CARBON_METHOD_NOTE,
  };

  if (product === "FLIGHT") {
    const signal = extractBookingTripSignals(booking);
    const origin = signal.origin;
    const destination = signal.destination;
    if (!origin || !destination) {
      return {
        product,
        status: "INSUFFICIENT_DATA",
        gramsCo2e: null,
        method,
        inputs: { origin, destination },
        reason: "Flight origin and destination are not available on this booking, so CO₂ is not estimated.",
      };
    }
    const from = AIRPORT_COORDS[origin];
    const to = AIRPORT_COORDS[destination];
    if (!from || !to) {
      return {
        product,
        status: "INSUFFICIENT_DATA",
        gramsCo2e: null,
        method,
        inputs: { origin, destination, airportLookup: false },
        reason: `No published coordinates for ${!from ? origin : destination} in FO_FACTORS_V1, so distance (and CO₂) is not estimated.`,
      };
    }
    const distanceKm = haversineKm(from, to);
    const gramsCo2e = Math.round(distanceKm * FLIGHT_GRAMS_PER_KM);
    return {
      product,
      status: "AVAILABLE",
      gramsCo2e,
      method,
      inputs: { origin, destination, distanceKm, gramsPerKm: FLIGHT_GRAMS_PER_KM },
      reason: null,
    };
  }

  if (product === "HOTEL") {
    const nights = extractNights(booking);
    if (!nights) {
      return {
        product,
        status: "INSUFFICIENT_DATA",
        gramsCo2e: null,
        method,
        inputs: { nights: null },
        reason: "Hotel night count is not available on this booking, so CO₂ is not estimated.",
      };
    }
    return {
      product,
      status: "AVAILABLE",
      gramsCo2e: nights * HOTEL_GRAMS_PER_NIGHT,
      method,
      inputs: { nights, gramsPerNight: HOTEL_GRAMS_PER_NIGHT },
      reason: null,
    };
  }

  return {
    product: product || null,
    status: "INSUFFICIENT_DATA",
    gramsCo2e: null,
    method,
    inputs: {},
    reason: "This booking product is not included in FO_FACTORS_V1 carbon estimates.",
  };
}

async function persistEstimate(companyId, booking) {
  const calc = estimateBookingCarbon(booking);
  return prisma.carbonEstimate.upsert({
    where: { bookingId: booking.id },
    create: {
      companyId,
      bookingId: booking.id,
      product: calc.product || booking.product || "UNKNOWN",
      status: calc.status,
      gramsCo2e: calc.gramsCo2e,
      methodCode: calc.method.code,
      methodVersion: calc.method.version,
      inputs: calc.inputs,
      reason: calc.reason,
    },
    update: {
      product: calc.product || booking.product || "UNKNOWN",
      status: calc.status,
      gramsCo2e: calc.gramsCo2e,
      methodCode: calc.method.code,
      methodVersion: calc.method.version,
      inputs: calc.inputs,
      reason: calc.reason,
      calculatedAt: new Date(),
    },
  });
}

function inPeriod(date, from, to) {
  if (!date) return true;
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59.999Z`).getTime()) return false;
  return true;
}

export async function getCarbonDashboard(userId, companyId, { from, to } = {}) {
  await requireCompanyMembership(userId, companyId);
  const bookings = await prisma.booking.findMany({
    where: {
      metadata: { path: ["companyId"], equals: companyId },
      status: { in: ["TICKETED", "ACTIVE", "COMPLETED", "RESERVED"] },
    },
    select: {
      id: true,
      product: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
    take: 400,
  });
  const inRange = bookings.filter((b) => inPeriod(b.createdAt, from, to));
  const estimates = [];
  for (const booking of inRange) {
    estimates.push(await persistEstimate(companyId, booking));
  }

  const available = estimates.filter((e) => e.status === "AVAILABLE" && Number.isInteger(e.gramsCo2e));
  const flight = available.filter((e) => e.product === "FLIGHT");
  const hotel = available.filter((e) => e.product === "HOTEL");
  const sum = (rows) => rows.reduce((acc, r) => acc + (r.gramsCo2e || 0), 0);

  await writeAudit({
    userId,
    action: "corporate.carbon.dashboard",
    resourceType: "CarbonEstimate",
    resourceId: companyId,
    metadata: { companyId, count: estimates.length, from: from || null, to: to || null },
  }).catch(() => {});

  return {
    companyId,
    period: { from: from || null, to: to || null },
    method: {
      code: CARBON_METHOD_CODE,
      version: CARBON_METHOD_VERSION,
      note: CARBON_METHOD_NOTE,
    },
    totals: {
      gramsCo2e: sum(available),
      flightGramsCo2e: sum(flight),
      hotelGramsCo2e: sum(hotel),
      bookingCount: inRange.length,
      estimatedCount: available.length,
      insufficientCount: estimates.filter((e) => e.status === "INSUFFICIENT_DATA").length,
    },
    breakdown: estimates.map((e) => ({
      bookingId: e.bookingId,
      product: e.product,
      status: e.status,
      gramsCo2e: e.gramsCo2e,
      reason: e.reason,
      inputs: e.inputs,
      methodCode: e.methodCode,
      methodVersion: e.methodVersion,
      calculatedAt: e.calculatedAt,
    })),
  };
}

export async function getCarbonNudges(userId, companyId) {
  await requireCompanyMembership(userId, companyId);
  const dash = await getCarbonDashboard(userId, companyId, {});
  const nudges = [];

  if (!dash.totals.bookingCount) {
    return {
      items: [],
      emptyReason: "Not enough verified company bookings to produce carbon policy nudges.",
    };
  }

  const routeCounts = new Map();
  for (const row of dash.breakdown) {
    if (row.product !== "FLIGHT" || row.status !== "AVAILABLE") continue;
    const origin = row.inputs?.origin;
    const dest = row.inputs?.destination;
    if (!origin || !dest) continue;
    const key = `${origin}-${dest}`;
    const prev = routeCounts.get(key) || { count: 0, grams: 0, origin, dest };
    prev.count += 1;
    prev.grams += row.gramsCo2e || 0;
    routeCounts.set(key, prev);
  }

  for (const row of routeCounts.values()) {
    if (row.count >= 3) {
      nudges.push({
        kind: "REPEATED_HIGH_ROUTE",
        title: `Frequent ${row.origin} → ${row.destination} travel`,
        body: `This route appears ${row.count} times in verified company bookings. Compare lower-emission options before the next booking — FlightOne will not change existing trips.`,
        gramsCo2e: row.grams,
        source: "verified_booking_estimates",
      });
    }
  }

  if (dash.totals.insufficientCount > 0 && dash.totals.estimatedCount === 0) {
    nudges.push({
      kind: "INSUFFICIENT_DATA",
      title: "Carbon data is incomplete",
      body: "Company bookings exist, but origin/destination or hotel nights are missing, so FO_FACTORS_V1 cannot estimate CO₂. FlightOne will not invent emissions.",
      source: "methodology",
    });
  } else if (dash.totals.flightGramsCo2e > 0) {
    nudges.push({
      kind: "METHOD_NOTE",
      title: "Estimates use FO_FACTORS_V1",
      body: CARBON_METHOD_NOTE,
      source: "methodology",
    });
  }

  return { items: nudges.slice(0, 5), emptyReason: nudges.length ? null : null };
}
