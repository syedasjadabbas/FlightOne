/**
 * Module 03 — search → SupplierOfferSnapshot → quote foundation.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

delete process.env.ALLOW_SIMULATED_BOOKING;

const TRAVELPORT_ENV_KEYS = [
  "TRAVELPORT_USERNAME",
  "TRAVELPORT_PASSWORD",
  "TRAVELPORT_CLIENT_ID",
  "TRAVELPORT_CLIENT_SECRET",
  "TRAVELPORT_ACCESS_GROUP",
  "TRAVELPORT_PCC",
];
const savedTravelportEnv = {};

const { default: prisma } = await import("../../config/prisma.js");
const suppliersService = await import("./suppliers.service.js");
const bookingsService = await import("../bookings/bookings.service.js");
const { buildSnapshotPayload } = await import("./suppliers.service.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.search.${label}.${suffix}@example.com`,
      name: `Search ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

before(async () => {
  for (const key of TRAVELPORT_ENV_KEYS) {
    savedTravelportEnv[key] = process.env[key];
    delete process.env[key];
  }
  await prisma.$queryRaw`SELECT 1`;
  for (const [key, valueInt] of [
    ["default_markup_bps", 900],
    ["flight_default_markup_bps", 900],
  ]) {
    await prisma.pricingConfig.upsert({
      where: { key },
      update: { valueInt },
      create: { key, valueInt },
    });
  }
  const { invalidatePricingLookupCache } = await import("../pricing/pricing.service.js");
  invalidatePricingLookupCache();
});

after(async () => {
  for (const key of TRAVELPORT_ENV_KEYS) {
    if (savedTravelportEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedTravelportEnv[key];
  }
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 03 supplier search snapshots", () => {
  it("returns offers without snapshotId when userId is omitted", async () => {
    const offers = await suppliersService.search({
      product: "FLIGHT",
      query: {
        origin: "LHE",
        destination: "DXB",
        departureDate: "2026-12-01",
        cabinClass: "ECONOMY",
      },
    });

    assert.ok(offers.length >= 1);
    assert.equal(offers[0].supplierOfferSnapshotId, undefined);
    assert.equal(offers[0].snapshotId, undefined);
  });

  it("persists real stub offers and returns snapshotId for booking", async () => {
    const user = await createUser("persist");
    const offers = await suppliersService.search({
      product: "FLIGHT",
      query: {
        origin: "ISB",
        destination: "JED",
        departureDate: "2026-12-01",
        cabinClass: "ECONOMY",
      },
      userId: user.id,
    });

    assert.ok(offers.length >= 1);
    const offer = offers[0];
    assert.ok(offer.snapshotId);
    assert.equal(offer.supplierOfferSnapshotId, offer.snapshotId);
    assert.ok(Number.isInteger(offer.sellAmountMinor));
    assert.ok(offer.sellAmountMinor > offer.amountMinor);
    assert.equal(offer.pricing?.netMinor, offer.amountMinor);
    assert.equal(offer.pricing?.amountMinor, offer.sellAmountMinor);
    assert.ok(offer.supplierBookingRefs?.booking);
    assert.ok(offer.itinerarySnapshot);
    assert.ok(offer.fareRulesSnapshot);

    const row = await prisma.supplierOfferSnapshot.findFirst({
      where: { id: offer.snapshotId, userId: user.id },
    });
    assert.ok(row);
    assert.equal(row.supplierOfferId, offer.offerId);
    assert.equal(row.netMinor, offer.amountMinor);
    assert.deepEqual(row.supplierBookingRefs, offer.supplierBookingRefs);
  });

  it("live/simulated search offer → snapshot → priced QUOTED booking", async () => {
    const user = await createUser("quote-chain");
    const offers = await suppliersService.search({
      product: "FLIGHT",
      query: {
        origin: "ISB",
        destination: "JED",
        departureDate: "2026-12-15",
        cabinClass: "ECONOMY",
      },
      userId: user.id,
    });

    const offer = offers[0];
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: offer.currency,
      supplierOfferSnapshotId: offer.snapshotId,
      route: `${offer.details.origin}-${offer.details.destination}`,
      cabin: offer.details.cabinClass ?? "ECONOMY",
      idempotencyKey: `search-chain-${suffix}`,
    });

    assert.equal(booking.status, "QUOTED");
    assert.equal(booking.supplierOfferSnapshotId, offer.snapshotId);
    assert.equal(booking.supplierOfferId, offer.offerId);
    assert.equal(booking.netMinor, offer.amountMinor);
    assert.equal(booking.amountMinor, Math.round(offer.amountMinor * 1.09));
    assert.ok(booking.fareRules);
  });

  it("buildSnapshotPayload preserves itinerary/fare separation", () => {
    const payload = buildSnapshotPayload({
      supplierCode: "GALILEO",
      offerId: "TP-test",
      product: "FLIGHT",
      currency: "USD",
      amountMinor: 50000,
      fareRules: { brandRef: "BR1", refundable: true },
      details: {
        origin: "LHE",
        destination: "DXB",
        transactionId: "tx-1",
        productRef: "prod-1",
        offeringId: "offering-real",
        flightRefs: ["f1"],
        segments: [{ carrier: "PK", originCode: "LHE", destinationCode: "DXB" }],
      },
    });

    assert.ok(payload.booking);
    assert.equal(payload.booking.transactionId, "tx-1");
    assert.equal(payload.booking.offeringId, "offering-real");
    assert.equal(payload.booking.flightRefs?.[0], "f1");
    assert.ok(payload.itinerary);
    assert.equal(payload.itinerary.origin, "LHE");
    assert.ok(Array.isArray(payload.itinerary.segments));
    assert.equal(payload.fare.brandRef, "BR1");
    assert.equal(payload.fare.refundable, true);
  });
});
