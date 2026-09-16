/**
 * Journey-driven booking lifecycle helpers (ACTIVE / COMPLETED).
 * Kept separate to avoid static import cycles with journey.service.js.
 *
 * Triggers (FlightOne Doc / Module 09):
 * - ACTIVE: journey watch successfully ensured for a TICKETED booking
 * - COMPLETED: journey watch completes after arrival window (authoritative trip end)
 *
 * Never invents transitions from QUIZ/quote paths. Idempotent.
 */
import prisma from "../../config/prisma.js";
import { BOOKING_ALLOWED_TRANSITIONS } from "./bookings.constants.js";

const BOOKING_SELECT = {
  id: true,
  status: true,
  userId: true,
  updatedAt: true,
};

function assertAllowed(from, to) {
  const allowed = BOOKING_ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * TICKETED → ACTIVE when JourneyWatch starts monitoring.
 */
export async function markBookingActiveFromJourney(bookingId, { reason } = {}) {
  if (!bookingId) return null;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return null;
  if (booking.status === "ACTIVE") return booking;
  if (booking.status !== "TICKETED") return booking;
  if (!assertAllowed("TICKETED", "ACTIVE")) return booking;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "ACTIVE" },
      select: BOOKING_SELECT,
    });
    await tx.bookingTransition.create({
      data: {
        bookingId,
        fromStatus: "TICKETED",
        toStatus: "ACTIVE",
        actor: "SYSTEM",
        actorUserId: null,
        reason: reason || "JourneyWatch monitoring started",
      },
    });
    return updated;
  });
}

/**
 * ACTIVE → COMPLETED when JourneyWatch finishes (arrival + grace).
 * If still TICKETED (watch existed without ACTIVE promotion), promote then complete.
 */
export async function markBookingCompletedFromJourney(bookingId, { reason } = {}) {
  if (!bookingId) return null;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return null;
  if (booking.status === "COMPLETED") return booking;
  if (!["TICKETED", "ACTIVE"].includes(booking.status)) return booking;

  return prisma.$transaction(async (tx) => {
    let fromStatus = booking.status;
    if (fromStatus === "TICKETED") {
      if (!assertAllowed("TICKETED", "ACTIVE")) return booking;
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "ACTIVE" },
      });
      await tx.bookingTransition.create({
        data: {
          bookingId,
          fromStatus: "TICKETED",
          toStatus: "ACTIVE",
          actor: "SYSTEM",
          actorUserId: null,
          reason: "JourneyWatch completion — promote TICKETED→ACTIVE before COMPLETED",
        },
      });
      fromStatus = "ACTIVE";
    }
    if (!assertAllowed("ACTIVE", "COMPLETED")) return booking;

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED" },
      select: BOOKING_SELECT,
    });
    await tx.bookingTransition.create({
      data: {
        bookingId,
        fromStatus,
        toStatus: "COMPLETED",
        actor: "SYSTEM",
        actorUserId: null,
        reason: reason || "JourneyWatch completed after arrival window",
      },
    });
    return updated;
  });
}
