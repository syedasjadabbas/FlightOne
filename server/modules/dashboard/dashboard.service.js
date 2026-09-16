/**
 * Module 17 — Management Dashboard.
 * Read-only aggregations from authoritative Modules 1–16 data.
 * Never invents FX rates, revenues, or automation percentages.
 */
import prisma from "../../config/prisma.js";
import { withDashboardSection } from "../../lib/swr-cache.js";

const DEFAULT_TTL_MS = 30 * 1000;
const REVENUE_STATUSES = ["TICKETED", "ACTIVE", "COMPLETED"];
const ALL_BOOKING_STATUSES = [
  "QUOTED",
  "RESERVED",
  "TICKETED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

/** Search instrumentation buffer — keep off the supplier search critical path. */
const SEARCH_EVENT_FLUSH_SIZE = 25;
const SEARCH_EVENT_FLUSH_MS = 250;
/** @type {Array<{ userId: string | null, product: string, supplierCode: string | null, resultCount: number, success: boolean, errorCode: string | null }>} */
const searchEventBuffer = [];
/** @type {ReturnType<typeof setTimeout> | null} */
let searchEventFlushTimer = null;

function normalizeSearchEventPayload({
  userId,
  product,
  supplierCode,
  resultCount,
  success = true,
  errorCode,
} = {}) {
  if (!product) return null;
  return {
    userId: userId || null,
    product,
    supplierCode: supplierCode || null,
    resultCount: Number.isFinite(resultCount) ? resultCount : 0,
    success: Boolean(success),
    errorCode: errorCode || null,
  };
}

function scheduleSearchEventFlush() {
  if (searchEventFlushTimer) return;
  searchEventFlushTimer = setTimeout(() => {
    searchEventFlushTimer = null;
    void flushSearchEventBuffer();
  }, SEARCH_EVENT_FLUSH_MS);
  searchEventFlushTimer.unref?.();
}

/**
 * Flush buffered DashboardSearchEvent rows (createMany). Safe to call anytime.
 * @returns {Promise<number>} rows written
 */
export async function flushSearchEventBuffer() {
  if (searchEventFlushTimer) {
    clearTimeout(searchEventFlushTimer);
    searchEventFlushTimer = null;
  }
  if (!searchEventBuffer.length) return 0;
  const batch = searchEventBuffer.splice(0, searchEventBuffer.length);
  try {
    const result = await prisma.dashboardSearchEvent.createMany({ data: batch });
    return result.count ?? batch.length;
  } catch {
    // Instrumentation must never affect product paths; drop the batch.
    return 0;
  }
}

/**
 * Enqueue a search funnel event without awaiting DB I/O (hot path).
 * Flushes on size/timer; funnel reads call flushSearchEventBuffer first.
 */
export function enqueueSearchEvent(params) {
  const row = normalizeSearchEventPayload(params);
  if (!row) return;
  searchEventBuffer.push(row);
  if (searchEventBuffer.length >= SEARCH_EVENT_FLUSH_SIZE) {
    void flushSearchEventBuffer();
  } else {
    scheduleSearchEventFlush();
  }
}

function buildCacheKey(section, { from, to, currency, product } = {}) {
  return [
    section,
    from ? `from=${new Date(from).toISOString()}` : "from=",
    to ? `to=${new Date(to).toISOString()}` : "to=",
    `currency=${currency ?? ""}`,
    `product=${product ?? ""}`,
  ].join("|");
}

function bookingWhere({ from, to, currency, product }) {
  const where = { createdAt: { gte: new Date(from), lte: new Date(to) } };
  if (currency) where.currency = currency;
  if (product) where.product = product;
  return where;
}

function ratio(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(4));
}

async function withModelFallback(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === "P2021" || err?.code === "P2022" || err instanceof TypeError) {
      return typeof fallback === "function" ? fallback() : fallback;
    }
    throw err;
  }
}

