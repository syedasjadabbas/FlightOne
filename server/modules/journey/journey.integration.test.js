/**
 * Module 09 — Live Journey Management integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

process.env.JOURNEY_STATUS_PROVIDER = "unconfigured";

const { default: prisma } = await import("../../config/prisma.js");
const journeyService = await import("./journey.service.js");
const {
  setStatusFetcherForTests,
  resetStatusFetcherForTests,
} = await import("./journey.statusProvider.js");

const suffix = Date.now();
const users = [];
const bookings = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.journey.${label}.${suffix}@example.com`,
      name: `Journey ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

async function createTicketedBooking(userId, metadata = {}) {
  const booking = await prisma.booking.create({
    data: {
      userId,
      status: "TICKETED",
      product: "FLIGHT",
      currency: "PKR",
      amountMinor: 50000,
      netMinor: 45000,
      marginMinor: 5000,
      externalRef: `PNR${suffix}`,
      metadata: {
        flightNumber: "PK309",
        origin: "LHE",
        destination: "DXB",
        departAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        ...metadata,
      },
    },
  });
  bookings.push(booking.id);
  return booking;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  resetStatusFetcherForTests();
  for (const id of users) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    const watches = await prisma.journeyWatch.findMany({ where: { userId: id }, select: { id: true } });
    for (const w of watches) {
      await prisma.journeyEvent.deleteMany({ where: { watchId: w.id } }).catch(() => {});
    }
    await prisma.journeyWatch.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.supplierOfferSnapshot.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("journey Module 09", () => {
  it("rejects non-ticketed bookings for monitoring", async () => {
    const user = await createUser("quoted");
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        status: "QUOTED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 1000,
        netMinor: 900,
        marginMinor: 100,
        metadata: { flightNumber: "PK309", departAt: new Date(Date.now() + 86400000).toISOString() },
      },
    });
    bookings.push(booking.id);
    await assert.rejects(
      () =>
        journeyService.ensureWatchForBooking({
          bookingId: booking.id,
          userId: user.id,
        }),
      (err) => err.statusCode === 409,
    );
  });

  it("creates idempotent watch for ticketed booking", async () => {
    const user = await createUser("ticket");
    const booking = await createTicketedBooking(user.id);
    const a = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const b = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    assert.equal(a.id, b.id);
    assert.equal(a.flightNumber, "PK309");
    assert.equal(a.status, "ACTIVE");
    const refreshed = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { status: true },
    });
    assert.equal(refreshed.status, "ACTIVE");
  });

  it("pollWatch COMPLETED after arrival window and marks booking COMPLETED", async () => {
    const user = await createUser("complete");
    const booking = await createTicketedBooking(user.id);
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    await prisma.journeyWatch.update({
      where: { id: watch.id },
      data: {
        departAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        arriveAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "ACTIVE" },
    });

    const result = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.equal(result.dataStatus, "WATCH_COMPLETED");
    assert.equal(result.watch.status, "COMPLETED");
    const bookingAfter = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { status: true },
    });
    assert.equal(bookingAfter.status, "COMPLETED");
  });

  it("provider failure does not create events or invent status", async () => {
    const user = await createUser("provfail");
    const booking = await createTicketedBooking(user.id);
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    setStatusFetcherForTests(async () => {
      throw new Error("feed down");
    });
    const result = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.equal(result.dataStatus, "PROVIDER_ERROR");
    assert.equal(result.isFact, false);
    assert.equal(result.events.length, 0);
    resetStatusFetcherForTests();
  });

  it("company isolation: peer cannot read another company's watch (IDOR)", async () => {
    const owner = await createUser("coA");
    const peer = await createUser("coB");
    const booking = await createTicketedBooking(owner.id, {
      companyId: "company-a",
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: owner.id,
    });
    await assert.rejects(
      () => journeyService.getWatchForUser(peer.id, watch.id, new Set()),
      (err) => err.statusCode === 403,
    );
  });

  it("user isolation — cannot read another user's watch", async () => {
    const a = await createUser("isoA");
    const b = await createUser("isoB");
    const booking = await createTicketedBooking(a.id);
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: a.id,
    });
    await assert.rejects(
      () => journeyService.getWatchForUser(b.id, watch.id),
      (err) => err.statusCode === 403,
    );
  });

  it("unconfigured provider poll does not fabricate events", async () => {
    resetStatusFetcherForTests();
    process.env.JOURNEY_STATUS_PROVIDER = "unconfigured";
    const user = await createUser("uncfg");
    const booking = await createTicketedBooking(user.id, {
      departAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const result = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.equal(result.dataStatus, "UNCONFIGURED");
    assert.equal(result.isFact, false);
    assert.equal(result.events.length, 0);
    assert.ok(result.watch.lastPolledAt);
  });

  it("detects delay once and dedupes on second poll", async () => {
    process.env.NODE_ENV = "test";
    setStatusFetcherForTests(async () => ({
      status: "DELAYED",
      minutesDelayed: 40,
      gate: "C3",
      observedAt: new Date().toISOString(),
      source: "test",
    }));
    const user = await createUser("delay");
    const booking = await createTicketedBooking(user.id, {
      departAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const first = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.ok(first.events.length >= 1);
    assert.ok(first.events.some((e) => e.type === "DELAY" || e.type === "GATE_CHANGE"));
    const second = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.equal(second.events.length, 0);
    resetStatusFetcherForTests();
  });

  it("cancellation triggers JOURNEY_DISRUPTION escalation intent", async () => {
    process.env.NODE_ENV = "test";
    setStatusFetcherForTests(async () => ({
      status: "CANCELLED",
      observedAt: new Date().toISOString(),
      source: "test",
    }));
    const user = await createUser("cx");
    const booking = await createTicketedBooking(user.id, {
      departAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const result = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.ok(result.events.some((e) => e.type === "CANCELLED"));
    const esc = await journeyService.escalateJourneyDisruption({
      userId: user.id,
      watchId: watch.id,
      reason: "test cancel",
    });
    assert.equal(esc.trigger, "JOURNEY_DISRUPTION");
    assert.equal(esc.auditOnly, true);
    resetStatusFetcherForTests();
  });

  it("rebooking handoff never auto-books or charges", async () => {
    const user = await createUser("rebook");
    const booking = await createTicketedBooking(user.id);
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const snap = await prisma.supplierOfferSnapshot.create({
      data: {
        userId: user.id,
        supplierCode: "GALILEO",
        supplierOfferId: `offer-${suffix}`,
        product: "FLIGHT",
        currency: "PKR",
        netMinor: 40000,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ttlMs: 600000,
      },
    });
    const handoff = await journeyService.prepareRebookingHandoff(user.id, watch.id, {
      supplierOfferSnapshotId: snap.id,
    });
    assert.equal(handoff.autoBooked, false);
    assert.equal(handoff.charged, false);
    assert.equal(handoff.action, "CREATE_QUOTE_REQUIRED");
  });

  it("alternatives require attributed OD/date and never auto-book", async () => {
    const user = await createUser("alt");
    const booking = await createTicketedBooking(user.id);
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const alt = await journeyService.discoverDisruptionAlternatives(user.id, watch.id);
    assert.equal(alt.autoBooked, false);
    assert.equal(alt.available, true);
    assert.ok(Array.isArray(alt.offers));
  });

  it("Ava journey context never invents live status when unconfigured", async () => {
    process.env.JOURNEY_STATUS_PROVIDER = "unconfigured";
    const user = await createUser("ava");
    const booking = await createTicketedBooking(user.id);
    await journeyService.ensureWatchForBooking({ bookingId: booking.id, userId: user.id });
    const ctx = await journeyService.getAvaJourneyContext(user.id);
    assert.ok(ctx.capability.weather);
    assert.ok(ctx.capability.hotel);
    assert.ok(ctx.promptBlock.includes("unconfigured") || ctx.promptBlock.includes("canPollLive=false"));
    assert.ok(ctx.promptBlock.includes("Never invent") || ctx.promptBlock.includes("do not invent"));
  });

  it("worker-style poll is idempotent when status unchanged", async () => {
    process.env.NODE_ENV = "test";
    let calls = 0;
    setStatusFetcherForTests(async () => {
      calls += 1;
      return {
        status: "SCHEDULED",
        gate: "D1",
        observedAt: new Date().toISOString(),
        source: "test",
      };
    });
    const user = await createUser("idem");
    const booking = await createTicketedBooking(user.id, {
      departAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const p1 = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    const p2 = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    // First poll may emit GATE_CHANGE from empty→D1; second must be idle.
    assert.equal(p2.events.length, 0);
    assert.ok(calls >= 2);
    resetStatusFetcherForTests();
  });

  it("weather disruption notifies once and dedupes", async () => {
    process.env.NODE_ENV = "test";
    const {
      setAncillaryFetcherForTests,
      resetAncillaryFetchersForTests,
    } = await import("./journey.ancillaryProviders.js");
    setAncillaryFetcherForTests("weather", async () => ({
      alertId: "wx-dedupe",
      title: "Storm near DXB",
      summary: "Attributed storm alert",
      severity: "HIGH",
      airportCode: "DXB",
      observedAt: new Date().toISOString(),
      source: "test",
    }));
    const user = await createUser("wx");
    const booking = await createTicketedBooking(user.id, {
      departAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const first = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.ok(first.events.some((e) => e.type === "WEATHER"));
    const second = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.equal(second.events.filter((e) => e.type === "WEATHER").length, 0);
    resetAncillaryFetchersForTests();
  });

  it("hotel check-in reminder from booking date; live hotel status fail-closed", async () => {
    process.env.NODE_ENV = "test";
    process.env.JOURNEY_HOTEL_STATUS_PROVIDER = "unconfigured";
    const user = await createUser("hotel");
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        status: "TICKETED",
        product: "HOTEL",
        currency: "PKR",
        amountMinor: 20000,
        netMinor: 18000,
        marginMinor: 2000,
        externalRef: `HTL${suffix}`,
        metadata: {
          checkInDate: new Date(Date.now() + 6 * 3600_000).toISOString(),
          destinationCountry: "AE",
          hotel: { cityCode: "DXB", confirmationRef: "RH-1" },
        },
      },
    });
    bookings.push(booking.id);
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const result = await journeyService.pollWatch(watch.id, {
      channels: ["APP"],
      now: new Date(),
    });
    assert.ok(result.events.some((e) => e.type === "HOTEL_CHECKIN"));
    assert.equal(result.watch.metadata?.lastHotelPoll?.dataStatus, "UNCONFIGURED");
  });

  it("transfer reminder from booking pickup; immigration unconfigured safe", async () => {
    process.env.NODE_ENV = "test";
    process.env.JOURNEY_TRANSFER_STATUS_PROVIDER = "unconfigured";
    process.env.JOURNEY_IMMIGRATION_PROVIDER = "unconfigured";
    const user = await createUser("xfer");
    const booking = await createTicketedBooking(user.id, {
      departAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      destinationCountry: "AE",
      transfer: {
        ref: "TR-9",
        pickupAt: new Date(Date.now() + 90 * 60_000).toISOString(),
      },
      transferPickupAt: new Date(Date.now() + 90 * 60_000).toISOString(),
      transferRef: "TR-9",
    });
    const watch = await journeyService.ensureWatchForBooking({
      bookingId: booking.id,
      userId: user.id,
    });
    const result = await journeyService.pollWatch(watch.id, { channels: ["APP"] });
    assert.ok(result.events.some((e) => e.type === "TRANSFER"));
    assert.equal(result.ancillary?.immigration, "UNCONFIGURED");
  });

  it("capability exposes flight + ancillary providers", () => {
    const cap = journeyService.getJourneyCapability({
      JOURNEY_STATUS_PROVIDER: "unconfigured",
      JOURNEY_WEATHER_PROVIDER: "unconfigured",
      JOURNEY_HOTEL_STATUS_PROVIDER: "unconfigured",
      JOURNEY_TRANSFER_STATUS_PROVIDER: "unconfigured",
      JOURNEY_IMMIGRATION_PROVIDER: "unconfigured",
    });
    assert.equal(cap.canPollLive, false);
    assert.equal(cap.weather.canPollLive, false);
    assert.equal(cap.hotel.canPollLive, false);
    assert.ok(cap.notificationChannels.includes("WHATSAPP"));
  });
});
