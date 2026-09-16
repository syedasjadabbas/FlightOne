import { describe, expect, it } from "vitest";
import {
  offerHasQuoteSnapshot,
  quotePayloadFromOffer,
} from "./quoteFromOffer";

describe("quoteFromOffer", () => {
  it("refuses booking/quote without a snapshot id", () => {
    expect(offerHasQuoteSnapshot({ priceMinor: 10900, currency: "USD" })).toBe(false);
    expect(() =>
      quotePayloadFromOffer({
        type: "flight",
        currency: "USD",
        priceMinor: 1,
        flight: { originCode: "ISB", destinationCode: "JED", cabin: "economy" },
      }),
    ).toThrow(/snapshot/i);
  });

  it("builds a server quote payload that does not include client prices", () => {
    const payload = quotePayloadFromOffer({
      supplierOfferSnapshotId: "snap_live_1",
      type: "flight",
      currency: "usd",
      priceMinor: 1,
      flight: { originCode: "isb", destinationCode: "jed", cabin: "economy" },
    });
    expect(payload).toEqual({
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: "snap_live_1",
      route: "ISB-JED",
      cabin: "ECONOMY",
    });
    expect(payload).not.toHaveProperty("amountMinor");
    expect(payload).not.toHaveProperty("netMinor");
  });

  it("attaches corporate companyId metadata when provided", () => {
    const payload = quotePayloadFromOffer(
      {
        supplierOfferSnapshotId: "snap_corp_1",
        type: "flight",
        currency: "USD",
      },
      { companyId: "co_1", projectCodeId: "pc_1" },
    );
    expect(payload.metadata).toEqual({ companyId: "co_1", projectCodeId: "pc_1" });
  });

  it("does not attach projectCodeId without a company context", () => {
    const payload = quotePayloadFromOffer(
      { supplierOfferSnapshotId: "snap_x", type: "flight", currency: "USD" },
      { projectCodeId: "pc_1" },
    );
    expect(payload.metadata).toBeUndefined();
  });
});
