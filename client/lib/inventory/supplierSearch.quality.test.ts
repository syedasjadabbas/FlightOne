import { describe, expect, it } from "vitest";
import { dtoToFlightOffer, dtoToHotelOffer } from "./supplierSearch";

describe("live offer DTO quality/reliability honesty", () => {
  it("does not invent airlineScore or supplierReliability on flights", () => {
    const offer = dtoToFlightOffer({
      supplierCode: "GALILEO",
      offerId: "tp-1",
      product: "FLIGHT",
      currency: "PKR",
      amountMinor: 5000000,
      details: {
        origin: "LHE",
        destination: "DXB",
        carrier: "FZ",
        stops: 0,
        durationMinutes: 210,
        departTimeLocal: "09:00",
        cabin: "economy",
      },
    });
    expect(offer).not.toBeNull();
    expect(offer!.airlineScore).toBeUndefined();
    expect(offer!.supplierReliability).toBeUndefined();
  });

  it("passes through server-provided supplierReliability only", () => {
    const offer = dtoToFlightOffer({
      supplierCode: "GALILEO",
      offerId: "tp-2",
      product: "FLIGHT",
      currency: "PKR",
      amountMinor: 5000000,
      supplierReliability: 91,
      details: {
        origin: "LHE",
        destination: "DXB",
        carrier: "FZ",
        stops: 0,
        durationMinutes: 210,
        departTimeLocal: "09:00",
        cabin: "economy",
      },
    });
    expect(offer!.supplierReliability).toBe(91);
    expect(offer!.airlineScore).toBeUndefined();
  });

  it("does not invent hotel supplierReliability", () => {
    const offer = dtoToHotelOffer({
      supplierCode: "RATEHAWK",
      offerId: "ht-1",
      product: "HOTEL",
      currency: "PKR",
      amountMinor: 2500000,
      details: {
        cityCode: "DXB",
        city: "Dubai",
        hotelName: "Test Hotel",
        starRating: 4,
      },
    });
    expect(offer).not.toBeNull();
    expect(offer!.supplierReliability).toBeUndefined();
  });
});
