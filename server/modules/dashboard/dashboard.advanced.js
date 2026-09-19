/**
 * Phase 3 advanced analytics — bounded aggregations over verified FlightOne data.
 * Platform staff: dashboard:read. Corporate: company membership (ADMIN/APPROVER).
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { extractBookingTripSignals } from "../profile/historyPatterns.js";
import { requireCompanyMembership } from "../corporate/corporate.service.js";
import {
  ANALYTICS_METHOD_CODE,
  ANALYTICS_METHOD_NOTE,
  ANALYTICS_METHOD_VERSION,
  FORECAST_MIN_PERIODS,
  MAX_ANALYTICS_RANGE_DAYS,
  MAX_ANALYTICS_ROWS,
  forecastFromWeeklySeries,
  monthKeyUtc,
  observedPriceAssociation,
  weekStartUtc,
  buildSupplierInsights,
  SUPPLIER_INSIGHT_MIN_BOOKINGS,
} from "./dashboard.advanced.math.js";

const REVENUE_STATUSES = ["TICKETED", "ACTIVE", "COMPLETED"];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function assertAnalyticsRange(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(400, "from and to must be valid dates");
  }
  if (start > end) throw new AppError(400, "from must be on or before to");
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days > MAX_ANALYTICS_RANGE_DAYS) {
    throw new AppError(400, `Analytics range cannot exceed ${MAX_ANALYTICS_RANGE_DAYS} days`);
  }
  return { start, end, days };
}

function bookingWhere({ start, end, currency, product, companyId }) {
  const where = { createdAt: { gte: start, lte: end } };
  if (currency) where.currency = currency;
  if (product) where.product = product;
  if (companyId) {
    where.metadata = { path: ["companyId"], equals: companyId };
  }
  return where;
}

function snapshotRoute(snapshot) {
  const refs = asObject(snapshot?.supplierBookingRefs);
  const itinerary = asObject(refs?.itinerary) || asObject(refs);
  const origin = itinerary?.origin;
  const destination = itinerary?.destination;
  if (!origin || !destination) return null;
  return `${String(origin).toUpperCase()}-${String(destination).toUpperCase()}`;
}

async function loadBookings(query) {
  const { start, end } = assertAnalyticsRange(query.from, query.to);
  const where = bookingWhere({
    start,
    end,
    currency: query.currency,
    product: query.product,
    companyId: query.companyId,
  });
  const items = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: MAX_ANALYTICS_ROWS,
    select: {
      id: true,
      userId: true,
      status: true,
      product: true,
      currency: true,
      amountMinor: true,
      netMinor: true,
      supplierCode: true,
      metadata: true,
      createdAt: true,
    },
  });
  return {
    items,
    truncated: items.length >= MAX_ANALYTICS_ROWS,
    range: { from: start.toISOString(), to: end.toISOString() },
  };
}

function provenance({ range, sampleCount, truncated, companyId, extra } = {}) {
  return {
    methodCode: ANALYTICS_METHOD_CODE,
    methodVersion: ANALYTICS_METHOD_VERSION,
    methodNote: ANALYTICS_METHOD_NOTE,
    period: range || null,
    sampleCount: sampleCount ?? 0,
    truncated: Boolean(truncated),
    companyScoped: Boolean(companyId),
    generatedAt: new Date().toISOString(),
    ...extra,
  };
}

export async function getAdvancedForecast(query) {
  const loaded = await loadBookings(query);
  const recognized = loaded.items.filter((b) => REVENUE_STATUSES.includes(b.status));
  const metric = query.metric === "spend" ? "spend" : "volume";
  const byWeek = new Map();
  for (const b of recognized) {
    const period = weekStartUtc(b.createdAt);
    if (!period) continue;
    const prev = byWeek.get(period) || { period, value: 0, observations: 0 };
    prev.observations += 1;
    prev.value += metric === "spend" ? b.amountMinor : 1;
    byWeek.set(period, prev);
  }
  const points = [...byWeek.values()].sort((a, b) => a.period.localeCompare(b.period));
  const forecast = forecastFromWeeklySeries(points, { metric });
  return {
    ...forecast,
    autoAction: false,
    provenance: provenance({
      range: loaded.range,
      sampleCount: recognized.length,
      truncated: loaded.truncated,
      companyId: query.companyId,
      extra: { source: "Booking.status in TICKETED|ACTIVE|COMPLETED", minPeriods: FORECAST_MIN_PERIODS },
    }),
  };
}

export async function getAdvancedCohorts(query) {
  const { start, end } = assertAnalyticsRange(query.from, query.to);
  let userWhere = { createdAt: { gte: start, lte: end } };
  let memberUserIds = null;
  if (query.companyId) {
    const members = await prisma.companyMembership.findMany({
      where: { companyId: query.companyId },
      select: { userId: true },
    });
    memberUserIds = members.map((m) => m.userId);
    userWhere = { ...userWhere, id: { in: memberUserIds.length ? memberUserIds : ["__none__"] } };
  }
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, createdAt: true },
    take: MAX_ANALYTICS_ROWS,
  });
  const loaded = await loadBookings(query);
  const recognized = loaded.items.filter((b) => REVENUE_STATUSES.includes(b.status));
  const spendByUser = new Map();
  const bookingsByUser = new Map();
  for (const b of recognized) {
    bookingsByUser.set(b.userId, (bookingsByUser.get(b.userId) || 0) + 1);
    spendByUser.set(b.userId, (spendByUser.get(b.userId) || 0) + b.amountMinor);
  }
  const cohorts = new Map();
  for (const u of users) {
    const key = monthKeyUtc(u.createdAt);
    if (!key) continue;
    const prev = cohorts.get(key) || {
      cohort: key,
      size: 0,
      activeTravellers: 0,
      bookings: 0,
      spendMinor: 0,
    };
    prev.size += 1;
    const bcount = bookingsByUser.get(u.id) || 0;
    if (bcount > 0) {
      prev.activeTravellers += 1;
      prev.bookings += bcount;
      prev.spendMinor += spendByUser.get(u.id) || 0;
    }
    cohorts.set(key, prev);
  }
  const items = [...cohorts.values()].sort((a, b) => a.cohort.localeCompare(b.cohort));
  return {
    dataStatus: items.length ? "OK" : "NO_DATA",
    items,
    emptyReason: items.length ? null : "No travellers in this signup period.",
    privacy: "Aggregates only — no names, emails, or traveller ids are returned.",
    provenance: provenance({
      range: { from: start.toISOString(), to: end.toISOString() },
      sampleCount: users.length,
      truncated: users.length >= MAX_ANALYTICS_ROWS,
      companyId: query.companyId,
      extra: { source: "User.createdAt month + recognized bookings in the same filter window" },
    }),
  };
}

export async function getAdvancedElasticity(query) {
  const { start, end } = assertAnalyticsRange(query.from, query.to);
  const loaded = await loadBookings(query);
  const recognized = loaded.items.filter((b) => REVENUE_STATUSES.includes(b.status));
  const snapshotWhere = {
    createdAt: { gte: start, lte: end },
    product: query.product || "FLIGHT",
  };
  if (query.currency) snapshotWhere.currency = query.currency;
  if (query.companyId) {
    const members = await prisma.companyMembership.findMany({
      where: { companyId: query.companyId },
      select: { userId: true },
    });
    snapshotWhere.userId = { in: members.length ? members.map((m) => m.userId) : ["__none__"] };
  }

  const snapshots = await prisma.supplierOfferSnapshot.findMany({
    where: snapshotWhere,
    select: {
      userId: true,
      netMinor: true,
      currency: true,
      supplierBookingRefs: true,
      createdAt: true,
    },
    take: MAX_ANALYTICS_ROWS,
    orderBy: { createdAt: "desc" },
  });

  const convertedKeys = new Set();
  const rows = [];
  for (const b of recognized) {
    const signal = extractBookingTripSignals(b);
    const route = signal.route;
    rows.push({
      priceMinor: b.amountMinor,
      converted: true,
      route,
    });
    if (route) convertedKeys.add(`${b.userId}:${route}`);
  }
  for (const s of snapshots) {
    const route = snapshotRoute(s);
    const converted = route ? convertedKeys.has(`${s.userId}:${route}`) : false;
    rows.push({
      priceMinor: s.netMinor,
      converted,
      route,
    });
  }

  const association = observedPriceAssociation(rows);
  return {
    ...association,
    provenance: provenance({
      range: { from: start.toISOString(), to: end.toISOString() },
      sampleCount: rows.length,
      truncated: loaded.truncated || snapshots.length >= MAX_ANALYTICS_ROWS,
      companyId: query.companyId,
      extra: { source: "SupplierOfferSnapshot.netMinor + recognized Booking.amountMinor" },
    }),
  };
}

export async function getAdvancedSupplierInsights(query) {
  const loaded = await loadBookings(query);
  const map = new Map();
  for (const b of loaded.items) {
    const code = b.supplierCode || "UNKNOWN";
    if (!map.has(code)) {
      map.set(code, {
        supplierCode: code,
        bookings: 0,
        ticketedOrActive: 0,
        cancelledOrRefunded: 0,
        spendMinor: 0,
        currency: b.currency,
        routes: new Map(),
      });
    }
    const entry = map.get(code);
    entry.bookings += 1;
    if (REVENUE_STATUSES.includes(b.status)) {
      entry.ticketedOrActive += 1;
      entry.spendMinor += b.amountMinor;
    }
    if (b.status === "CANCELLED" || b.status === "REFUNDED") entry.cancelledOrRefunded += 1;
    const route = extractBookingTripSignals(b).route;
    if (route) entry.routes.set(route, (entry.routes.get(route) || 0) + 1);
  }
  const suppliers = [...map.values()].map((s) => {
    const top = [...s.routes.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      supplierCode: s.supplierCode,
      bookings: s.bookings,
      ticketedOrActive: s.ticketedOrActive,
      cancelledOrRefunded: s.cancelledOrRefunded,
      spendMinor: s.spendMinor,
      currency: s.currency,
      fulfillmentRate: s.bookings ? Number((s.ticketedOrActive / s.bookings).toFixed(4)) : null,
      cancelRefundRate: s.bookings ? Number((s.cancelledOrRefunded / s.bookings).toFixed(4)) : null,
      topRoute: top ? top[0] : null,
      topRouteShare: top && s.bookings ? Number((top[1] / s.bookings).toFixed(4)) : null,
    };
  });
  const packed = buildSupplierInsights(suppliers, { period: loaded.range });
  return {
    ...packed,
    minBookingsForInsight: SUPPLIER_INSIGHT_MIN_BOOKINGS,
    provenance: provenance({
      range: loaded.range,
      sampleCount: loaded.items.length,
      truncated: loaded.truncated,
      companyId: query.companyId,
      extra: { source: "Booking.supplierCode + status + metadata route" },
    }),
  };
}

async function phase3Activity(query) {
  const { start, end } = assertAnalyticsRange(query.from, query.to);
  const range = { createdAt: { gte: start, lte: end } };
  const safeCount = async (fn) => {
    try {
      return await fn();
    } catch {
      return 0;
    }
  };
  const [voiceSessions, conciergeExecutions, predictiveSignals, expenses, carbon] = await Promise.all([
    safeCount(() => prisma.voiceSession.count({ where: range })),
    safeCount(() => prisma.conciergeExecution.count({ where: range })),
    safeCount(() =>
      prisma.recommendationFeedback.count({
        where: { ...range, offerId: { startsWith: "predictive:" } },
      }),
    ),
    query.companyId
      ? safeCount(() =>
          prisma.expense.count({
            where: { companyId: query.companyId, createdAt: { gte: start, lte: end } },
          }),
        )
      : Promise.resolve(null),
    query.companyId
      ? safeCount(() =>
          prisma.carbonEstimate.count({
            where: { companyId: query.companyId, status: "AVAILABLE" },
          }),
        )
      : Promise.resolve(null),
  ]);
  return {
    voiceSessions,
    conciergeExecutions,
    predictiveSignals,
    expenses: expenses,
    carbonEstimatesAvailable: carbon,
    note: "Counts of verified Phase 3 activity in range. Company expense/carbon totals only when company-scoped.",
  };
}

export async function getAdvancedOverview(query) {
  const [forecastVolume, forecastSpend, cohorts, elasticity, suppliers, activity] = await Promise.all([
    getAdvancedForecast({ ...query, metric: "volume" }),
    getAdvancedForecast({ ...query, metric: "spend" }),
    getAdvancedCohorts(query),
    getAdvancedElasticity(query),
    getAdvancedSupplierInsights(query),
    phase3Activity(query),
  ]);
  return {
    range: {
      from: new Date(query.from).toISOString(),
      to: new Date(query.to).toISOString(),
    },
    companyId: query.companyId || null,
    forecasts: { volume: forecastVolume, spend: forecastSpend },
    cohorts,
    elasticity,
    suppliers,
    phase3Activity: activity,
    pricesUnchanged: true,
    contractsUnchanged: true,
  };
}

async function auditStaffAdvancedRead(userId, query, slice) {
  await writeAudit({
    userId,
    action: "dashboard.advanced.read",
    resourceType: "AdvancedAnalytics",
    resourceId: query.companyId || slice,
    metadata: { slice, companyId: query.companyId || null },
  }).catch(() => {});
}

export async function getStaffAdvancedAnalytics(userId, query) {
  const data = await getAdvancedOverview(query);
  await auditStaffAdvancedRead(userId, query, "overview");
  return data;
}

export async function getStaffAdvancedForecast(userId, query) {
  const data = await getAdvancedForecast(query);
  await auditStaffAdvancedRead(userId, query, "forecast");
  return data;
}

export async function getStaffAdvancedCohorts(userId, query) {
  const data = await getAdvancedCohorts(query);
  await auditStaffAdvancedRead(userId, query, "cohorts");
  return data;
}

export async function getStaffAdvancedElasticity(userId, query) {
  const data = await getAdvancedElasticity(query);
  await auditStaffAdvancedRead(userId, query, "elasticity");
  return data;
}

export async function getStaffAdvancedSuppliers(userId, query) {
  const data = await getAdvancedSupplierInsights(query);
  await auditStaffAdvancedRead(userId, query, "suppliers");
  return data;
}

export async function getCompanyAdvancedAnalytics(userId, companyId, query) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN", "APPROVER"] });
  const data = await getAdvancedOverview({ ...query, companyId });
  await writeAudit({
    userId,
    action: "corporate.analytics.read",
    resourceType: "AdvancedAnalytics",
    resourceId: companyId,
    metadata: { companyId, from: query.from, to: query.to },
  }).catch(() => {});
  return data;
}
