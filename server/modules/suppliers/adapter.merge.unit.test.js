/**
 * Module 03 — merge + RateHawk adapter boundary.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mergeSupplierOffers, resetSupplierCircuitsForTests } from "./adapter.js";
import {
  getRateHawkCapability,
  isRateHawkConfigured,
  bookRateHawkReservation,
} from "./ratehawk.adapter.js";

describe("mergeSupplierOffers", () => {
  it("preserves supplier identity and dedupes by supplier+offerId", () => {
    const merged = mergeSupplierOffers([
      [
        {
          supplierCode: "GALILEO",
          offerId: "A1",
          product: "FLIGHT",
          currency: "USD",
          amountMinor: 100,
        },
        {
          supplierCode: "RATEHAWK",
          offerId: "H1",
          product: "HOTEL",
          currency: "USD",
          amountMinor: 200,
        },
      ],
      [
        {
          supplierCode: "GALILEO",
          offerId: "A1",
          product: "FLIGHT",
          currency: "USD",
          amountMinor: 999,
        },
        {
          supplierCode: "TRAVELPORT",
          offerId: "H1",
          product: "HOTEL",
          currency: "USD",
          amountMinor: 220,
        },
      ],
    ]);
    assert.equal(merged.length, 3);
    assert.equal(merged.find((o) => o.supplierCode === "GALILEO")?.amountMinor, 100);
    assert.ok(merged.some((o) => o.supplierCode === "RATEHAWK"));
    assert.ok(merged.some((o) => o.supplierCode === "TRAVELPORT"));
  });
});

describe("RateHawk adapter boundary", () => {
  const prevKey = process.env.RATEHAWK_KEY_ID;
  const prevSecret = process.env.RATEHAWK_API_KEY;

  before(() => {
    delete process.env.RATEHAWK_KEY_ID;
    delete process.env.RATEHAWK_API_KEY;
    resetSupplierCircuitsForTests();
  });

  after(() => {
    if (prevKey === undefined) delete process.env.RATEHAWK_KEY_ID;
    else process.env.RATEHAWK_KEY_ID = prevKey;
    if (prevSecret === undefined) delete process.env.RATEHAWK_API_KEY;
    else process.env.RATEHAWK_API_KEY = prevSecret;
  });

  it("reports honest unconfigured capability without inventing success", async () => {
    assert.equal(isRateHawkConfigured(), false);
    const cap = getRateHawkCapability();
    assert.equal(cap.configured, false);
    assert.equal(cap.canReserve, false);
    const book = await bookRateHawkReservation({
      id: "b1",
      supplierBookingRefs: { bookHash: "hash" },
    });
    assert.equal(book.status, "unconfigured");
  });

  it("confirmRateHawkVoucher never re-books when order already reserved", async () => {
    const { confirmRateHawkVoucher } = await import("./ratehawk.adapter.js");
    const withRef = await confirmRateHawkVoucher({
      id: "b2",
      externalRef: "order-99",
      metadata: {},
    });
    assert.equal(withRef.status, "ok");
    assert.deepEqual(withRef.voucherRefs, ["order-99"]);
    assert.equal(withRef.details?.idempotent, true);

    const missing = await confirmRateHawkVoucher({
      id: "b3",
      externalRef: null,
      metadata: {},
      supplierBookingRefs: { bookHash: "hash" },
    });
    assert.equal(missing.status, "failed");
    assert.match(String(missing.details?.reason || ""), /refusing re-book/i);
  });
});
