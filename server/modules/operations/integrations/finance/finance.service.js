/**
 * Finance visibility — reads existing Payment + Refund + AccountingEntry.
 * Never invents payment success. External accounting stays UNCONFIGURED until configured.
 */
import prisma from "../../../../config/prisma.js";
import { configuredCapability } from "../capability.js";
import { getAccountingCapability } from "../accounting/accounting.adapter.js";

export function getFinanceCapability() {
  return configuredCapability("finance", {
    verified: true,
    reasons: [
      "Finance view is internal — sourced from Payment, RefundCase, AccountingEntry",
    ],
  });
}

export async function getFinanceSnapshot({ bookingId, companyId, page = 1, pageSize = 20 } = {}) {
  const take = Math.min(pageSize, 100);
  const skip = (page - 1) * take;

  const paymentWhere = {
    ...(bookingId ? { bookingId } : {}),
    ...(companyId && !bookingId
      ? { booking: { metadata: { path: ["companyId"], equals: companyId } } }
      : {}),
  };

  const accountingWhere = {
    ...(bookingId ? { bookingId } : {}),
    ...(companyId ? { companyId } : {}),
  };

  const [payments, paymentTotal, accounting, refundCases, paymentAggregates, accountingAggregates] =
    await Promise.all([
      prisma.payment.findMany({
        where: paymentWhere,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          bookingId: true,
          userId: true,
          status: true,
          provider: true,
          currency: true,
          amountMinor: true,
          providerPaymentId: true,
          createdAt: true,
        },
      }),
      prisma.payment.count({ where: paymentWhere }),
      prisma.accountingEntry.findMany({
        where: accountingWhere,
        orderBy: { createdAt: "asc" },
        take: bookingId ? 100 : 50,
        select: {
          id: true,
          bookingId: true,
          entryType: true,
          currency: true,
          amountMinor: true,
          memo: true,
          companyId: true,
          paymentId: true,
          createdAt: true,
        },
      }),
      bookingId
        ? prisma.refundCase.findMany({
            where: { bookingId },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              status: true,
              kind: true,
              paymentRefundStatus: true,
              createdAt: true,
              completedAt: true,
            },
          })
        : Promise.resolve([]),
      prisma.payment.groupBy({
        by: ["currency", "status"],
        where: paymentWhere,
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      prisma.accountingEntry.groupBy({
        by: ["currency", "entryType"],
        where: accountingWhere,
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
    ]);

  const externalAccounting = getAccountingCapability();

  return {
    capability: getFinanceCapability(),
    externalAccounting: {
      state: externalAccounting.state,
      configured: externalAccounting.configured,
      reasons: externalAccounting.reasons,
      // Never claim sync when unconfigured.
      syncStatus: externalAccounting.configured ? "CONFIGURED" : "UNCONFIGURED",
      dataAvailability: externalAccounting.configured ? "OK" : "DATA_UNAVAILABLE",
    },
    payments: {
      items: payments,
      page,
      pageSize: take,
      total: paymentTotal,
      totalPages: paymentTotal === 0 ? 0 : Math.ceil(paymentTotal / take),
    },
    accountingEntries: accounting,
    refundCases,
    aggregates: {
      payments: paymentAggregates.map((row) => ({
        currency: row.currency,
        status: row.status,
        amountMinorSum: row._sum.amountMinor ?? 0,
        count: row._count._all,
      })),
      accounting: accountingAggregates.map((row) => ({
        currency: row.currency,
        entryType: row.entryType,
        amountMinorSum: row._sum.amountMinor ?? 0,
        count: row._count._all,
      })),
    },
  };
}
