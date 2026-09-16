/**
 * Module 03 — RateHawk payload/prebook + supplier circuit breaker unit tests.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  resetSupplierCircuitsForTests,
  withCircuitBreaker,
  getSupplierCircuitStateForTests,
} from "./adapter.js";
import {
  setRateHawkFetchForTests,
  buildRateHawkGuests,
  selectRateHawkPaymentType,
  resolveRateHawkUserIp,
  prebookRateHawk,
  bookRateHawkReservation,
  confirmRateHawkVoucher,
} from "./ratehawk.adapter.js";
import {
  revalidateSupplierOffer,
  TRAVELPORT_CIRCUIT_AIRPRICE,
} from "./supplierBooking.js";

describe("RateHawk booking payload mapping", () => {
  it("builds guests from travellerSnapshot without inventing names", () => {
    const ok = buildRateHawkGuests({
      travellerSnapshot: { givenName: "Ada", surname: "Lovelace", phone: "+100", email: "a@b.c" },
    });
    assert.deepEqual(ok.guests, [{ first_name: "Ada", last_name: "Lovelace" }]);
    const missing = buildRateHawkGuests({ travellerSnapshot: { givenName: "Ada" } });
    assert.match(missing.error, /DATA_UNAVAILABLE/);
  });

  it("selects deposit payment_type and refuses card-required now", () => {
    const deposit = selectRateHawkPaymentType(
      {
        payment_types: [
          { type: "deposit", amount: "120.00", currency_code: "USD" },
          { type: "now", is_need_credit_card_data: true, is_need_cvc: true },
        ],
      },
      { netMinor: 12000, currency: "USD" },
    );
    assert.equal(deposit.payment_type.type, "deposit");
    assert.equal(deposit.payment_type.amount, "120.00");

    const cardOnly = selectRateHawkPaymentType(
      {
        payment_types: [{ type: "now", is_need_credit_card_data: true, amount: "10", currency_code: "USD" }],
      },
      { currency: "USD" },
    );
    assert.match(cardOnly.error, /PAN\/CVV|card/i);
  });

  it("requires requestIp and never invents production loopback", () => {
    assert.equal(resolveRateHawkUserIp({ metadata: {} }), null);
    assert.equal(resolveRateHawkUserIp({ metadata: { requestIp: "203.0.113.10" } }), "203.0.113.10");
  });
});

describe("RateHawk prebook revalidation", () => {
  beforeEach(() => {
    resetSupplierCircuitsForTests();
    setRateHawkFetchForTests(null);
  });

  after(() => {
    setRateHawkFetchForTests(null);
    resetSupplierCircuitsForTests();
  });

  it("returns unconfigured without credentials", async () => {
    delete process.env.RATEHAWK_KEY_ID;
    delete process.env.RATEHAWK_API_KEY;
    const r = await prebookRateHawk({
      netMinor: 10000,
      currency: "USD",
      supplierBookingRefs: { bookHash: "h-1" },
    });
    assert.equal(r.status, "unconfigured");
  });

  it("unchanged price returns ok with same netMinor", async () => {
    process.env.RATEHAWK_KEY_ID = "kid";
    process.env.RATEHAWK_API_KEY = "key";
    setRateHawkFetchForTests(async (path) => {
      assert.match(path, /prebook/);
      return {
        res: { ok: true, status: 200 },
        json: {
          status: "ok",
          data: {
            book_hash: "h-1",
            changes: { price_changed: false },
            rates: [
              {
                payment_options: {
                  payment_types: [{ show_amount: "100.00", show_currency_code: "USD" }],
                },
              },
            ],
          },
        },
      };
    });
    const r = await prebookRateHawk({
      netMinor: 10000,
      currency: "USD",
      supplierBookingRefs: { bookHash: "h-1" },
    });
    assert.equal(r.status, "ok");
    assert.equal(r.netMinor, 10000);
    assert.equal(r.details.priceChanged, false);
  });

  it("changed price returns new authoritative netMinor", async () => {
    process.env.RATEHAWK_KEY_ID = "kid";
    process.env.RATEHAWK_API_KEY = "key";
    setRateHawkFetchForTests(async () => ({
      res: { ok: true, status: 200 },
      json: {
        status: "ok",
        data: {
          book_hash: "h-2",
          changes: { price_changed: true },
          rates: [
            {
              payment_options: {
                payment_types: [{ show_amount: "150.00", show_currency_code: "USD" }],
              },
            },
          ],
        },
      },
    }));
    const r = await prebookRateHawk({
      netMinor: 10000,
      currency: "USD",
      supplierBookingRefs: { bookHash: "h-1" },
    });
    assert.equal(r.status, "ok");
    assert.equal(r.netMinor, 15000);
    assert.equal(r.details.bookHash, "h-2");
    assert.equal(r.details.priceChanged, true);
  });

  it("rate_not_found → expired", async () => {
    process.env.RATEHAWK_KEY_ID = "kid";
    process.env.RATEHAWK_API_KEY = "key";
    setRateHawkFetchForTests(async () => ({
      res: { ok: false, status: 400 },
      json: { status: "error", error: "rate_not_found" },
    }));
    const r = await prebookRateHawk({
      netMinor: 10000,
      currency: "USD",
      supplierBookingRefs: { bookHash: "h-gone" },
    });
    assert.equal(r.status, "expired");
  });

  it("revalidateSupplierOffer uses RateHawk prebook when configured", async () => {
    process.env.RATEHAWK_KEY_ID = "kid";
    process.env.RATEHAWK_API_KEY = "key";
    setRateHawkFetchForTests(async () => ({
      res: { ok: true, status: 200 },
      json: {
        status: "ok",
        data: {
          book_hash: "h-1",
          rates: [
            {
              payment_options: {
                payment_types: [{ show_amount: "90.00", show_currency_code: "USD" }],
              },
            },
          ],
        },
      },
    }));
    const r = await revalidateSupplierOffer({
      supplierCode: "RATEHAWK",
      netMinor: 9000,
      currency: "USD",
      supplierBookingRefs: { bookHash: "h-1" },
    });
    assert.equal(r.status, "ok");
    assert.equal(r.netMinor, 9000);
  });
});

describe("RateHawk book with honest DATA_UNAVAILABLE", () => {
  beforeEach(() => {
    resetSupplierCircuitsForTests();
    process.env.RATEHAWK_KEY_ID = "kid";
    process.env.RATEHAWK_API_KEY = "key";
  });

  after(() => {
    setRateHawkFetchForTests(null);
    delete process.env.RATEHAWK_KEY_ID;
    delete process.env.RATEHAWK_API_KEY;
  });

  it("refuses book without guests/IP/contact", async () => {
    setRateHawkFetchForTests(async () => {
      throw new Error("should not call RateHawk");
    });
    const r = await bookRateHawkReservation({
      id: "b1",
      supplierBookingRefs: { bookHash: "h-1" },
      travellerSnapshot: {},
      metadata: {},
    });
    assert.equal(r.status, "DATA_UNAVAILABLE");
  });

  it("completes book with deposit payment_type (no PAN)", async () => {
    setRateHawkFetchForTests(async (path, body) => {
      if (path.includes("booking/form")) {
        return {
          res: { ok: true, status: 200 },
          json: {
            status: "ok",
            data: {
              payment_types: [{ type: "deposit", amount: "100.00", currency_code: "USD" }],
            },
          },
        };
      }
      if (path.includes("finish/status")) {
        return {
          res: { ok: true, status: 200 },
          json: { status: "ok", data: { order_id: "ord-1" } },
        };
      }
      if (path.includes("booking/finish")) {
        assert.equal(body.payment_type.type, "deposit");
        assert.ok(!JSON.stringify(body).includes("card"));
        assert.equal(body.rooms[0].guests[0].first_name, "Ada");
        return { res: { ok: true, status: 200 }, json: { status: "ok", data: {} } };
      }
      return { res: { ok: false, status: 404 }, json: { status: "error" } };
    });

    const r = await bookRateHawkReservation({
      id: "b1",
      netMinor: 10000,
      currency: "USD",
      supplierBookingRefs: { bookHash: "h-1" },
      travellerSnapshot: {
        givenName: "Ada",
        surname: "Lovelace",
        email: "ada@example.com",
        phone: "+15551212",
      },
      metadata: { requestIp: "203.0.113.9" },
    });
    assert.equal(r.status, "ok");
    assert.equal(r.externalRef, "ord-1");
  });

  it("confirmRateHawkVoucher remains non-rebooking", async () => {
    const r = await confirmRateHawkVoucher({
      id: "b2",
      externalRef: "ord-9",
      metadata: {},
    });
    assert.equal(r.status, "ok");
    assert.equal(r.details.idempotent, true);
  });
});

describe("Supplier circuit breaker", () => {
  beforeEach(() => {
    resetSupplierCircuitsForTests();
    process.env.SUPPLIER_CIRCUIT_FAIL_LIMIT = "3";
    process.env.SUPPLIER_CIRCUIT_OPEN_MS = "60000";
  });

  after(() => {
    delete process.env.SUPPLIER_CIRCUIT_FAIL_LIMIT;
    delete process.env.SUPPLIER_CIRCUIT_OPEN_MS;
    resetSupplierCircuitsForTests();
  });

  it("closed → open → fail-fast → recovery after openMs", async () => {
    process.env.SUPPLIER_CIRCUIT_OPEN_MS = "50";
    const key = "TEST_OP";
    let calls = 0;
    const fail = async () => {
      calls += 1;
      throw new Error("boom");
    };

    for (let i = 0; i < 3; i += 1) {
      await assert.rejects(() => withCircuitBreaker(key, fail, { failLimit: 3, openMs: 50 }));
    }
    assert.equal(getSupplierCircuitStateForTests(key).open, true);

    await assert.rejects(
      () => withCircuitBreaker(key, fail, { failLimit: 3, openMs: 50 }),
      (err) => err.code === "SUPPLIER_CIRCUIT_OPEN",
    );
    assert.equal(calls, 3); // fail-fast did not invoke fn

    await new Promise((r) => setTimeout(r, 60));
    const ok = await withCircuitBreaker(key, async () => {
      calls += 1;
      return "recovered";
    }, { failLimit: 3, openMs: 50 });
    assert.equal(ok, "recovered");
    assert.equal(getSupplierCircuitStateForTests(key).open, false);
  });

  it("isFailure counts soft failures without throwing", async () => {
    const key = TRAVELPORT_CIRCUIT_AIRPRICE;
    for (let i = 0; i < 3; i += 1) {
      const r = await withCircuitBreaker(
        key,
        async () => ({ status: "unavailable" }),
        {
          failLimit: 3,
          openMs: 30_000,
          isFailure: (v) => v.status === "unavailable",
          onOpen: "return",
          openResult: () => ({ status: "unavailable", details: { code: "SUPPLIER_CIRCUIT_OPEN" } }),
        },
      );
      assert.equal(r.status, "unavailable");
    }
    const openHit = await withCircuitBreaker(
      key,
      async () => ({ status: "ok" }),
      {
        failLimit: 3,
        openMs: 30_000,
        isFailure: (v) => v.status === "unavailable",
        onOpen: "return",
        openResult: () => ({ status: "unavailable", details: { code: "SUPPLIER_CIRCUIT_OPEN" } }),
      },
    );
    assert.equal(openHit.details?.code, "SUPPLIER_CIRCUIT_OPEN");
  });
});
