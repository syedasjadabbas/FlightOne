/**
 * Module 07 printable PDF unit tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBookingPrintable, buildSimplePdf } from "./vault.printables.js";

describe("vault.printables", () => {
  it("builds a PDF buffer", () => {
    const buf = buildSimplePdf({ title: "Test", lines: ["Line 1", "Line 2"] });
    assert.ok(buf.toString("utf8").startsWith("%PDF-1.4"));
    assert.ok(buf.toString("utf8").includes("Line 1"));
  });

  it("refuses ticket printable without confirmation data", () => {
    const out = buildBookingPrintable("TICKET", {
      product: "FLIGHT",
      bookingId: "b1",
      externalRef: null,
      ticketNumbers: [],
    });
    assert.equal(out, null);
  });

  it("builds ticket from real PNR / ticket numbers only", () => {
    const out = buildBookingPrintable("TICKET", {
      product: "FLIGHT",
      bookingId: "b1",
      externalRef: "PNR123",
      ticketNumbers: ["176-1234567890"],
      currency: "USD",
      amountMinor: 12000,
      travellerSnapshot: { givenName: "Ada", surname: "Lovelace" },
    });
    assert.ok(out);
    assert.equal(out.kind, "TICKET");
    assert.ok(out.buffer.toString("utf8").includes("PNR123"));
    assert.ok(out.buffer.toString("utf8").includes("176-1234567890"));
    assert.ok(!out.buffer.toString("utf8").includes("FAKE"));
  });

  it("builds hotel voucher from voucher refs", () => {
    const out = buildBookingPrintable("HOTEL_VOUCHER", {
      product: "HOTEL",
      bookingId: "b2",
      externalRef: "HTL-9",
      voucherRefs: ["V-55"],
    });
    assert.ok(out);
    assert.equal(out.kind, "HOTEL_VOUCHER");
    assert.ok(out.buffer.toString("utf8").includes("V-55"));
  });
});
