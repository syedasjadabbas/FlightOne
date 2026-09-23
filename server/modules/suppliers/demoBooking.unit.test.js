import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SUPPLIER_CODE,
  getSupplierBookingCapability,
  reserveSupplierInventory,
  revalidateSupplierOffer,
  ticketSupplierInventory,
} from "./supplierBooking.js";

/**
 * Demo fares reserve/ticket without a supplier call, so the gate around that
 * capability is the part that matters: it must be inert unless demo mode is
 * explicitly on, and must NEVER open in production.
 */

const booking = () => ({
  supplierCode: DEMO_SUPPLIER_CODE,
  product: "FLIGHT",
  id: "cmudtkwqt0003lq7711l0wx3a",
  currency: "PKR",
  netMinor: 19075000,
});

describe("demo supplier booking capability", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevDemo = process.env.DEMO_FLIGHT_INVENTORY;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });
  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    if (prevDemo === undefined) delete process.env.DEMO_FLIGHT_INVENTORY;
    else process.env.DEMO_FLIGHT_INVENTORY = prevDemo;
  });

  it("reserves and tickets locally when demo mode is on", async () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    const cap = getSupplierBookingCapability(DEMO_SUPPLIER_CODE, booking());
    assert.equal(cap.canReserve, true);
    assert.equal(cap.canTicket, true);

    const reserved = await reserveSupplierInventory(booking());
    assert.equal(reserved.status, "ok");
    // The reference must be obviously non-real wherever it surfaces.
    assert.match(reserved.externalRef, /^DEMO-/);

    const ticketed = await ticketSupplierInventory({ ...booking(), externalRef: reserved.externalRef });
    assert.equal(ticketed.status, "ok");
    assert.match(ticketed.ticketNumbers[0], /^DEMO-/);
  });

  it("echoes the snapshot fare on revalidation instead of inventing one", async () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    const result = await revalidateSupplierOffer(booking());
    assert.equal(result.status, "ok");
    assert.equal(result.netMinor, 19075000);
    assert.equal(result.currency, "PKR");
  });

  it("is unconfigured when demo mode is off", async () => {
    delete process.env.DEMO_FLIGHT_INVENTORY;
    const cap = getSupplierBookingCapability(DEMO_SUPPLIER_CODE, booking());
    assert.equal(cap.canReserve, false);
    assert.equal(cap.canTicket, false);
    assert.equal((await reserveSupplierInventory(booking())).status, "unconfigured");
    assert.equal((await ticketSupplierInventory(booking())).status, "unconfigured");
  });

  it("never opens in production, even with the flag set", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    const cap = getSupplierBookingCapability(DEMO_SUPPLIER_CODE, booking());
    assert.equal(cap.canReserve, false);
    assert.equal(cap.canTicket, false);
    assert.equal((await reserveSupplierInventory(booking())).status, "unconfigured");
    assert.equal((await ticketSupplierInventory(booking())).status, "unconfigured");
  });

  it("still rejects a genuinely unknown supplier", () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    const cap = getSupplierBookingCapability("SOME_OTHER_GDS", { product: "FLIGHT" });
    assert.equal(cap.canReserve, false);
    assert.match(cap.reasons.join(" "), /No booking adapter registered/);
  });
});
