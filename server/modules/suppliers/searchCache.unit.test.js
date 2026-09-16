/**
 * Unit tests for supplier search cache key + coalescing.
 * Run: node --test modules/suppliers/searchCache.unit.test.js
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildSupplierSearchCacheKey,
  clearSupplierSearchCacheForTests,
  withSupplierSearchCache,
  SUPPLIER_SEARCH_CACHE_TTL_MS,
} from "./searchCache.js";

describe("buildSupplierSearchCacheKey", () => {
  it("is stable across preferredCarrier order", () => {
    const a = buildSupplierSearchCacheKey("FLIGHT", {
      origin: "lhe",
      destination: "sfo",
      departureDate: "2026-10-06",
      preferredCarriers: ["QR", "EK"],
      carrierPreferenceType: "Permitted",
    });
    const b = buildSupplierSearchCacheKey("FLIGHT", {
      origin: "LHE",
      destination: "SFO",
      departureDate: "2026-10-06",
      preferredCarriers: ["EK", "QR"],
      carrierPreferenceType: "Permitted",
    });
    assert.equal(a, b);
  });

  it("differs when OD or date changes", () => {
    const base = {
      origin: "LHE",
      destination: "SFO",
      departureDate: "2026-10-06",
    };
    const a = buildSupplierSearchCacheKey("FLIGHT", base);
    const b = buildSupplierSearchCacheKey("FLIGHT", {
      ...base,
      destination: "OAK",
    });
    const c = buildSupplierSearchCacheKey("FLIGHT", {
      ...base,
      departureDate: "2026-10-07",
    });
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });

  it("differs for open vs permitted-carrier probes", () => {
    const open = buildSupplierSearchCacheKey("FLIGHT", {
      origin: "LHE",
      destination: "SFO",
      departureDate: "2026-10-06",
    });
    const pk = buildSupplierSearchCacheKey("FLIGHT", {
      origin: "LHE",
      destination: "SFO",
      departureDate: "2026-10-06",
      preferredCarriers: ["PK"],
      carrierPreferenceType: "Permitted",
    });
    assert.notEqual(open, pk);
  });
});

describe("withSupplierSearchCache", () => {
  beforeEach(() => {
    clearSupplierSearchCacheForTests();
  });

  it("coalesces concurrent identical keys onto one compute", async () => {
    let calls = 0;
    const compute = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return ["offer"];
    };
    const key = buildSupplierSearchCacheKey("FLIGHT", {
      origin: "LHR",
      destination: "SFO",
      departureDate: "2026-10-08",
    });
    const [a, b, c] = await Promise.all([
      withSupplierSearchCache(key, compute),
      withSupplierSearchCache(key, compute),
      withSupplierSearchCache(key, compute),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(a, ["offer"]);
    assert.deepEqual(b, ["offer"]);
    assert.deepEqual(c, ["offer"]);
  });

  it("serves short-TTL hit for sequential duplicate within window", async () => {
    let calls = 0;
    const key = buildSupplierSearchCacheKey("FLIGHT", {
      origin: "AUH",
      destination: "SFO",
      departureDate: "2026-10-09",
    });
    const compute = async () => {
      calls += 1;
      return [{ id: "x" }];
    };
    await withSupplierSearchCache(key, compute);
    await withSupplierSearchCache(key, compute);
    assert.equal(calls, 1);
    assert.ok(SUPPLIER_SEARCH_CACHE_TTL_MS >= 1000);
  });
});
