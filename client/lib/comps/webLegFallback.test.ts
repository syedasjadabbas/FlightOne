import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./serpHotels", () => ({
  isSerpConfigured: () => true,
}));

vi.mock("./serpFlights", () => ({
  searchGoogleFlights: vi.fn(),
}));

import { searchGoogleFlights } from "./serpFlights";
import { fillEmptyFlightLegsFromWeb, isWebMetaConfigured } from "./webLegFallback";

const mockedSearch = vi.mocked(searchGoogleFlights);

describe("webLegFallback", () => {
  beforeEach(() => {
    mockedSearch.mockReset();
  });

  it("reports configured when Serp is available", () => {
    expect(isWebMetaConfigured()).toBe(true);
  });

  it("fills only empty non-live flight legs with web-meta offers", async () => {
    mockedSearch.mockResolvedValue({
      options: [
        {
          airlines: ["British Airways"],
          carrierHint: "BA",
          priceMajor: 450,
          currency: "GBP",
          stops: 0,
          durationMinutes: 660,
          departureId: "LHR",
          arrivalId: "SFO",
        },
      ],
      lowestPriceMajor: 450,
    });

    const result = await fillEmptyFlightLegsFromWeb({
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "LHR",
            departureDate: "2026-10-05",
            passengers: 1,
          },
        },
        {
          product: "FLIGHT",
          query: {
            origin: "LHR",
            destination: "SFO",
            departureDate: "2026-10-08",
            passengers: 1,
          },
        },
      ],
      legBuckets: [[{ id: "live-1" } as never], []],
      legLive: [true, false],
      currency: "GBP",
    });

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "LHR", destination: "SFO" }),
    );
    expect(result.legWeb).toEqual([false, true]);
    expect(result.legBuckets[0]).toHaveLength(1);
    expect(result.legBuckets[1]).toHaveLength(1);
    expect(result.legBuckets[1][0]).toMatchObject({
      tags: expect.arrayContaining(["web-meta"]),
      originCode: "LHR",
      destinationCode: "SFO",
      supplier: "Google Flights",
    });
  });

  it("skips live legs even when bucket is empty", async () => {
    mockedSearch.mockResolvedValue({
      options: [
        {
          airlines: ["PIA"],
          carrierHint: "PK",
          priceMajor: 200,
          currency: "PKR",
          stops: 0,
          durationMinutes: 480,
          departureId: "LHE",
          arrivalId: "LHR",
        },
      ],
      lowestPriceMajor: 200,
    });

    const result = await fillEmptyFlightLegsFromWeb({
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "LHR",
            departureDate: "2026-10-05",
          },
        },
      ],
      legBuckets: [[]],
      legLive: [true],
      currency: "PKR",
    });

    expect(mockedSearch).not.toHaveBeenCalled();
    expect(result.legWeb).toEqual([false]);
    expect(result.legBuckets[0]).toHaveLength(0);
  });

  it("no-ops when Serp returns no options", async () => {
    mockedSearch.mockResolvedValue({ options: [], lowestPriceMajor: null });

    const result = await fillEmptyFlightLegsFromWeb({
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHR",
            destination: "SFO",
            departureDate: "2026-10-08",
          },
        },
      ],
      legBuckets: [[]],
      legLive: [false],
      currency: "USD",
    });

    expect(result.legWeb).toEqual([false]);
    expect(result.legBuckets[0]).toHaveLength(0);
  });
});
