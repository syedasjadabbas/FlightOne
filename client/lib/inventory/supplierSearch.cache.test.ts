import { describe, expect, it } from "vitest";
import {
  supplierSearchCacheKeyForTests,
  type FlightSearchQuery,
} from "./supplierSearch";

/**
 * Cache key regression — preferredCarrier order must not split the TTL/coalesce
 * bucket (duplicate Travelport calls within one Ava turn).
 *
 * Expected open-jaw (LHE/ISB→LON→SFO→MCO) reduction with client+server TTL:
 * identical OD/date/carrier keys share one outbound CatalogSearch; ~50–70%
 * fewer Travelport calls vs uncached fan-out of ~60–100+.
 */
describe("supplierSearchCacheKey", () => {
  const base: FlightSearchQuery = {
    origin: "LHE",
    destination: "SFO",
    departureDate: "2026-10-06",
    passengers: 1,
    cabinClass: "ECONOMY",
  };

  it("normalizes preferredCarrier order", () => {
    const a = supplierSearchCacheKeyForTests({
      product: "FLIGHT",
      query: {
        ...base,
        preferredCarriers: ["QR", "EK"],
        carrierPreferenceType: "Permitted",
      },
    });
    const b = supplierSearchCacheKeyForTests({
      product: "FLIGHT",
      query: {
        ...base,
        preferredCarriers: ["EK", "QR"],
        carrierPreferenceType: "Permitted",
      },
    });
    expect(a).toBe(b);
  });

  it("differs for open market vs Permitted probe", () => {
    const open = supplierSearchCacheKeyForTests({
      product: "FLIGHT",
      query: base,
    });
    const pk = supplierSearchCacheKeyForTests({
      product: "FLIGHT",
      query: {
        ...base,
        preferredCarriers: ["PK"],
        carrierPreferenceType: "Permitted",
      },
    });
    expect(open).not.toBe(pk);
  });

  it("uppercases OD so lhe/sfo and LHE/SFO share a key", () => {
    const a = supplierSearchCacheKeyForTests({
      product: "FLIGHT",
      query: { ...base, origin: "lhe", destination: "sfo" },
    });
    const b = supplierSearchCacheKeyForTests({
      product: "FLIGHT",
      query: base,
    });
    expect(a).toBe(b);
  });
});
