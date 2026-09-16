import { describe, expect, it } from "vitest";
import { dtoToFlightOffer } from "./supplierSearch";
import { withSearchUser, getSearchUserId } from "./searchUserContext";

describe("supplierSearch snapshot mapping", () => {
  it("maps supplierOfferSnapshotId onto FlightOffer", () => {
    const offer = dtoToFlightOffer({
      supplierCode: "GALILEO",
      offerId: "TP-offer-1",
      product: "FLIGHT",
      currency: "USD",
      amountMinor: 50000,
      supplierOfferSnapshotId: "snap_abc",
      snapshotExpiresAt: "2026-12-01T00:00:00.000Z",
      details: {
        origin: "ISB",
        destination: "JED",
        cabin: "economy",
        cabinClass: "ECONOMY",
        carrier: "PK",
        stops: 0,
        durationMinutes: 240,
        departTimeLocal: "09:00",
      },
    });
    expect(offer).not.toBeNull();
    expect(offer?.supplierOfferSnapshotId).toBe("snap_abc");
    expect(offer?.snapshotExpiresAt).toBe("2026-12-01T00:00:00.000Z");
    expect(offer?.netFare.amount).toBe(50000);
  });

  it("omits snapshot id when the supplier DTO has none", () => {
    const offer = dtoToFlightOffer({
      supplierCode: "GALILEO",
      offerId: "TP-offer-2",
      product: "FLIGHT",
      currency: "USD",
      amountMinor: 40000,
      details: {
        origin: "LHE",
        destination: "DXB",
        cabin: "economy",
        carrier: "PK",
        stops: 0,
        durationMinutes: 180,
        departTimeLocal: "08:00",
      },
    });
    expect(offer?.supplierOfferSnapshotId).toBeUndefined();
  });

  it("search user context is request-scoped and not taken from arbitrary input", () => {
    expect(getSearchUserId()).toBeUndefined();
    const inner = withSearchUser("user-1", () => getSearchUserId());
    expect(inner).toBe("user-1");
    expect(getSearchUserId()).toBeUndefined();
  });
});
