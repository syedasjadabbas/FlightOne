/**
 * Module 03 — JourneyWatch-driven ACTIVE/COMPLETED booking transitions.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";

const { default: prisma } = await import("../../config/prisma.js");
const {
  markBookingActiveFromJourney,
  markBookingCompletedFromJourney,
} = await import("../bookings/bookings.lifecycle.js");

const suffix = Date.now();
const userIds = [];
const bookingIds = [];

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of bookingIds) {
    await prisma.bookingTransition.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.booking.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

async function seedTicketed() {
  const user = await prisma.user.create({
    data: {
      email: `fo.life.${suffix}.${userIds.length}@example.com`,
      name: "Life",
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  const booking = await prisma.booking.create({
    data: {
      userId: user.id,
      product: "FLIGHT",
      status: "TICKETED",
      currency: "USD",
      amountMinor: 10000,
      netMinor: 9000,
      marginMinor: 1000,
      supplierCode: "GALILEO",
    },
  });
  bookingIds.push(booking.id);
  return booking;
}

describe("booking lifecycle ACTIVE/COMPLETED", () => {
  it("TICKETED → ACTIVE is idempotent", async () => {
    const booking = await seedTicketed();
    const a = await markBookingActiveFromJourney(booking.id);
    assert.equal(a.status, "ACTIVE");
    const again = await markBookingActiveFromJourney(booking.id);
    assert.equal(again.status, "ACTIVE");
    const transitions = await prisma.bookingTransition.count({
      where: { bookingId: booking.id, toStatus: "ACTIVE" },
    });
    assert.equal(transitions, 1);
  });

  it("ACTIVE → COMPLETED via journey completion helper", async () => {
    const booking = await seedTicketed();
    await markBookingActiveFromJourney(booking.id);
    const done = await markBookingCompletedFromJourney(booking.id);
    assert.equal(done.status, "COMPLETED");
    const again = await markBookingCompletedFromJourney(booking.id);
    assert.equal(again.status, "COMPLETED");
  });

  it("TICKETED completion promotes through ACTIVE then COMPLETED", async () => {
    const booking = await seedTicketed();
    const done = await markBookingCompletedFromJourney(booking.id);
    assert.equal(done.status, "COMPLETED");
    const statuses = await prisma.bookingTransition.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
      select: { toStatus: true },
    });
    assert.deepEqual(
      statuses.map((s) => s.toStatus),
      ["ACTIVE", "COMPLETED"],
    );
  });
});
