import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./serpHotels", () => ({
  isSerpConfigured: () => true,
}));

import { searchGoogleFlights } from "./serpFlights";

describe("searchGoogleFlights server proxy", () => {
  const originalKey = process.env.INTERNAL_API_KEY;
  const originalApi = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = originalKey;
    if (originalApi === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApi;
  });

  it("POSTs to Express /comps/flights with the search body", async () => {
    process.env.INTERNAL_API_KEY = "test-internal";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8084/api/v1";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          options: [
            {
              airlines: ["PK"],
              carrierHint: "PK",
              priceMajor: 100,
              currency: "USD",
              stops: 0,
              durationMinutes: 120,
              departureId: "LHE",
              arrivalId: "DXB",
            },
          ],
          lowestPriceMajor: 100,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await searchGoogleFlights({
      origin: "LHE",
      destination: "DXB",
      outboundDate: "2026-12-01",
      currency: "USD",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:8084/api/v1/comps/flights");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Internal-Api-Key"]).toBe("test-internal");
    expect(JSON.parse(init.body)).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      outboundDate: "2026-12-01",
      currency: "USD",
    });
    expect(res.options).toHaveLength(1);
    expect(res.lowestPriceMajor).toBe(100);
  });

  it("soft-fails to empty on HTTP error", async () => {
    process.env.INTERNAL_API_KEY = "test-internal";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8084/api/v1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const res = await searchGoogleFlights({
      origin: "LHE",
      destination: "BKK",
      outboundDate: "2026-12-01",
      currency: "PKR",
    });

    expect(res.options).toEqual([]);
    expect(res.lowestPriceMajor).toBeNull();
  });
});
