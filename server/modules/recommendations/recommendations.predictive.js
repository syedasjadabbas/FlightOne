/**
 * Phase 3 predictive recommendations — grounded in this traveller's verified
 * bookings, offer snapshots, journey watches, and preferences only.
 * Never invents calendar events, fares, or another traveller's history.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { extractBookingTripSignals } from "../profile/historyPatterns.js";
import { listCalendarEventsForUser } from "./recommendations.calendar.js";
import { computeFareInsight, daysUntilIsoDate } from "./recommendations.fare.js";

export const PREDICTIVE_OFFER_PREFIX = "predictive:";

const IATA3 = /^[A-Z]{3}$/;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeIata(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return IATA3.test(c) ? c : null;
}

function fingerprint(kind, key) {
  return `${PREDICTIVE_OFFER_PREFIX}${kind}:${key}`;
}

function isoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function extractDepartAt(booking) {
  const meta = asObject(booking?.metadata) || {};
  const pricingInput = asObject(meta.pricing?.input) || {};
  const itinerary = asObject(meta.itinerary) || {};
  const raw =
    meta.departAt ||
    meta.departureDate ||
    pricingInput.departureDate ||
    pricingInput.departAt ||
    itinerary.departAt ||
    itinerary.departureDate ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function snapshotRoute(snapshot) {
  const refs = asObject(snapshot?.supplierBookingRefs);
  const itinerary = asObject(refs?.itinerary) || asObject(refs);
  const origin = normalizeIata(itinerary?.origin);
  const destination = normalizeIata(itinerary?.destination);
  if (!origin || !destination || origin === destination) return null;
  return {
    origin,
    destination,
    route: `${origin}-${destination}`,
    departureDate: isoDate(itinerary?.departureDate) || isoDate(itinerary?.departAt),
    amountMinor: snapshot.netMinor,
    currency: snapshot.currency,
    createdAt: snapshot.createdAt,
  };
}

export function buildPredictiveItems({
  bookings = [],
  snapshots = [],
  watches = [],
  calendar = { configured: false, events: [] },
  preferences = {},
  dismissed = new Set(),
  now = new Date(),
} = {}) {
  const items = [];

  const routeBookings = [];
  for (const booking of bookings) {
    const signal = extractBookingTripSignals(booking);
    if (!signal.route) continue;
    const departAt = extractDepartAt(booking);
    routeBookings.push({
      ...signal,
      departAt,
      status: booking.status,
      createdAt: booking.createdAt,
    });
  }

  const routeCounts = new Map();
  for (const row of routeBookings) {
    routeCounts.set(row.route, (routeCounts.get(row.route) || 0) + 1);
  }

  for (const [route, count] of routeCounts.entries()) {
    if (count < 1) continue;
    const [origin, destination] = route.split("-");
    const fp = fingerprint("ROUTE_PATTERN", route);
    if (dismissed.has(fp)) continue;
    const sample = routeBookings.find((r) => r.route === route);
    items.push({
      id: fp,
      kind: "ROUTE_PATTERN",
      title: `Check ${origin} → ${destination}`,
      reason:
        count > 1
          ? `Based on your previous trips, you have booked ${origin} → ${destination} more than once.`
          : `Based on your previous trips, ${origin} → ${destination} may be worth checking again.`,
      hedge: "You may be planning another trip on this route — this is an inference, not a certainty.",
      origin,
      destination,
      searchPrompt: `Find flights from ${origin} to ${destination}`,
      confidence: count >= 3 ? "MEDIUM" : "LOW",
      sources: [{ type: "booking_history", count, route }],
      cabinHint: preferences.preferredCabin || sample?.cabin || null,
    });
  }

  const thisMonth = now.getUTCMonth();
  const thisYear = now.getUTCFullYear();
  const seasonalSeen = new Set();
  for (const row of routeBookings) {
    if (!row.departAt || !row.destination) continue;
    if (row.departAt.getUTCFullYear() >= thisYear) continue;
    if (row.departAt.getUTCMonth() !== thisMonth) continue;
    const key = row.route;
    if (seasonalSeen.has(key)) continue;
    seasonalSeen.add(key);
    const fp = fingerprint("SEASONAL_TRIP", key);
    if (dismissed.has(fp)) continue;
    const year = row.departAt.getUTCFullYear();
    items.push({
      id: fp,
      kind: "SEASONAL_TRIP",
      title: `You may be planning ${row.origin} → ${row.destination}`,
      reason: `You travelled to ${row.destination} around this time in ${year}.`,
      hedge: "That pattern may not apply this year — treat it as a reminder, not a plan.",
      origin: row.origin,
      destination: row.destination,
      searchPrompt: `Find flights from ${row.origin} to ${row.destination}`,
      confidence: "LOW",
      sources: [{ type: "booking_depart_date", year, route: key }],
    });
  }

  const searchCounts = new Map();
  for (const snap of snapshots) {
    const route = snapshotRoute(snap);
    if (!route) continue;
    const prev = searchCounts.get(route.route) || { count: 0, ...route };
    prev.count += 1;
    searchCounts.set(route.route, prev);
  }
  for (const row of searchCounts.values()) {
    if (row.count < 3) continue;
    const fp = fingerprint("SEARCH_PATTERN", row.route);
    if (dismissed.has(fp)) continue;
    if (items.some((i) => i.origin === row.origin && i.destination === row.destination)) continue;
    items.push({
      id: fp,
      kind: "SEARCH_PATTERN",
      title: `Continue ${row.origin} → ${row.destination}`,
      reason: `You frequently search for ${row.origin} → ${row.destination}.`,
      hedge: "Repeated searches suggest interest — not a confirmed trip.",
      origin: row.origin,
      destination: row.destination,
      searchPrompt: `Find flights from ${row.origin} to ${row.destination}`,
      confidence: "MEDIUM",
      sources: [{ type: "search_snapshots", count: row.count, route: row.route }],
    });
  }

  for (const watch of watches) {
    const meta = asObject(watch.metadata) || {};
    const origin = normalizeIata(meta.origin);
    const destination = normalizeIata(meta.destination);
    const depart = isoDate(watch.departAt);
    if (!origin || !destination) continue;
    const fp = fingerprint("UPCOMING_JOURNEY", watch.id);
    if (dismissed.has(fp)) continue;
    items.push({
      id: fp,
      kind: "UPCOMING_JOURNEY",
      title: `Upcoming ${origin} → ${destination}`,
      reason: depart
        ? `You have an upcoming monitored journey ${origin} → ${destination} on ${depart}.`
        : `You have an upcoming monitored journey ${origin} → ${destination}.`,
      hedge: "This uses your FlightOne journey watch — live status is only shown when a provider verifies it.",
      origin,
      destination,
      searchPrompt: `Show options related to my ${origin} to ${destination} trip`,
      confidence: "HIGH",
      sources: [{ type: "journey_watch", watchId: watch.id }],
    });
  }

  if (calendar?.configured && Array.isArray(calendar.events)) {
    for (const event of calendar.events.slice(0, 5)) {
      const origin = normalizeIata(event.origin);
      const destination = normalizeIata(event.destination);
      if (!destination) continue;
      const fp = fingerprint("CALENDAR_EVENT", event.id || destination);
      if (dismissed.has(fp)) continue;
      items.push({
        id: fp,
        kind: "CALENDAR_EVENT",
        title: origin ? `Calendar trip ${origin} → ${destination}` : `Calendar event in ${destination}`,
        reason: `You have an upcoming calendar event in ${destination}.`,
        hedge: "Calendar-derived only — confirm the trip details before searching.",
        origin,
        destination,
        searchPrompt: origin
          ? `Find flights from ${origin} to ${destination}`
          : `Find flights to ${destination}`,
        confidence: "MEDIUM",
        sources: [{ type: "calendar", eventId: event.id || null }],
      });
    }
  }

  return items.slice(0, 8);
}

export async function getPredictivePreferences(userId) {
  if (!userId) throw new AppError(401, "Authentication required");
  const row = await prisma.predictivePreference.findUnique({
    where: { userId },
    select: {
      userId: true,
      proactiveEnabled: true,
      notifyApp: true,
      notifyEmail: true,
      updatedAt: true,
    },
  });
  return (
    row || {
      userId,
      proactiveEnabled: true,
      notifyApp: true,
      notifyEmail: false,
      updatedAt: null,
    }
  );
}

export async function updatePredictivePreferences(userId, body) {
  const current = await getPredictivePreferences(userId);
  const data = {
    proactiveEnabled:
      body.proactiveEnabled != null ? Boolean(body.proactiveEnabled) : current.proactiveEnabled,
    notifyApp: body.notifyApp != null ? Boolean(body.notifyApp) : current.notifyApp,
    notifyEmail: body.notifyEmail != null ? Boolean(body.notifyEmail) : current.notifyEmail,
  };
  const row = await prisma.predictivePreference.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
    select: {
      userId: true,
      proactiveEnabled: true,
      notifyApp: true,
      notifyEmail: true,
      updatedAt: true,
    },
  });
  await writeAudit({
    userId,
    action: "recommendations.predictive.prefs",
    resourceType: "PredictivePreference",
    resourceId: userId,
    metadata: {
      proactiveEnabled: row.proactiveEnabled,
      notifyApp: row.notifyApp,
      notifyEmail: row.notifyEmail,
    },
  }).catch(() => {});
  return row;
}

async function loadDismissed(userId) {
  const rows = await prisma.recommendationFeedback.findMany({
    where: {
      userId,
      signal: "IGNORE",
      offerId: { startsWith: PREDICTIVE_OFFER_PREFIX },
    },
    select: { offerId: true },
  });
  return new Set(rows.map((r) => r.offerId));
}

async function maybeNotify(userId, prefs, items) {
  if (!prefs.proactiveEnabled) return { notified: 0 };
  const eligible = items.filter(
    (i) => i.kind === "ROUTE_PATTERN" || i.kind === "SEASONAL_TRIP" || i.kind === "UPCOMING_JOURNEY",
  );
  if (!eligible.length) return { notified: 0 };
  const monthKey = new Date().toISOString().slice(0, 7);
  const channels = [];
  if (prefs.notifyApp) channels.push("APP");
  if (prefs.notifyEmail) channels.push("EMAIL");
  if (!channels.length) return { notified: 0 };

  const rows = [];
  for (const item of eligible.slice(0, 2)) {
    for (const channel of channels) {
      rows.push({
        userId,
        channel,
        dedupeKey: `predictive.offer:${userId}:${item.id}:${monthKey}:${channel}`,
        title: item.title,
        body: `${item.reason} ${item.hedge}`,
        payload: {
          kind: "predictive.offer",
          recommendationId: item.id,
          origin: item.origin,
          destination: item.destination,
        },
      });
    }
  }
  const result = await enqueueNotificationOutbox(rows);
  return { notified: result.enqueued };
}

export async function listPredictiveRecommendations(userId, { notify = true } = {}) {
  if (!userId) throw new AppError(401, "Authentication required");

  const [bookings, snapshots, watches, calendar, dismissed, prefs, profile] = await Promise.all([
    prisma.booking.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        product: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.supplierOfferSnapshot.findMany({
      where: { userId, product: "FLIGHT" },
      select: {
        id: true,
        netMinor: true,
        currency: true,
        supplierBookingRefs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.journeyWatch.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, departAt: true, metadata: true, flightNumber: true },
      take: 8,
    }),
    listCalendarEventsForUser(userId),
    loadDismissed(userId),
    getPredictivePreferences(userId),
    prisma.travellerProfile.findUnique({
      where: { userId },
      select: { preferredCabin: true, preferredAirlines: true },
    }),
  ]);

  const items = buildPredictiveItems({
    bookings,
    snapshots,
    watches,
    calendar,
    preferences: {
      preferredCabin: profile?.preferredCabin || null,
      preferredAirlines: profile?.preferredAirlines || [],
    },
    dismissed,
  });

  let notified = 0;
  if (notify) {
    const n = await maybeNotify(userId, prefs, items);
    notified = n.notified;
  }

  await writeAudit({
    userId,
    action: "recommendations.predictive.list",
    resourceType: "PredictiveRecommendation",
    resourceId: userId,
    metadata: { count: items.length, calendarConfigured: Boolean(calendar.configured) },
  }).catch(() => {});

  return {
    items,
    emptyReason: items.length
      ? null
      : "Not enough verified travel history, searches, or upcoming journeys to suggest a trip.",
    calendar: {
      configured: Boolean(calendar.configured),
      available: Boolean(calendar.available),
      reason: calendar.reason || null,
    },
    preferences: prefs,
    notified,
  };
}

export async function dismissPredictiveRecommendation(userId, fingerprintValue) {
  if (!userId) throw new AppError(401, "Authentication required");
  const id = String(fingerprintValue || "").trim();
  if (!id.startsWith(PREDICTIVE_OFFER_PREFIX)) {
    throw new AppError(400, "Not a predictive recommendation");
  }
  const { recordFeedback } = await import("./recommendations.service.js");
  const row = await recordFeedback(userId, {
    offerId: id,
    signal: "IGNORE",
    context: null,
  });
  await writeAudit({
    userId,
    action: "recommendations.predictive.dismiss",
    resourceType: "RecommendationFeedback",
    resourceId: row.id,
    metadata: { fingerprint: id },
  }).catch(() => {});
  return { dismissed: true, id };
}

function snapshotMatchesRoute(snapshot, origin, destination) {
  const route = snapshotRoute(snapshot);
  if (!route) return false;
  return route.origin === origin && route.destination === destination;
}

export async function getFareInsight(userId, body = {}) {
  const origin = normalizeIata(body.origin);
  const destination = normalizeIata(body.destination);
  if (!origin || !destination) {
    throw new AppError(400, "origin and destination are required");
  }
  const currency = body.currency ? String(body.currency).trim().toUpperCase() : null;
  const currentAmountMinor = Number.isInteger(body.currentAmountMinor) ? body.currentAmountMinor : null;
  const departureDate = typeof body.departureDate === "string" ? body.departureDate.slice(0, 10) : null;

  let historical = [];
  if (userId) {
    const snapshots = await prisma.supplierOfferSnapshot.findMany({
      where: { userId, product: "FLIGHT", ...(currency ? { currency } : {}) },
      select: {
        netMinor: true,
        currency: true,
        supplierBookingRefs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    const bookings = await prisma.booking.findMany({
      where: {
        userId,
        product: "FLIGHT",
        status: { in: ["TICKETED", "ACTIVE", "COMPLETED"] },
        ...(currency ? { currency } : {}),
      },
      select: { amountMinor: true, currency: true, metadata: true, createdAt: true },
      take: 50,
    });

    const now = Date.now();
    historical = snapshots
      .filter((s) => snapshotMatchesRoute(s, origin, destination))
      .filter((s) => now - new Date(s.createdAt).getTime() > 15 * 60 * 1000)
      .map((s) => s.netMinor);

    for (const booking of bookings) {
      const signal = extractBookingTripSignals(booking);
      if (signal.origin === origin && signal.destination === destination) {
        historical.push(booking.amountMinor);
      }
    }
  }

  const insight = computeFareInsight({
    currentAmountMinor,
    currency,
    historicalAmounts: historical,
    daysUntilDepart: departureDate ? daysUntilIsoDate(departureDate) : null,
  });

  return {
    origin,
    destination,
    departureDate,
    ...insight,
    privateHistoryUsed: Boolean(userId),
    autoBooked: false,
  };
}
