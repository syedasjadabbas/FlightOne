/**
 * Comps request body validators.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flightsBodySchema, hotelsBodySchema } from "./comps.validators.js";

describe("comps.validators — flightsBodySchema", () => {
  it("accepts a valid flight body", () => {
    const parsed = flightsBodySchema.parse({
      origin: "lhe",
      destination: "dxb",
      outboundDate: "2026-10-15",
      returnDate: "2026-10-22",
      currency: "pkr",
      adults: 2,
      includeAirlines: ["pk", "EK"],
      timeoutMs: 20000,
    });
    assert.equal(parsed.origin, "LHE");
    assert.equal(parsed.destination, "DXB");
    assert.equal(parsed.currency, "PKR");
    assert.deepEqual(parsed.includeAirlines, ["PK", "EK"]);
  });

  it("rejects a bad IATA origin", () => {
    assert.throws(
      () =>
        flightsBodySchema.parse({
          origin: "LAHORE",
          destination: "DXB",
          outboundDate: "2026-10-15",
          currency: "USD",
        }),
      (err) =>
        err instanceof Error && /IATA|airport code/i.test(String(err)),
    );
  });
});

describe("comps.validators — hotelsBodySchema", () => {
  it("accepts a valid hotel body", () => {
    const parsed = hotelsBodySchema.parse({
      q: "Burj Al Arab Dubai",
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-05",
      currency: "aed",
      adults: 2,
      hotelClass: 5,
    });
    assert.equal(parsed.currency, "AED");
    assert.equal(parsed.hotelClass, 5);
  });
});
