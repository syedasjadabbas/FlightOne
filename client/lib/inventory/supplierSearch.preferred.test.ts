import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("./supplierSearch", () => ({
  searchSuppliers: vi.fn(),
}));

import { searchSuppliers } from "./supplierSearch";
import {
  discoveryCarriersToProbe,
  openMarketAlreadyDiverse,
  searchFlightsPreferredThenOpen,
} from "./searchFlightsPreferred";
import type { FlightOffer } from "./types";

const searchMock = vi.mocked(searchSuppliers);

function flight(id: string, airline: string): FlightOffer {
  return {
    id,
    type: "flight",
    supplier: "Travelport",
    origin: "Lahore",
    originCode: "LHE",
    destination: "Beijing",
    destinationCode: "PEK",
    airline,
    cabin: "economy",
    stops: 1,
    durationMinutes: airline === "Thai Airways" ? 700 : 1710,
    departTimeLocal: "10:00",
    refundable: false,
    baggageKg: 20,
    airlineScore: 80,
    supplierReliability: 90,
    unitsLeft: 4,
    netFare: {
      amount: airline === "Thai Airways" ? 13425400 : 20000000,
      currency: "PKR",
    },
    marketPrice: { amount: 22000000, currency: "PKR" },
    tags: ["live"],
  };
}

describe("searchFlightsPreferredThenOpen", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("openMarketAlreadyDiverse is true at 3+ carriers (comps skip alt probes)", () => {
    expect(
      openMarketAlreadyDiverse([
        flight("a", "Etihad"),
        flight("b", "Emirates"),
        flight("c", "Qatar Airways"),
      ]),
    ).toBe(true);
    expect(openMarketAlreadyDiverse([flight("a", "Etihad")])).toBe(false);
  });

  it("runs permitted + open searches and ranks preferred first", async () => {
    searchMock
      .mockResolvedValueOnce([flight("qr-1", "Qatar Airways")])
      .mockResolvedValueOnce([flight("ey-1", "Etihad"), flight("qr-2", "Qatar Airways")]);

    const out = await searchFlightsPreferredThenOpen(
      {
        origin: "LHE",
        destination: "LHR",
        departureDate: "2026-08-21",
        passengers: 1,
      },
      ["QR"],
    );

    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock.mock.calls[0][0]).toMatchObject({
      product: "FLIGHT",
      query: {
        preferredCarriers: ["QR"],
        carrierPreferenceType: "Permitted",
      },
    });
    expect(out?.map((o) => o.id)).toEqual(["qr-1", "qr-2", "ey-1"]);
  });

  it("probes major carriers when open market is one-airline (Etihad-only LHE→PEK)", async () => {
    searchMock.mockImplementation(async (body) => {
      const preferred = body.query?.preferredCarriers as string[] | undefined;
      if (!preferred?.length) return [flight("ey-1", "Etihad")];
      if (preferred[0] === "TG") return [flight("tg-1", "Thai Airways")];
      return [];
    });

    const out = await searchFlightsPreferredThenOpen({
      origin: "LHE",
      destination: "PEK",
      departureDate: "2026-11-01",
      passengers: 1,
    });

    expect(searchMock.mock.calls.length).toBeGreaterThan(1);
    const permittedCalls = searchMock.mock.calls.filter(
      (c) => c[0].query?.carrierPreferenceType === "Permitted",
    );
    expect(permittedCalls.some((c) => c[0].query?.preferredCarriers?.[0] === "TG")).toBe(
      true,
    );
    expect(out?.some((o) => o.id === "tg-1")).toBe(true);
    expect(out?.some((o) => o.id === "ey-1")).toBe(true);
  });

  it("skips generic discovery when open market already has enough carriers, on a non-Pakistan origin", async () => {
    searchMock.mockResolvedValueOnce([
      flight("ey-1", "Etihad"),
      flight("ul-1", "SriLankan"),
      flight("qr-1", "Qatar Airways"),
    ]);

    const out = await searchFlightsPreferredThenOpen({
      origin: "DXB",
      destination: "LHR",
      departureDate: "2026-11-01",
    });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(3);
  });

  it("always probes PIA for Pakistan-origin routes, even when open market already has 3+ carriers (regression: LHE-DXB agent bug report)", async () => {
    searchMock.mockImplementation(async (body) => {
      const preferred = body.query?.preferredCarriers as string[] | undefined;
      if (!preferred?.length) {
        return [
          flight("ey-1", "Etihad"),
          flight("ek-1", "Emirates"),
          flight("qr-1", "Qatar Airways"),
        ];
      }
      if (preferred[0] === "PK") return [flight("pk-1", "PIA")];
      return [];
    });

    const out = await searchFlightsPreferredThenOpen({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-11-01",
    });

    const permittedCalls = searchMock.mock.calls.filter(
      (c) => c[0].query?.carrierPreferenceType === "Permitted",
    );
    expect(permittedCalls.some((c) => c[0].query?.preferredCarriers?.[0] === "PK")).toBe(
      true,
    );
    expect(out?.some((o) => o.id === "pk-1")).toBe(true);
  });

  it("LHE→DXB with only EY+QR open market probes UL (regression: SriLankan IDs must come from discovery raw)", async () => {
    searchMock.mockImplementation(async (body) => {
      const preferred = body.query?.preferredCarriers as string[] | undefined;
      if (!preferred?.length) {
        return [flight("TP-o1_j1_p0_s3-s4", "Etihad"), flight("TP-o2_j4_p9_s1-s2", "Qatar Airways")];
      }
      if (preferred[0] === "UL") {
        return [
          flight("TP-o1_j1_p0_s1-s2", "SriLankan"),
          flight("TP-o1_j2_p1_s1-s2", "SriLankan"),
          flight("TP-o1_j3_p2_s1-s2", "SriLankan"),
        ];
      }
      return [];
    });

    const query = {
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
      passengers: 1,
    };
    const openOnly = [
      flight("TP-o1_j1_p0_s3-s4", "Etihad"),
      flight("TP-o2_j4_p9_s1-s2", "Qatar Airways"),
    ];
    const probes = discoveryCarriersToProbe(query, openOnly);
    expect(probes).toContain("UL");
    expect(probes[0]).toBe("PK");

    const out = await searchFlightsPreferredThenOpen(query);
    const ids = out?.map((o) => o.id) ?? [];
    expect(ids).toContain("TP-o1_j1_p0_s1-s2");
    expect(ids).toContain("TP-o1_j2_p1_s1-s2");
    expect(ids).toContain("TP-o1_j3_p2_s1-s2");

    // Open-market-only audit would false-positive; union with UL raw must cover them.
    const openIds = new Set(openOnly.map((o) => o.id));
    const ulRawIds = new Set([
      "TP-o1_j1_p0_s1-s2",
      "TP-o1_j2_p1_s1-s2",
      "TP-o1_j3_p2_s1-s2",
    ]);
    const auditUnion = new Set([...openIds, ...ulRawIds]);
    for (const id of [
      "TP-o1_j1_p0_s1-s2",
      "TP-o1_j2_p1_s1-s2",
      "TP-o1_j3_p2_s1-s2",
    ]) {
      expect(openIds.has(id)).toBe(false);
      expect(auditUnion.has(id)).toBe(true);
    }
  });
});