function moneyGroupsToPayload(groups, queryCurrency) {
  const byCurrency = groups.map((g) => ({
    currency: g.currency,
    revenueMinor: g._sum?.amountMinor ?? 0,
    marginMinor: g._sum?.marginMinor ?? 0,
    netMinor: g._sum?.netMinor ?? 0,
    bookingCount: g._count?._all ?? 0,
  }));

  if (queryCurrency) {
    const match = byCurrency.find((g) => g.currency === queryCurrency);
    return {
      ...(match ?? {
        currency: queryCurrency,
        revenueMinor: 0,
        marginMinor: 0,
        netMinor: 0,
        bookingCount: 0,
      }),
      formula: {
        revenue: "SUM(Booking.amountMinor) where status in TICKETED|ACTIVE|COMPLETED",
        margin: "SUM(Booking.marginMinor) same filter (authoritative Module 05 field)",
        net: "SUM(Booking.netMinor) same filter",
      },
      dataStatus: "OK",
    };
  }

  if (byCurrency.length === 0) {
    return {
      currency: null,
      revenueMinor: 0,
      marginMinor: 0,
      netMinor: 0,
      bookingCount: 0,
      dataStatus: "NO_DATA",
      formula: {
        revenue: "SUM(Booking.amountMinor) where status in TICKETED|ACTIVE|COMPLETED",
        margin: "SUM(Booking.marginMinor)",
      },
    };
  }

  if (byCurrency.length === 1) {
    return {
      ...byCurrency[0],
      dataStatus: "OK",
      formula: {
        revenue: "SUM(Booking.amountMinor) where status in TICKETED|ACTIVE|COMPLETED",
        margin: "SUM(Booking.marginMinor)",
      },
    };
  }

  return {
    currency: null,
    mixed: true,
    byCurrency,
    dataStatus: "OK",
    note: "Multiple currencies — totals are not summed (no FX). Filter by currency.",
    formula: {
      revenue: "SUM(Booking.amountMinor) per currency",
      margin: "SUM(Booking.marginMinor) per currency",
    },
  };
}

/**
 * Record one search attempt immediately (tests / explicit callers).
 * Prefer enqueueSearchEvent on the supplier search hot path.
 */
export async function recordSearchEvent(params = {}) {
  try {
    const data = normalizeSearchEventPayload(params);
    if (!data) return null;
    return await prisma.dashboardSearchEvent.create({
      data,
      select: { id: true },
    });
  } catch {
    return null;
  }
}

/**
 * Sales — recognized sales = bookings in TICKETED|ACTIVE|COMPLETED created in range.
 * Volume breakdown includes all statuses for transparency.
 */
export async function getSales(query) {
  return withDashboardSection(buildCacheKey("sales", query), DEFAULT_TTL_MS, async () => {
    const where = bookingWhere(query);
    const recognizedWhere = { ...where, status: { in: REVENUE_STATUSES } };

    const [volume, recognized, byStatusRaw, byProductRaw] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.count({ where: recognizedWhere }),
      prisma.booking.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.booking.groupBy({ by: ["product"], where: recognizedWhere, _count: { _all: true } }),
    ]);

    return {
      dataStatus: volume === 0 ? "NO_DATA" : "OK",
      volumeCreated: volume,
      recognizedSales: recognized,
      definition:
        "recognizedSales = bookings created in range with status TICKETED|ACTIVE|COMPLETED. Cancelled/quoted-only are not counted as sales.",
      byStatus: byStatusRaw.map((r) => ({ status: r.status, count: r._count._all })),
      byProduct: byProductRaw.map((r) => ({ product: r.product, count: r._count._all })),
      computedAt: new Date().toISOString(),
    };
  });
}

export async function getRevenue(query) {
  return withDashboardSection(buildCacheKey("revenue", query), DEFAULT_TTL_MS, async () => {
    const where = { ...bookingWhere(query), status: { in: REVENUE_STATUSES } };
    const groups = await prisma.booking.groupBy({
      by: ["currency"],
      where,
      _sum: { amountMinor: true, marginMinor: true, netMinor: true },
      _count: { _all: true },
    });
    return { ...moneyGroupsToPayload(groups, query.currency), computedAt: new Date().toISOString() };
  });
}

