/**
 * Module 03 booking foundation — quote + honest reserve/ticket blocking.
 * Requires DATABASE_URL. Does not enable ALLOW_SIMULATED_BOOKING.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

// Ensure reserve/ticket stay blocked for this suite.
delete process.env.ALLOW_SIMULATED_BOOKING;

const { default: prisma } = await import("../../config/prisma.js");
const bookingsService = await import("./bookings.service.js");
const { SUPPLIER_BOOKING_UNCONFIGURED, SUPPLIER_REVALIDATE_UNCONFIGURED } =
  await import("../suppliers/supplierBooking.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.booking.${label}.${suffix}@example.com`,
      name: `Booking ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

async function createSupplierSnapshot({
  userId,
  product = "FLIGHT",
  supplierCode,
  supplierOfferId,
  currency = "USD",
  netMinor,
  supplierBookingRefs,
  expiresAt,
  ttlMs,
}) {
  const ttl = ttlMs ?? 60_000;
  const exp = expiresAt ?? new Date(Date.now() + ttl);
  return prisma.supplierOfferSnapshot.create({
    data: {
      userId,
      product,
      supplierCode,
      supplierOfferId,
      currency,
      netMinor,
      supplierBookingRefs:
        supplierBookingRefs ??
        ({
          transactionId: "t-snap-1",
          combinabilityCode: "C1",
          productRef: "p-1",
          brandRef: "b-1",
          flightRefs: ["f-1", "f-2"],
          returnFlightRefs: null,
          contentSource: "GDS",
        }),
      ttlMs: ttl,
      expiresAt: exp,
    },
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  const pricingKeys = [
    ["default_markup_bps", 900],
    ["flight_default_markup_bps", 900],
    ["hotel_default_markup_bps", 1400],
  ];
  for (const [key, valueInt] of pricingKeys) {
    await prisma.pricingConfig.upsert({
      where: { key },
      update: { valueInt },
      create: { key, valueInt },
    });
  }
  // Retired demo rule — booking tests must not depend on it (see seed.js /
  // pricing.service.unit.test.js). Keep suite isolated on product defaults.
  await prisma.markupRule.updateMany({
    where: { name: "Default LHE route markup (sample)", isActive: true },
    data: { isActive: false },
  });
  const { invalidatePricingLookupCache } = await import("../pricing/pricing.service.js");
  invalidatePricingLookupCache();
});

after(async () => {
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 03 booking foundation (integration) — unconfigured revalidation", () => {
  const prevSim = process.env.ALLOW_SIMULATED_BOOKING;
  const prevPay = process.env.ALLOW_SIMULATED_PAYMENT;

  before(() => {
    delete process.env.ALLOW_SIMULATED_BOOKING;
    delete process.env.ALLOW_SIMULATED_PAYMENT;
  });

  after(() => {
    if (prevSim === undefined) delete process.env.ALLOW_SIMULATED_BOOKING;
    else process.env.ALLOW_SIMULATED_BOOKING = prevSim;
    if (prevPay === undefined) delete process.env.ALLOW_SIMULATED_PAYMENT;
    else process.env.ALLOW_SIMULATED_PAYMENT = prevPay;
  });
  it("valid supplier snapshot → priced QUOTED booking (user-scoped)", async () => {
    const user = await createUser("quote");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });

    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
      idempotencyKey: `quote-${suffix}-a`,
      metadata: { offerId: "offer-test-1" },
    });

    assert.equal(booking.status, "QUOTED");
    assert.equal(booking.userId, user.id);
    assert.equal(booking.netMinor, 10000);
    assert.equal(booking.supplierOfferSnapshotId, snapshot.id);
    assert.equal(booking.supplierOfferId, snapshot.supplierOfferId);
    assert.deepEqual(booking.supplierBookingRefs, snapshot.supplierBookingRefs);
    assert.ok(booking.amountMinor >= booking.netMinor);
    assert.ok(booking.marginMinor >= 0);
    assert.ok(booking.metadata?.pricing?.input);

    const again = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      idempotencyKey: `quote-${suffix}-a`,
    });
    assert.equal(again.id, booking.id);
  });

  it("rejects missing supplier offer reference", async () => {
    const user = await createUser("missing-snapshot");
    await assert.rejects(
      () =>
        bookingsService.createQuote(user.id, {
          product: "FLIGHT",
          currency: "USD",
          route: "LHE-DXB",
          cabin: "ECONOMY",
        }),
      (err) => err.statusCode === 409 && /supplier offer reference/i.test(err.message),
    );
  });

  it("applies authoritative 9% flight markup when no MarkupRule matches", async () => {
    const user = await createUser("flight-markup-default");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });

    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
    });

    assert.equal(booking.netMinor, 10000);
    assert.equal(booking.amountMinor, Math.round(10000 * 1.09));
    assert.equal(booking.metadata?.pricing?.appliedRules?.[0]?.type, "DEFAULT_MARKUP");
    assert.equal(booking.metadata?.pricing?.appliedRules?.[0]?.markupBps, 900);
  });

  it("ignores client-supplied netMinor/amountMinor and prices from supplier snapshot", async () => {
    const user = await createUser("netminor-manipulation");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-7000",
      currency: "USD",
      netMinor: 7000,
    });

    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      // Manipulated by the client; should not affect authoritative supplier pricing.
      netMinor: 999999,
      amountMinor: 1,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    assert.equal(booking.netMinor, 7000);
    // Authoritative flight default (900 bps). Legacy seed "Default LHE route
    // markup (sample)" at 1250 bps was retired — do not reintroduce it here.
    assert.equal(booking.amountMinor, Math.round(7000 * 1.09));
    assert.equal(booking.metadata?.pricing?.appliedRules?.[0]?.type, "DEFAULT_MARKUP");
  });

  it("isolates bookings between users", async () => {
    const a = await createUser("iso-a");
    const b = await createUser("iso-b");
    const snapshotA = await createSupplierSnapshot({
      userId: a.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-20000",
      currency: "USD",
      netMinor: 20000,
    });

    const booking = await bookingsService.createQuote(a.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshotA.id,
      metadata: { forceClientPrice: true },
      amountMinor: 21800,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await assert.rejects(
      () => bookingsService.getBookingById(b.id, booking.id),
      (err) => err.statusCode === 404,
    );
    await assert.rejects(
      () =>
        bookingsService.reserveBooking(b.id, booking.id, {
          clientAmountMinor: booking.amountMinor,
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("blocks reserve when supplier revalidation is unconfigured (no fake hold)", async () => {
    const user = await createUser("block-reserve");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-15000",
      currency: "USD",
      netMinor: 15000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
    });

    await assert.rejects(
      () =>
        bookingsService.reserveBooking(user.id, booking.id, {
          clientAmountMinor: booking.amountMinor,
        }),
      (err) =>
        err.statusCode === 503 &&
        (err.code === SUPPLIER_BOOKING_UNCONFIGURED ||
          err.code === SUPPLIER_REVALIDATE_UNCONFIGURED),
    );

    const loaded = await bookingsService.getBookingById(user.id, booking.id);
    assert.equal(loaded.status, "QUOTED");
    assert.equal(loaded.externalRef, null);
  });

  it("blocks reserve when the quote TTL is expired (409)", async () => {
    const user = await createUser("expired-reserve");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { quoteExpiresAt: new Date(Date.now() - 1000) },
    });

    await assert.rejects(
      () =>
        bookingsService.reserveBooking(user.id, booking.id, {
          clientAmountMinor: booking.amountMinor,
        }),
      (err) => err.statusCode === 409 && /quote expired/i.test(err.message),
    );
  });

  it("blocks ticket when the quote TTL is expired (409)", async () => {
    const user = await createUser("expired-ticket");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });
    const quote = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await prisma.booking.update({
      where: { id: quote.id },
      data: {
        status: "RESERVED",
        reservedUntil: new Date(Date.now() + 60_000),
        quoteExpiresAt: new Date(Date.now() - 1000),
      },
    });

    await assert.rejects(
      () =>
        bookingsService.ticketBooking(user.id, quote.id, {
          clientAmountMinor: quote.amountMinor,
        }),
      (err) => err.statusCode === 409 && /quote expired/i.test(err.message),
    );
  });
});

describe("Module 03 booking foundation (integration) — simulated revalidation", () => {
  const prevSim = process.env.ALLOW_SIMULATED_BOOKING;
  const prevPay = process.env.ALLOW_SIMULATED_PAYMENT;
  const prevEnv = process.env.NODE_ENV;

  before(() => {
    process.env.ALLOW_SIMULATED_BOOKING = "true";
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    process.env.NODE_ENV = "test";
  });

  after(() => {
    if (prevSim === undefined) delete process.env.ALLOW_SIMULATED_BOOKING;
    else process.env.ALLOW_SIMULATED_BOOKING = prevSim;
    if (prevPay === undefined) delete process.env.ALLOW_SIMULATED_PAYMENT;
    else process.env.ALLOW_SIMULATED_PAYMENT = prevPay;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  });

  it("client price manipulation on reserve is rejected (409 price changed)", async () => {
    const user = await createUser("client-drift");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-8000",
      currency: "USD",
      netMinor: 8000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await assert.rejects(
      () =>
        bookingsService.reserveBooking(user.id, booking.id, {
          clientAmountMinor: booking.amountMinor + 1,
        }),
      (err) => err.statusCode === 409 && /price changed/i.test(err.message),
    );
  });

  it("changed supplier price blocks booking honesty (409)", async () => {
    const user = await createUser("supplier-drift");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000->11000",
      currency: "USD",
      netMinor: 10000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await assert.rejects(
      () =>
        bookingsService.reserveBooking(user.id, booking.id, {
          clientAmountMinor: booking.amountMinor,
        }),
      (err) =>
        err.statusCode === 409 &&
        /price changed/i.test(err.message) &&
        err.code === "PRICE_CHANGED" &&
        Number.isInteger(err.details?.newAmountMinor) &&
        err.details.newAmountMinor !== booking.amountMinor,
    );
  });

  it("acceptPriceChange updates quote to authoritative reprice before continue", async () => {
    const user = await createUser("accept-price");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000->11000",
      currency: "USD",
      netMinor: 10000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    let newAmountMinor = null;
    await assert.rejects(
      () =>
        bookingsService.reserveBooking(user.id, booking.id, {
          clientAmountMinor: booking.amountMinor,
        }),
      (err) => {
        if (err.statusCode === 409 && err.code === "PRICE_CHANGED") {
          newAmountMinor = err.details?.newAmountMinor;
          return Number.isInteger(newAmountMinor);
        }
        return false;
      },
    );

    const accepted = await bookingsService.acceptPriceChange(user.id, booking.id, {
      acceptedAmountMinor: newAmountMinor,
    });
    assert.equal(accepted.amountMinor, newAmountMinor);
    assert.equal(accepted.netMinor, 11_000);
    assert.ok(accepted.metadata?.priceAcceptedAt);
  });

  it("failed/unavailable simulated revalidation blocks booking honestly (409)", async () => {
    const user = await createUser("reval-unavailable");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-UNAVAILABLE",
      currency: "USD",
      netMinor: 10000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await assert.rejects(
      () =>
        bookingsService.reserveBooking(user.id, booking.id, {
          clientAmountMinor: booking.amountMinor,
        }),
      (err) => err.statusCode === 409 && /unavailable/i.test(err.message),
    );
  });

  it("successful revalidation + margin validation allows reserve (RESERVED)", async () => {
    const user = await createUser("success-reval");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });

    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });

    await bookingsService.payBooking(user.id, booking.id, { paymentMethodToken: "pm_test_ok" });
    const reserved = await bookingsService.reserveBooking(user.id, booking.id, {});

    assert.equal(reserved.status, "RESERVED");
    assert.equal(reserved.externalRef, null);
    assert.equal(reserved.metadata?.pricing?.netMinor, 10000);
    // Authoritative flight default (900 bps); LHE sample MarkupRule is retired.
    assert.equal(reserved.amountMinor, Math.round(10000 * 1.09));
    assert.equal(reserved.metadata?.supplierBooking?.reserve?.status, "simulated");
  });

  it("reserve succeeds without clientAmountMinor when server price is authoritative", async () => {
    const user = await createUser("no-client-price");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-8000",
      currency: "USD",
      netMinor: 8000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
    });

    await bookingsService.payBooking(user.id, booking.id, { paymentMethodToken: "pm_test_ok" });
    const reserved = await bookingsService.reserveBooking(user.id, booking.id, {});
    assert.equal(reserved.status, "RESERVED");
    assert.equal(reserved.amountMinor, Math.round(8000 * 1.09));
  });

  it("user isolation: cannot quote a snapshot owned by another user (409)", async () => {
    const a = await createUser("iso-quote-a");
    const b = await createUser("iso-quote-b");
    const snapshotA = await createSupplierSnapshot({
      userId: a.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-5000",
      currency: "USD",
      netMinor: 5000,
    });

    await assert.rejects(
      () =>
        bookingsService.createQuote(b.id, {
          product: "FLIGHT",
          currency: "USD",
          supplierOfferSnapshotId: snapshotA.id,
          route: "LHE-DXB",
          cabin: "ECONOMY",
        }),
      (err) => err.statusCode === 409 && /invalid supplier offer reference/i.test(err.message),
    );
  });

  it("quote path: agent without discount authority cannot apply discretionary discount", async () => {
    const user = await createUser("agent-disc-none");
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });
    await assert.rejects(
      () =>
        bookingsService.createQuote(user.id, {
          product: "FLIGHT",
          currency: "USD",
          supplierOfferSnapshotId: snapshot.id,
          route: "ISB-JED",
          cabin: "ECONOMY",
          requestedDiscountBps: 100,
        }),
      (err) =>
        err.statusCode === 403 &&
        err.code === "AGENT_DISCOUNT_UNAUTHORIZED" &&
        err.message === "Forbidden",
    );
  });

  it("quote + revalidate paths: agent within tier discount is enforced consistently", async () => {
    const { clearPermissionCache } = await import("../../lib/permissions.service.js");
    const { AGENT_DISCOUNT_TIER_PERMISSIONS } = await import("../pricing/pricing.constants.js");

    const user = await createUser("agent-disc-std");
    const perm = await prisma.permission.upsert({
      where: { key: AGENT_DISCOUNT_TIER_PERMISSIONS.STANDARD },
      update: {},
      create: {
        key: AGENT_DISCOUNT_TIER_PERMISSIONS.STANDARD,
        label: AGENT_DISCOUNT_TIER_PERMISSIONS.STANDARD,
      },
    });
    const role = await prisma.role.create({
      data: {
        name: `Agent Standard ${suffix}`,
        description: "test agent discount tier",
        permissions: { create: [{ permissionId: perm.id }] },
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    clearPermissionCache();

    await prisma.pricingConfig.upsert({
      where: { key: "agent_discount_standard_bps" },
      update: { valueInt: 200 },
      create: { key: "agent_discount_standard_bps", valueInt: 200 },
    });
    const { invalidatePricingLookupCache } = await import("../pricing/pricing.service.js");
    invalidatePricingLookupCache();

    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      currency: "USD",
      netMinor: 10000,
    });

    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      requestedDiscountBps: 150,
      idempotencyKey: `agent-disc-${suffix}`,
    });

    const disc = booking.metadata?.pricing?.appliedRules?.find(
      (r) => r.type === "REQUESTED_DISCOUNT",
    );
    assert.ok(disc);
    assert.equal(disc.appliedBps, 150);
    assert.equal(disc.agentAuthorityEnforced, true);

    // Over-tier on a fresh quote must fail the same way.
    await assert.rejects(
      () =>
        bookingsService.createQuote(user.id, {
          product: "FLIGHT",
          currency: "USD",
          supplierOfferSnapshotId: snapshot.id,
          route: "ISB-JED",
          cabin: "ECONOMY",
          requestedDiscountBps: 250,
        }),
      (err) => err.statusCode === 403 && err.code === "AGENT_DISCOUNT_UNAUTHORIZED",
    );

    await prisma.userRole.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.role.delete({ where: { id: role.id } }).catch(() => {});
  });
});
