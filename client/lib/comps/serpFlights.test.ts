import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./serpHotels", () => ({
  isSerpConfigured: () => true,
}));

import { searchGoogleFlights } from "./serpFlights";

describe("searchGoogleFlights query hardening", () => {
  const originalKey = process.env.SERPAPI_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = originalKey;
  });

  it("skips non-IATA origins without calling Serp", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await searchGoogleFlights({
      origin: "Lahore",
      destination: "BKK",
      outboundDate: "2026-09-01",
      currency: "PKR",
    });

    expect(res.options).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips past outbound dates", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await searchGoogleFlights({
      origin: "LHE",
      destination: "BKK",
      outboundDate: "2020-01-01",
      currency: "PKR",
    });

    expect(res.options).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries with deep_search when first response is empty", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    const empty = {
      json: async () => ({
        error: "Google Flights hasn't returned any results for this query.",
      }),
      ok: true,
    };
    const ok = {
      ok: true,
      json: async () => ({
        best_flights: [
          {
            price: 450,
            total_duration: 320,
            flights: [
              {
                airline: "SriLankan",
                flight_number: "UL123",
                departure_airport: { id: "LHE" },
                arrival_airport: { id: "BKK" },
              },
            ],
            layovers: [],
          },
        ],
        price_insights: { lowest_price: 450 },
        search_parameters: { currency: "PKR" },
      }),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);

    const res = await searchGoogleFlights({
      origin: "LHE",
      destination: "BKK",
      outboundDate: "2026-12-01",
      currency: "PKR",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(secondUrl).toContain("deep_search=true");
    expect(secondUrl).toContain("gl=pk");
    expect(secondUrl).not.toContain("include_airlines");
    expect(res.options).toHaveLength(1);
    expect(res.lowestPriceMajor).toBe(450);
  });

  it("forces one-way when return date is missing or invalid", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        best_flights: [
          {
            price: 100,
            flights: [
              {
                airline: "PK",
                flight_number: "PK300",
                departure_airport: { id: "LHE" },
                arrival_airport: { id: "DXB" },
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchGoogleFlights({
      origin: "LHE",
      destination: "DXB",
      outboundDate: "2026-12-01",
      returnDate: "not-a-date",
      currency: "USD",
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("type=2");
    expect(url).not.toContain("return_date");
    expect(url).toContain("gl=us");
  });
});