/** Margins — same authoritative Booking.marginMinor source as revenue. */
export async function getMargins(query) {
  return withDashboardSection(buildCacheKey("margins", query), DEFAULT_TTL_MS, async () => {
    const where = { ...bookingWhere(query), status: { in: REVENUE_STATUSES } };
    const groups = await prisma.booking.groupBy({
      by: ["currency"],
      where,
      _sum: { amountMinor: true, marginMinor: true, netMinor: true },
      _count: { _all: true },
    });
    const base = moneyGroupsToPayload(groups, query.currency);

    const withRates = (row) => {
      if (!row || row.revenueMinor == null) return row;
      const marginRate =
        row.revenueMinor > 0 ? Number((row.marginMinor / row.revenueMinor).toFixed(4)) : null;
      return { ...row, marginRate };
    };

    if (base.byCurrency) {
      return {
        ...base,
        byCurrency: base.byCurrency.map(withRates),
        computedAt: new Date().toISOString(),
      };
    }
    return { ...withRates(base), computedAt: new Date().toISOString() };
  });
}

export async function getOutstandingCredit() {
  return withDashboardSection("credit", DEFAULT_TTL_MS, async () => {
    return withModelFallback(
      async () => {
        const companies = await prisma.company.findMany({
          select: {
            id: true,
            name: true,
            currency: true,
            creditLimitMinor: true,
            creditUsedMinor: true,
          },
          orderBy: { name: "asc" },
          take: 500,
        });
        return {
          available: true,
          dataStatus: companies.length ? "OK" : "NO_DATA",
          definition:
            "outstanding = Company.creditUsedMinor; remaining = creditLimitMinor - creditUsedMinor (Module 06).",
          companies: companies.map((c) => ({
            id: c.id,
            name: c.name,
            currency: c.currency,
            creditLimitMinor: c.creditLimitMinor,
            creditUsedMinor: c.creditUsedMinor,
            remainingMinor: c.creditLimitMinor - c.creditUsedMinor,
          })),
          computedAt: new Date().toISOString(),
        };
      },
      {
        available: false,
        dataStatus: "UNCONFIGURED",
        companies: [],
        computedAt: new Date().toISOString(),
      },
    );
  });
}

/**
 * Booking conversion funnel.
 * Search = DashboardSearchEvent (if any); else searchToQuote = DATA_UNAVAILABLE.
 * Quote = Booking created; Reserved/Ticketed = BookingTransition ever reached.
 */
export async function getBookingConversion(query) {
  return withDashboardSection(buildCacheKey("conversion", query), DEFAULT_TTL_MS, async () => {
    // Drain in-flight search instrumentation before counting the funnel.
    await flushSearchEventBuffer();

    const where = bookingWhere(query);
    const bookingScope = { createdAt: where.createdAt };
    if (where.currency) bookingScope.currency = where.currency;
    if (where.product) bookingScope.product = where.product;

    const searchWhere = {
      createdAt: where.createdAt,
      ...(where.product ? { product: where.product } : {}),
    };

    const [searches, quoted, reachedReserved, reachedTicketed, statusGroups] = await Promise.all([
      withModelFallback(() => prisma.dashboardSearchEvent.count({ where: searchWhere }), 0),
      prisma.booking.count({ where }),
      prisma.bookingTransition.count({
        where: { toStatus: "RESERVED", booking: bookingScope },
      }),
      prisma.bookingTransition.count({
        where: { toStatus: "TICKETED", booking: bookingScope },
      }),
      prisma.booking.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ]);

    const statusCountByKey = Object.fromEntries(
      statusGroups.map((r) => [r.status, r._count._all]),
    );

    const searchInstrumented = searches > 0;
    return {
      dataStatus: quoted === 0 && searches === 0 ? "NO_DATA" : "OK",
      funnel: {
        searches,
        quoted,
        reachedReserved,
        reachedTicketed,
      },
      conversion: {
        searchToQuote: searchInstrumented ? ratio(quoted, searches) : null,
        quotedToReserved: ratio(reachedReserved, quoted),
        reservedToTicketed: ratio(reachedTicketed, reachedReserved),
        quotedToTicketed: ratio(reachedTicketed, quoted),
      },
      searchInstrumentation: searchInstrumented ? "OK" : "DATA_UNAVAILABLE",
      note: searchInstrumented
        ? "search = DashboardSearchEvent count; quote = Booking created; reserved/ticketed = BookingTransition."
        : "No DashboardSearchEvent rows in range — search→quote unavailable. Quote→ticketed still computed.",
      statusCounts: ALL_BOOKING_STATUSES.map((status) => ({
        status,
        count: statusCountByKey[status] ?? 0,
      })),
      computedAt: new Date().toISOString(),
    };
  });
}

