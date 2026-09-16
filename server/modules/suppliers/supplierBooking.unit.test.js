/**
 * Module 03 foundation — supplier booking capability + state-machine safety.
 * Run: node --test modules/suppliers/supplierBooking.unit.test.js modules/bookings/bookings.unit.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPLIER_BOOKING_UNCONFIGURED,
  SUPPLIER_TICKETING_UNCONFIGURED,
  getSupplierBookingCapability,
  inspectTravelportAirPriceBoundary,
  revalidateSupplierOffer,
  reserveSupplierInventory,
  ticketSupplierInventory,
  assertSupplierCanReserve,
  assertSupplierCanTicket,
} from "../suppliers/supplierBooking.js";

describe("supplierBooking capability (default unconfigured)", () => {
  const prevSim = process.env.ALLOW_SIMULATED_BOOKING;
  const prevTpUser = process.env.TRAVELPORT_USERNAME;

  before(() => {
    delete process.env.ALLOW_SIMULATED_BOOKING;
    delete process.env.TRAVELPORT_USERNAME;
  });

  after(() => {
    if (prevSim === undefined) delete process.env.ALLOW_SIMULATED_BOOKING;
    else process.env.ALLOW_SIMULATED_BOOKING = prevSim;
    if (prevTpUser === undefined) delete process.env.TRAVELPORT_USERNAME;
    else process.env.TRAVELPORT_USERNAME = prevTpUser;
  });

  it("reports Galileo book as unconfigured; ticket only when live Travelport is available", () => {
    const cap = getSupplierBookingCapability("GALILEO");
    assert.equal(cap.mode, "unconfigured");
    assert.equal(cap.canReserve, false);
    assert.equal(cap.canTicket, false);
    assert.equal(cap.canRevalidateLive, false);
    assert.ok(cap.reasons.some((r) => /not configured|unconfigured|not wired/i.test(r)));
  });

  it("reports RateHawk booking unconfigured", () => {
    const cap = getSupplierBookingCapability("RATEHAWK");
    assert.equal(cap.canReserve, false);
    assert.equal(cap.canTicket, false);
  });

  it("revalidate/reserve/ticket helpers never invent refs when unconfigured", async () => {
    const booking = {
      supplierCode: "GALILEO",
      netMinor: 10000,
      currency: "USD",
      externalRef: null,
    };
    const rv = await revalidateSupplierOffer(booking);
    assert.equal(rv.status, "unconfigured");
    const hold = await reserveSupplierInventory(booking);
    assert.equal(hold.status, "unconfigured");
    assert.equal(hold.externalRef, undefined);
    const ticket = await ticketSupplierInventory(booking);
    assert.equal(ticket.status, "unconfigured");

    const boundary = inspectTravelportAirPriceBoundary({
      supplierBookingRefs: {
        booking: {
          transactionId: "tx-1",
          offeringId: "off-1",
          productRef: "prod-1",
        },
      },
    });
    assert.equal(boundary.configured, false);
    assert.equal(boundary.hasSupplierRefs, true);
    assert.equal(boundary.canAttemptLiveAirPrice, false);
    assert.equal(boundary.endpoint, "/price/offers/buildfromcatalogproductofferings");

    assert.throws(
      () => assertSupplierCanReserve(booking),
      (err) => err.statusCode === 503 && err.code === SUPPLIER_BOOKING_UNCONFIGURED,
    );
    assert.throws(
      () => assertSupplierCanTicket(booking),
      (err) => err.statusCode === 503 && err.code === SUPPLIER_TICKETING_UNCONFIGURED,
    );
  });
});

describe("supplierBooking simulated opt-in (non-production)", () => {
  const prevSim = process.env.ALLOW_SIMULATED_BOOKING;
  const prevEnv = process.env.NODE_ENV;
  const prevTp = {};
  const TP_KEYS = [
    "TRAVELPORT_USERNAME",
    "TRAVELPORT_PASSWORD",
    "TRAVELPORT_CLIENT_ID",
    "TRAVELPORT_CLIENT_SECRET",
    "TRAVELPORT_ACCESS_GROUP",
    "TRAVELPORT_PCC",
  ];

  before(() => {
    process.env.ALLOW_SIMULATED_BOOKING = "true";
    process.env.NODE_ENV = "test";
    for (const key of TP_KEYS) {
      prevTp[key] = process.env[key];
      delete process.env[key];
    }
  });

  after(() => {
    if (prevSim === undefined) delete process.env.ALLOW_SIMULATED_BOOKING;
    else process.env.ALLOW_SIMULATED_BOOKING = prevSim;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
    for (const key of TP_KEYS) {
      if (prevTp[key] === undefined) delete process.env[key];
      else process.env[key] = prevTp[key];
    }
  });

  it("allows simulated reserve without inventing PNRs; ticketing stays blocked", async () => {
    const booking = { supplierCode: "GALILEO", netMinor: 1, currency: "USD", externalRef: null };
    const cap = getSupplierBookingCapability("GALILEO");
    assert.equal(cap.mode, "simulated");
    assert.equal(cap.canReserve, true);
    assert.equal(cap.canTicket, false);
    const hold = await reserveSupplierInventory(booking);
    assert.equal(hold.status, "simulated");
    assert.equal(hold.externalRef, null);
    assert.ok(hold.details?.warning);
    const ticket = await ticketSupplierInventory(booking);
    assert.equal(ticket.status, "unconfigured");
  });
});
