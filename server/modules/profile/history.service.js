/**
 * Travel history — read-only view of Module 03 booking records for this user.
 * Does not invent a parallel history store (PRD: linked to booking records).
 *
 * Also derives soft pattern signals (routes / airlines / cabins / products)
 * from booking.metadata when present — for Module 01 prompt context only.
 */
import prisma from "../../config/prisma.js";
import {
  buildTravelHistoryPatterns,
  extractBookingTripSignals,
} from "./historyPatterns.js";

export { buildTravelHistoryPatterns, extractBookingTripSignals };

const HISTORY_SELECT = {
  id: true,
  status: true,
  product: true,
  currency: true,
  amountMinor: true,
  supplierCode: true,
  externalRef: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

function toHistoryItem(booking) {
  const { metadata: _metadata, ...rest } = booking;
  // Keep history list free of raw metadata dumps; patterns are aggregated separately.
  return rest;
}

/** GET /api/v1/profile/history */
export async function listTravelHistory(userId, { limit = 50 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const bookings = await prisma.booking.findMany({
    where: { userId },
    select: HISTORY_SELECT,
    orderBy: { createdAt: "desc" },
    take,
  });

  const [totalBookings, completedBookings] = await Promise.all([
    prisma.booking.count({ where: { userId } }),
    prisma.booking.count({ where: { userId, status: "COMPLETED" } }),
  ]);

  return {
    items: bookings.map(toHistoryItem),
    stats: {
      totalBookings,
      completedBookings,
    },
    patterns: buildTravelHistoryPatterns(bookings),
  };
}