/** Alias kept for older /funnel route. */
export async function getFunnel(query) {
  return getBookingConversion(query);
}

/**
 * AI automation rate =
 * 1 - (distinct escalated conversations created in range) / (conversations created in range)
 */
export async function getAutomation(query) {
  return withDashboardSection(buildCacheKey("automation", query), DEFAULT_TTL_MS, async () => {
    const range = { createdAt: { gte: new Date(query.from), lte: new Date(query.to) } };

    const conversationsTotal = await withModelFallback(
      () => prisma.conversation.count({ where: range }),
      0,
    );

    const escalatedDistinct = await withModelFallback(async () => {
      const rows = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT e."conversationId")::int AS "cnt"
        FROM "EscalationTicket" e
        INNER JOIN "Conversation" c ON c."id" = e."conversationId"
        WHERE c."createdAt" >= ${new Date(query.from)}
          AND c."createdAt" <= ${new Date(query.to)}
      `;
      return Number(rows?.[0]?.cnt ?? 0);
    }, 0);

    const automationRate =
      conversationsTotal > 0
        ? Number(Math.max(0, (conversationsTotal - escalatedDistinct) / conversationsTotal).toFixed(4))
        : null;

    return {
      dataStatus: conversationsTotal === 0 ? "NO_DATA" : "OK",
      conversationsTotal,
      escalatedConversations: escalatedDistinct,
      automationRate,
      formula:
        "automationRate = 1 - (distinct EscalationTicket.conversationId for conversations created in range) / (Conversation.count created in range)",
      computedAt: new Date().toISOString(),
    };
  });
}

export async function getEscalationsBreakdown(query) {
  return withDashboardSection(
    buildCacheKey("escalations-breakdown", query),
    DEFAULT_TTL_MS,
    async () => {
      const range = { createdAt: { gte: new Date(query.from), lte: new Date(query.to) } };
      return withModelFallback(
        async () => {
          const groups = await prisma.escalationTicket.groupBy({
            by: ["trigger"],
            where: range,
            _count: { _all: true },
          });
          const byTrigger = groups
            .map((g) => ({ trigger: g.trigger, count: g._count._all }))
            .sort((a, b) => b.count - a.count);
          const total = byTrigger.reduce((sum, g) => sum + g.count, 0);
          return { total, byTrigger, dataStatus: total ? "OK" : "NO_DATA", computedAt: new Date().toISOString() };
        },
        { total: 0, byTrigger: [], dataStatus: "NO_DATA", computedAt: new Date().toISOString() },
      );
    },
  );
}

/** Supplier performance from Booking.supplierCode + recon — no invented scores. */
export async function getSupplierPerformance(query) {
  return withDashboardSection(buildCacheKey("suppliers", query), DEFAULT_TTL_MS, async () => {
    const where = bookingWhere(query);
    const [bySupplier, recon] = await Promise.all([
      prisma.booking.groupBy({
        by: ["supplierCode", "status"],
        where: { ...where, supplierCode: { not: null } },
        _count: { _all: true },
      }),
      withModelFallback(
        () =>
          prisma.supplierReconItem.groupBy({
            by: ["supplierCode", "status"],
            _count: { _all: true },
          }),
        [],
      ),
    ]);

    const map = new Map();
    for (const row of bySupplier) {
      const code = row.supplierCode || "UNKNOWN";
      if (!map.has(code)) {
        map.set(code, {
          supplierCode: code,
          bookings: 0,
          ticketedOrActive: 0,
          cancelledOrRefunded: 0,
          byStatus: {},
        });
      }
      const entry = map.get(code);
      entry.bookings += row._count._all;
      entry.byStatus[row.status] = (entry.byStatus[row.status] || 0) + row._count._all;
      if (REVENUE_STATUSES.includes(row.status)) entry.ticketedOrActive += row._count._all;
      if (row.status === "CANCELLED" || row.status === "REFUNDED") {
        entry.cancelledOrRefunded += row._count._all;
      }
    }

    const suppliers = Array.from(map.values()).map((s) => ({
      ...s,
      fulfillmentRate: ratio(s.ticketedOrActive, s.bookings),
      cancelRefundRate: ratio(s.cancelledOrRefunded, s.bookings),
    }));

    return {
      dataStatus: suppliers.length ? "OK" : "NO_DATA",
      definition:
        "Volume/fulfillment from Booking.supplierCode. No invented quality scores. Latency/circuit stats are not persisted.",
      suppliers: suppliers.sort((a, b) => b.bookings - a.bookings),
      reconciliation: recon.map((r) => ({
        supplierCode: r.supplierCode,
        status: r.status,
        count: r._count._all,
      })),
      computedAt: new Date().toISOString(),
    };
  });
}

/** Customer analytics — aggregates only. */
export async function getCustomerAnalytics(query) {
  return withDashboardSection(buildCacheKey("customers", query), DEFAULT_TTL_MS, async () => {
    const where = bookingWhere(query);
    const recognizedWhere = { ...where, status: { in: REVENUE_STATUSES } };

    const [
      usersTotal,
      profilesTotal,
      bookersRows,
      bookingAgg,
      tierGroups,
      repeatRows,
    ] = await Promise.all([
      prisma.user.count(),
      withModelFallback(() => prisma.travellerProfile.count(), 0),
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "userId")::int AS "bookers"
        FROM "Booking"
        WHERE "createdAt" >= ${new Date(query.from)}
          AND "createdAt" <= ${new Date(query.to)}
      `.catch(() => [{ bookers: 0 }]),
      prisma.booking.groupBy({
        by: ["currency"],
        where: recognizedWhere,
        _avg: { amountMinor: true },
        _count: { _all: true },
      }),
      withModelFallback(
        () =>
          prisma.rewardAccount.groupBy({
            by: ["tier"],
            _count: { _all: true },
          }),
        [],
      ),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS "repeatBookers"
        FROM (
          SELECT "userId"
          FROM "Booking"
          WHERE "createdAt" >= ${new Date(query.from)}
            AND "createdAt" <= ${new Date(query.to)}
          GROUP BY "userId"
          HAVING COUNT(*) >= 2
        ) t
      `.catch(() => [{ repeatBookers: 0 }]),
    ]);

    return {
      dataStatus: usersTotal === 0 ? "NO_DATA" : "OK",
      usersTotal,
      profilesTotal,
      bookersInRange: Number(bookersRows?.[0]?.bookers ?? 0),
      repeatBookersInRange: Number(repeatRows?.[0]?.repeatBookers ?? 0),
      averageOrderValueByCurrency: bookingAgg.map((g) => ({
        currency: g.currency,
        avgAmountMinor: Math.round(g._avg.amountMinor ?? 0),
        bookingCount: g._count._all,
      })),
      loyaltyTiers: tierGroups.map((t) => ({ tier: t.tier, count: t._count._all })),
      note: "Aggregate only — no individual PII. AOV from recognized sales statuses.",
      computedAt: new Date().toISOString(),
    };
  });
}

/** Operational KPIs from Modules 9/13/14/15. */
export async function getOperationalKpis(query) {
  return withDashboardSection(buildCacheKey("ops-kpis", query), DEFAULT_TTL_MS, async () => {
    const range = { createdAt: { gte: new Date(query.from), lte: new Date(query.to) } };

    const [
      openEscalations,
      escalationsInRange,
      refundsByStatus,
      reconNeeds,
      reconMismatch,
      pendingOutbox,
      failedOutbox,
      activeJourneys,
      journeyEventsInRange,
    ] = await Promise.all([
      withModelFallback(
        () =>
          prisma.escalationTicket.count({
            where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
          }),
        0,
      ),
      withModelFallback(() => prisma.escalationTicket.count({ where: range }), 0),
      withModelFallback(
        () =>
          prisma.refundCase.groupBy({
            by: ["status"],
            where: range,
            _count: { _all: true },
          }),
        [],
      ),
      withModelFallback(
        () =>
          prisma.supplierReconItem.count({
            where: { status: { in: ["OPEN", "DATA_UNAVAILABLE", "REQUIRES_REVIEW"] } },
          }),
        0,
      ),
      withModelFallback(
        () =>
          prisma.supplierReconItem.count({
            where: { status: { in: ["MISMATCH", "DISCREPANCY"] } },
          }),
        0,
      ),
      withModelFallback(() => prisma.opsOutboxEvent.count({ where: { status: "PENDING" } }), 0),
      withModelFallback(() => prisma.opsOutboxEvent.count({ where: { status: "FAILED" } }), 0),
      withModelFallback(() => prisma.journeyWatch.count({ where: { status: "ACTIVE" } }), 0),
      withModelFallback(() => prisma.journeyEvent.count({ where: range }), 0),
    ]);

    const pendingRefunds = refundsByStatus
      .filter((r) => ["SUBMITTED", "PROCESSING", "REQUIRES_HUMAN"].includes(r.status))
      .reduce((s, r) => s + r._count._all, 0);

    return {
      dataStatus: "OK",
      openEscalations,
      escalationsCreatedInRange: escalationsInRange,
      pendingRefunds,
      refundsByStatus: refundsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      reconciliationNeedsAttention: reconNeeds,
      reconciliationMismatches: reconMismatch,
      opsOutboxPending: pendingOutbox,
      opsOutboxFailed: failedOutbox,
      activeJourneyWatches: activeJourneys,
      journeyEventsInRange,
      computedAt: new Date().toISOString(),
    };
  });
}

/** Consolidated overview for primary dashboard (one round-trip). */
export async function getOverview(query) {
  return withDashboardSection(buildCacheKey("overview", query), DEFAULT_TTL_MS, async () => {
    const [
      sales,
      revenue,
      margins,
      credit,
      conversion,
      automation,
      suppliers,
      customers,
      operational,
    ] = await Promise.all([
      getSales(query),
      getRevenue(query),
      getMargins(query),
      getOutstandingCredit(),
      getBookingConversion(query),
      getAutomation(query),
      getSupplierPerformance(query),
      getCustomerAnalytics(query),
      getOperationalKpis(query),
    ]);

    return {
      range: { from: new Date(query.from).toISOString(), to: new Date(query.to).toISOString() },
      currencyFilter: query.currency || null,
      productFilter: query.product || null,
      sales,
      revenue,
      margins,
      outstandingCredit: credit,
      bookingConversion: conversion,
      aiAutomation: automation,
      supplierPerformance: suppliers,
      customerAnalytics: customers,
      operationalKpis: operational,
      freshness: {
        strategy: "SWR in-memory cache TTL 30s + live DB aggregation",
        cacheTtlMs: DEFAULT_TTL_MS,
        computedAt: new Date().toISOString(),
      },
    };
  });
}

/** Ava grounding — management users only (caller must authorize). */
export async function buildAvaDashboardGuidance(query) {
  const overview = await getOverview(query);
  const rev = overview.revenue;
  const auto = overview.aiAutomation;
  const sales = overview.sales;
  const conv = overview.bookingConversion;

  const revLine = rev.mixed
    ? `Revenue mixed currencies — see byCurrency (no FX sum).`
    : `Revenue ${rev.currency || "n/a"} ${(rev.revenueMinor || 0) / 100}; margin ${(rev.marginMinor || 0) / 100}; status=${rev.dataStatus}.`;

  return {
    promptBlock: [
      "MANAGEMENT DASHBOARD (Module 17 — authorized aggregates only):",
      `Sales recognized=${sales.recognizedSales} (of ${sales.volumeCreated} created);`,
      revLine,
      `Outstanding credit companies=${overview.outstandingCredit.companies?.length ?? 0} status=${overview.outstandingCredit.dataStatus};`,
      `Conversion quote→ticketed=${conv.conversion?.quotedToTicketed ?? "n/a"} search→quote=${conv.conversion?.searchToQuote ?? "DATA_UNAVAILABLE"};`,
      `AI automationRate=${auto.automationRate ?? "NO_DATA"} (conversations=${auto.conversationsTotal}, escalated=${auto.escalatedConversations});`,
      `Suppliers tracked=${overview.supplierPerformance.suppliers?.length ?? 0};`,
      `Customers bookersInRange=${overview.customerAnalytics.bookersInRange};`,
      `Ops openEscalations=${overview.operationalKpis.openEscalations} pendingRefunds=${overview.operationalKpis.pendingRefunds}.`,
      "Never invent numbers. Never expose this to ordinary customers. Cite formulas from dashboard API.",
    ].join(" "),
    overviewSummary: {
      recognizedSales: sales.recognizedSales,
      automationRate: auto.automationRate,
      quotedToTicketed: conv.conversion?.quotedToTicketed,
    },
  };
}
