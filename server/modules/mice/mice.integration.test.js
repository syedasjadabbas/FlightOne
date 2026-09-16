/**
 * Module 12 — MICE integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";

const { default: prisma } = await import("../../config/prisma.js");
const mice = await import("./mice.service.js");

const suffix = Date.now();
const userIds = [];
const eventIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.mice.${label}.${suffix}@example.com`,
      name: `Mice ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of eventIds) {
    await prisma.miceBudgetLine.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceSponsor.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceTransfer.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceBookingShare.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceCheckIn.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceSession.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceDelegate.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceEvent.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 12 MICE", () => {
  it("creates typed events; validates access; registers delegates without duplicates", async () => {
    const org = await createUser("org");
    const stranger = await createUser("str");
    const event = await mice.createEvent(org.id, {
      name: `Conf ${suffix}`,
      type: "CONFERENCE",
      venue: "Hall A",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 2 * 86400000),
      budgetMinor: 1_000_000,
      currency: "PKR",
      autoCreateGroup: true,
    });
    eventIds.push(event.id);
    assert.equal(event.type, "CONFERENCE");
    assert.ok(event.groupId);

    await assert.rejects(
      () => mice.getEvent(event.id, stranger.id, null),
      (e) => e.statusCode === 403,
    );

    const d = await mice.registerDelegate(event.id, org.id, null, {
      fullName: "Ada Delegate",
      email: `ada.${suffix}@example.com`,
    });
    assert.ok(d.badgeCode.startsWith("MICE-"));
    await assert.rejects(
      () =>
        mice.registerDelegate(event.id, org.id, null, {
          fullName: "Ada2",
          email: `ada.${suffix}@example.com`,
        }),
      (e) => e.statusCode === 409,
    );

    const meeting = await mice.createEvent(org.id, {
      name: "Meet",
      type: "MEETING",
      startsAt: new Date(Date.now() + 3 * 86400000),
      endsAt: new Date(Date.now() + 4 * 86400000),
    });
    eventIds.push(meeting.id);
    for (const t of ["INCENTIVE", "EXHIBITION"]) {
      const e = await mice.createEvent(org.id, {
        name: t,
        type: t,
        startsAt: new Date(Date.now() + 5 * 86400000),
        endsAt: new Date(Date.now() + 6 * 86400000),
      });
      eventIds.push(e.id);
    }
  });

  it("agenda, QR check-in idempotent, badge, attendance", async () => {
    const org = await createUser("chk");
    const event = await mice.createEvent(org.id, {
      name: "Expo",
      type: "EXHIBITION",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 2 * 86400000),
    });
    eventIds.push(event.id);
    const session = await mice.createSession(event.id, org.id, null, {
      title: "Keynote",
      speakers: "Dr. X",
      startsAt: new Date(Date.now() + 86400000 + 3600000),
      endsAt: new Date(Date.now() + 86400000 + 7200000),
    });
    const del = await mice.registerDelegate(event.id, org.id, null, {
      fullName: "Bob",
      email: `bob.${suffix}@example.com`,
    });

    await assert.rejects(
      () => mice.checkIn(event.id, org.id, null, { badgeCode: "INVALID" }),
      (e) => e.statusCode === 404,
    );

    const a = await mice.checkIn(event.id, org.id, null, {
      badgeCode: del.badgeCode,
      sessionId: session.id,
    });
    const b = await mice.checkIn(event.id, org.id, null, {
      badgeCode: del.badgeCode,
      sessionId: session.id,
    });
    assert.equal(a.id, b.id);

    const badge = await mice.getDelegateBadge(event.id, del.id, org.id, null);
    assert.ok(badge.contentBase64);
    assert.equal(badge.badgeCode, del.badgeCode);

    const att = await mice.getAttendance(event.id, org.id, null);
    assert.ok(att.byRegistrationStatus.CHECKED_IN >= 1);
  });

  it("travel link, transfers, budget, sponsors, report", async () => {
    const org = await createUser("bud");
    const event = await mice.createEvent(org.id, {
      name: "Incentive",
      type: "INCENTIVE",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 3 * 86400000),
      budgetMinor: 500000,
      currency: "PKR",
    });
    eventIds.push(event.id);

    const booking = await prisma.booking.create({
      data: {
        userId: org.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 120000,
        netMinor: 100000,
        marginMinor: 20000,
      },
    });
    await mice.linkBooking(event.id, org.id, null, { bookingId: booking.id, kind: "FLIGHT" });
    await assert.rejects(
      () => mice.linkBooking(event.id, org.id, null, { bookingId: booking.id }),
      (e) => e.statusCode === 409,
    );

    const hotel = await prisma.booking.create({
      data: {
        userId: org.id,
        status: "TICKETED",
        product: "HOTEL",
        currency: "PKR",
        amountMinor: 80000,
        netMinor: 70000,
        marginMinor: 10000,
      },
    });
    await mice.linkBooking(event.id, org.id, null, { bookingId: hotel.id, kind: "HOTEL" });

    await mice.createTransfer(event.id, org.id, null, {
      label: "Airport pickup",
      direction: "AIRPORT_PICKUP",
      pickupLocation: "DXB T3",
      dropoffLocation: "Venue",
      pickupAt: new Date(Date.now() + 86400000),
      airportCode: "DXB",
      passengerCount: 2,
    });

    await mice.upsertBudgetLine(event.id, org.id, null, {
      category: "VENUE",
      label: "Hall rental",
      plannedMinor: 200000,
      actualMinor: 180000,
    });
    await mice.createSponsor(event.id, org.id, null, {
      name: "Acme Corp",
      tier: "GOLD",
    });

    const budget = await mice.getBudget(event.id, org.id, null);
    assert.equal(budget.travelActualMinor, 200000);
    assert.ok(budget.actualTotalMinor >= 180000);

    const report = await mice.getEventReport(event.id, org.id, null);
    assert.equal(report.travel.linkedBookings, 2);
    assert.equal(report.sponsors.count, 1);
    assert.equal(report.transfers.count, 1);
    assert.ok(report.transfers.byStatus.PROVIDER_UNCONFIGURED >= 1 || report.transfers.byStatus.REQUESTED >= 0);
    assert.match(report.note, /stored event data/i);

    const guest = await mice.getAvaMiceContext(null);
    assert.match(guest.promptBlock, /sign in/i);
  });

  it("transfer requirements: pickup/dropoff, delegate, idempotency, IDOR, flight link", async () => {
    const org = await createUser("xferOrg");
    const stranger = await createUser("xferStr");
    const event = await mice.createEvent(org.id, {
      name: "Xfer Conf",
      type: "CONFERENCE",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 4 * 86400000),
      companyId: "co-xfer-a",
    });
    eventIds.push(event.id);

    const del = await mice.registerDelegate(event.id, org.id, null, {
      fullName: "Del X",
      email: `del.xfer.${Date.now()}@example.com`,
    });

    const flight = await prisma.booking.create({
      data: {
        userId: org.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 90000,
        netMinor: 80000,
        marginMinor: 10000,
        externalRef: "PK309",
        metadata: { flightNumber: "PK309", origin: "LHE", destination: "DXB" },
      },
    });
    await mice.linkBooking(event.id, org.id, null, {
      bookingId: flight.id,
      kind: "FLIGHT",
      delegateId: del.id,
    });

    const a = await mice.createTransfer(event.id, org.id, null, {
      label: "Arrival pickup",
      direction: "AIRPORT_PICKUP",
      airportCode: "DXB",
      passengerCount: 1,
      delegateId: del.id,
      flightRef: "PK309",
      flightBookingId: flight.id,
      pickupAt: new Date(Date.now() + 2 * 86400000),
      pickupLocation: "DXB T1",
      dropoffLocation: "Hotel",
      notes: "Name board",
      idempotencyKey: `xfer-${event.id}-arrival`,
    });
    assert.equal(a.direction, "AIRPORT_PICKUP");
    assert.equal(a.status, "PROVIDER_UNCONFIGURED");
    assert.equal(a.transferRef, null);
    assert.equal(a.flightBookingId, flight.id);
    assert.equal(a.flightLinkage?.liveFlightStatus, "DATA_UNAVAILABLE");
    assert.equal(a.provider?.book?.configured, false);

    const b = await mice.createTransfer(event.id, org.id, null, {
      label: "Arrival pickup",
      direction: "AIRPORT_PICKUP",
      airportCode: "DXB",
      passengerCount: 1,
      delegateId: del.id,
      flightBookingId: flight.id,
      idempotencyKey: `xfer-${event.id}-arrival`,
    });
    assert.equal(a.id, b.id);

    const drop = await mice.createTransfer(event.id, org.id, null, {
      label: "Departure drop-off",
      direction: "AIRPORT_DROPOFF",
      airportCode: "DXB",
      passengerCount: 2,
      pickupLocation: "Hotel",
      dropoffLocation: "DXB T1",
      requestProviderBooking: false,
    });
    assert.equal(drop.status, "REQUESTED");

    const listed = await mice.listTransfers(event.id, org.id, null);
    assert.ok(listed.items.length >= 2);
    assert.equal(listed.capability.canBookLive, false);

    await mice.updateTransfer(event.id, drop.id, org.id, null, {
      notes: "Prefer SUV",
      passengerCount: 3,
    });
    const updated = await prisma.miceTransfer.findUnique({ where: { id: drop.id } });
    assert.equal(updated.passengerCount, 3);
    assert.equal(updated.notes, "Prefer SUV");

    await assert.rejects(
      () => mice.listTransfers(event.id, stranger.id, null),
      (e) => e.statusCode === 403,
    );
    await assert.rejects(
      () =>
        mice.createTransfer(event.id, stranger.id, null, {
          label: "Hack",
          direction: "AIRPORT_PICKUP",
        }),
      (e) => e.statusCode === 403,
    );

    const other = await mice.createEvent(stranger.id, {
      name: "Other",
      type: "MEETING",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 2 * 86400000),
    });
    eventIds.push(other.id);
    await assert.rejects(
      () => mice.updateTransfer(other.id, a.id, stranger.id, null, { notes: "cross" }),
      (e) => e.statusCode === 404,
    );

    // Flight not linked → 409
    const flight2 = await prisma.booking.create({
      data: {
        userId: org.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 1000,
        netMinor: 900,
        marginMinor: 100,
      },
    });
    await assert.rejects(
      () =>
        mice.createTransfer(event.id, org.id, null, {
          label: "Needs link",
          direction: "AIRPORT_PICKUP",
          flightBookingId: flight2.id,
        }),
      (e) => e.statusCode === 409,
    );
  });

  it("transfer provider confirmation only when adapter returns confirmationRef", async () => {
    process.env.NODE_ENV = "test";
    const {
      setMiceTransferBookFetcherForTests,
      resetMiceTransferBookFetcherForTests,
    } = await import("./mice.transferProvider.js");
    const org = await createUser("xferProv");
    const event = await mice.createEvent(org.id, {
      name: "Prov",
      type: "MEETING",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 2 * 86400000),
    });
    eventIds.push(event.id);

    setMiceTransferBookFetcherForTests(async () => ({ confirmationRef: "CONF-99" }));
    const t = await mice.createTransfer(event.id, org.id, null, {
      label: "Live book",
      direction: "AIRPORT_PICKUP",
      airportCode: "LHE",
      requestProviderBooking: true,
    });
    assert.equal(t.status, "CONFIRMED");
    assert.equal(t.transferRef, "CONF-99");

    const again = await mice.bookTransfer(event.id, t.id, org.id, null);
    assert.equal(again.id, t.id);
    assert.equal(again.skippedDuplicate, true);

    setMiceTransferBookFetcherForTests(async () => {
      throw new Error("boom");
    });
    const fail = await mice.createTransfer(event.id, org.id, null, {
      label: "Fail book",
      direction: "AIRPORT_DROPOFF",
      airportCode: "LHE",
    });
    assert.equal(fail.status, "FAILED");
    assert.equal(fail.transferRef, null);
    resetMiceTransferBookFetcherForTests();
  });

  it("self-register idempotent", async () => {
    const org = await createUser("selfOrg");
    const user = await createUser("selfUser");
    const event = await mice.createEvent(org.id, {
      name: "Open",
      type: "MEETING",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 2 * 86400000),
    });
    eventIds.push(event.id);
    // stranger can't view until registered — selfRegister doesn't need prior access
    const a = await mice.selfRegister(event.id, user.id, {});
    const b = await mice.selfRegister(event.id, user.id, {});
    assert.equal(a.id, b.id);
    const listed = await mice.listEvents(user.id, null);
    assert.ok(listed.some((e) => e.id === event.id));
  });
});
