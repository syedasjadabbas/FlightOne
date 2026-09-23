import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { demoSnapshotSchema } from "./demoSnapshot.validators.js";

/**
 * The demo snapshot endpoint mints a priced fare, so its gate and its money
 * validation are the parts worth guarding.
 */

describe("demoSnapshotSchema", () => {
  const valid = {
    offerId: "DEMO-LHE-DXB-15OCT-01",
    currency: "pkr",
    netMinor: 6500000,
    itinerary: {
      origin: "lhe",
      destination: "dxb",
      departureDate: "2026-10-15",
    },
  };

  it("normalises currency and IATA codes to upper case", () => {
    const parsed = demoSnapshotSchema.parse(valid);
    assert.equal(parsed.currency, "PKR");
    assert.equal(parsed.itinerary.origin, "LHE");
    assert.equal(parsed.itinerary.destination, "DXB");
    assert.equal(parsed.product, "FLIGHT");
  });

  it("rejects a non-positive or fractional fare", () => {
    for (const netMinor of [0, -1, 1.5]) {
      assert.throws(() => demoSnapshotSchema.parse({ ...valid, netMinor }));
    }
  });

  it("rejects a malformed departure date", () => {
    assert.throws(() =>
      demoSnapshotSchema.parse({
        ...valid,
        itinerary: { ...valid.itinerary, departureDate: "15-10-2026" },
      }),
    );
  });
});

describe("demo snapshot gate", () => {
  const prev = process.env.DEMO_FLIGHT_INVENTORY;
  let createDemoSnapshot;

  beforeEach(async () => {
    ({ createDemoSnapshot } = await import("./demoSnapshot.controller.js"));
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.DEMO_FLIGHT_INVENTORY;
    else process.env.DEMO_FLIGHT_INVENTORY = prev;
  });

  const run = async (req) => {
    let err = null;
    await createDemoSnapshot(req, {}, (e) => {
      err = e;
    });
    return err;
  };

  it("404s when demo mode is off, so it cannot mint fares in production", async () => {
    delete process.env.DEMO_FLIGHT_INVENTORY;
    const err = await run({ user: { id: "u1" }, body: {} });
    assert.equal(err?.statusCode ?? err?.status, 404);
  });

  it("401s without an authenticated subject", async () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    const err = await run({ user: undefined, body: {} });
    assert.equal(err?.statusCode ?? err?.status, 401);
  });

  it("refuses the internal key identity as a snapshot owner", async () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    const err = await run({ user: { id: "internal" }, body: {} });
    assert.equal(err?.statusCode ?? err?.status, 401);
  });
});
