/**
 * Commission tracking — only when OPS_COMMISSION_BPS or PricingConfig is set.
 * Basis and currency always come from the authoritative Booking row (never payload).
 */
import prisma from "../../../../config/prisma.js";
import { assertNonNegativeBps, assertNonNegativeMinorAmount, bpsOfMinor } from "../../../../lib/money.js";
import { configuredCapability, unconfiguredCapability } from "../capability.js";

const COMMISSION_SELECT = {
  id: true,
  bookingId: true,
  currency: true,
  basisMinor: true,
  commissionBps: true,
  commissionMinor: true,
  status: true,
  source: true,
  idempotencyKey: true,
  formula: true,
  companyId: true,
  userId: true,
  supplierCode: true,
  createdAt: true,
};

export async function resolveCommissionBps() {
  if (process.env.OPS_COMMISSION_BPS != null && process.env.OPS_COMMISSION_BPS !== "") {
    return Number(process.env.OPS_COMMISSION_BPS);
  }
  try {
    const row = await prisma.pricingConfig.findUnique({
      where: { key: "ops_commission_bps" },
      select: { valueInt: true },
    });
    if (row?.valueInt != null) return Number(row.valueInt);
  } catch {
    /* ignore */
  }
  return null;
}

export async function getCommissionCapability() {
  const bps = await resolveCommissionBps();
  if (bps == null || !Number.isFinite(bps)) {
    return unconfiguredCapability("commissions", [
      "Set OPS_COMMISSION_BPS or PricingConfig ops_commission_bps — never invent commission rates",
    ]);
  }
  return configuredCapability("commissions", {
    verified: true,
    reasons: [`Commission bps configured: ${bps}`],
  });
}

function companyIdFromMetadata(metadata) {
  const raw = metadata && typeof metadata === "object" ? metadata.companyId : null;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Record commission from authoritative booking amounts.
 * Forged frontend/payload amounts are ignored when the booking exists.
 */
export async function recordCommissionForTicketedBooking({
  bookingId,
  eventId,
  tx = prisma,
} = {}) {
  if (!bookingId) {
    return { recorded: false, reason: "DATA_UNAVAILABLE", capability: await getCommissionCapability() };
  }

  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      currency: true,
      amountMinor: true,
      supplierCode: true,
      metadata: true,
    },
  });
  if (!booking) {
    return { recorded: false, reason: "BOOKING_NOT_FOUND", capability: await getCommissionCapability() };
  }

  const bps = await resolveCommissionBps();
  if (bps == null || !Number.isFinite(bps)) {
    return { recorded: false, reason: "DATA_UNAVAILABLE", capability: await getCommissionCapability() };
  }
  assertNonNegativeBps(bps, "commissionBps");
  assertNonNegativeMinorAmount(booking.amountMinor, "basisMinor");

  const currency = booking.currency;
  const basisMinor = booking.amountMinor;
  const commissionMinor = bpsOfMinor(basisMinor, bps);
  const companyId = companyIdFromMetadata(booking.metadata);
  const idempotencyKey = `commission:ticketed:${bookingId}`;

  const existing = await tx.commissionRecord.findUnique({
    where: { idempotencyKey },
    select: COMMISSION_SELECT,
  });
  if (existing) {
    return { recorded: true, record: existing, deduplicated: true };
  }

  const record = await tx.commissionRecord.create({
    data: {
      bookingId,
      currency,
      basisMinor,
      commissionBps: bps,
      commissionMinor,
      status: "RECORDED",
      source: "OPS_COMMISSION_BPS",
      idempotencyKey,
      companyId,
      userId: booking.userId,
      supplierCode: booking.supplierCode || null,
      formula: {
        rule: "CONFIGURED_BPS",
        bps,
        basisMinor,
        eventId: eventId || null,
        source: "booking.amountMinor",
      },
    },
    select: COMMISSION_SELECT,
  });

  const acctKey = `acct:commission:${bookingId}`;
  const existingAcct = await tx.accountingEntry.findUnique({
    where: { idempotencyKey: acctKey },
    select: { id: true },
  });
  if (!existingAcct) {
    await tx.accountingEntry.create({
      data: {
        bookingId,
        entryType: "COMMISSION",
        currency,
        amountMinor: commissionMinor,
        memo: `Commission ${bps} bps`,
        idempotencyKey: acctKey,
        sourceEventId: eventId || null,
        companyId,
        userId: booking.userId,
        supplierCode: booking.supplierCode || null,
      },
    });
  }
  return { recorded: true, record };
}

export async function listCommissions({ bookingId, companyId, page = 1, pageSize = 20 } = {}) {
  const take = Math.min(pageSize, 100);
  const skip = (page - 1) * take;
  const where = {
    ...(bookingId ? { bookingId } : {}),
    ...(companyId ? { companyId } : {}),
  };
  const [items, total, aggregates] = await Promise.all([
    prisma.commissionRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: COMMISSION_SELECT,
    }),
    prisma.commissionRecord.count({ where }),
    prisma.commissionRecord.groupBy({
      by: ["currency"],
      where,
      _sum: { commissionMinor: true, basisMinor: true },
      _count: { _all: true },
    }),
  ]);
  return {
    capability: await getCommissionCapability(),
    items,
    page,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
    aggregates: aggregates.map((row) => ({
      currency: row.currency,
      commissionMinorSum: row._sum.commissionMinor ?? 0,
      basisMinorSum: row._sum.basisMinor ?? 0,
      count: row._count._all,
    })),
  };
}
