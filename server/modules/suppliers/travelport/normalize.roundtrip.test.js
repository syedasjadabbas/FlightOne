/**
 * Round-trip Journey pairing — CombinabilityCode stitches outbound + return.
 * Run: node --test modules/suppliers/travelport/normalize.roundtrip.test.js
 */

// normalizeSearchResponse reads travelportConfig(); stub credentials for unit tests.
process.env.TRAVELPORT_USERNAME ||= "test";
process.env.TRAVELPORT_PASSWORD ||= "test";
process.env.TRAVELPORT_CLIENT_ID ||= "test";
process.env.TRAVELPORT_CLIENT_SECRET ||= "test";
process.env.TRAVELPORT_PCC ||= "TEST";
process.env.TRAVELPORT_MAX_OFFERS ||= "12";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyOfferingBound,
  normalizeSearchResponse,
} from "./normalize.js";

function fixtureRtResponse() {
  return {
    CatalogProductOfferingsResponse: {
      transactionId: "t-rt-1",
      ReferenceList: [
        {
          "@type": "ReferenceListFlight",
          Flight: [
            {
              id: "s1",
              carrier: "EY",
              number: "285",
              equipment: "32A",
              duration: "PT3H20M",
              Departure: { location: "LHE", date: "2026-09-01", time: "04:15:00" },
              Arrival: { location: "AUH", date: "2026-09-01", time: "06:35:00" },
            },
            {
              id: "s2",
              carrier: "EY",
              number: "284",
              equipment: "32A",
              duration: "PT3H25M",
              Departure: { location: "AUH", date: "2026-09-08", time: "21:10:00" },
              Arrival: { location: "LHE", date: "2026-09-09", time: "02:35:00" },
            },
          ],
        },
        {
          "@type": "ReferenceListProduct",
          Product: [{ id: "p0", cabin: "Economy" }],
        },
      ],
      CatalogProductOfferings: {
        CatalogProductOffering: [
          {
            id: "o1",
            sequence: 1,
            Departure: "LHE",
            Arrival: "AUH",
            ProductBrandOptions: [
              {
                flightRefs: ["s1"],
                ProductBrandOffering: [
                  {
                    CombinabilityCode: ["j1"],
                    BestCombinablePrice: {
                      CurrencyCode: { value: "PKR", decimalPlace: 2 },
                      TotalPrice: 177410.58,
                    },
                    Product: [{ productRef: "p0" }],
                    Brand: { BrandRef: "b0" },
                  },
                ],
              },
            ],
          },
          {
            id: "o2",
            sequence: 2,
            Departure: "AUH",
            Arrival: "LHE",
            ProductBrandOptions: [
              {
                flightRefs: ["s2"],
                ProductBrandOffering: [
                  {
                    CombinabilityCode: ["j1"],
                    BestCombinablePrice: {
                      CurrencyCode: { value: "PKR", decimalPlace: 2 },
                      TotalPrice: 177410.58,
                    },
                    Product: [{ productRef: "p0" }],
                    Brand: { BrandRef: "b0" },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

describe("classifyOfferingBound", () => {
  it("uses sequence when present", () => {
    assert.equal(
      classifyOfferingBound({ sequence: 1 }, { origin: "LHE", destination: "AUH" }, []),
      "outbound",
    );
    assert.equal(
      classifyOfferingBound({ sequence: 2 }, { origin: "LHE", destination: "AUH" }, []),
      "return",
    );
  });
});

describe("normalizeSearchResponse round-trip", () => {
  it("pairs outbound + return into one offer with returnSegments", () => {
    const offers = normalizeSearchResponse(fixtureRtResponse(), {
      origin: "LHE",
      destination: "AUH",
      departureDate: "2026-09-01",
      returnDate: "2026-09-08",
    });

    assert.equal(offers.length, 1);
    const d = offers[0].details;
    assert.equal(d.returnDate, "2026-09-08");
    assert.equal(d.segments.length, 1);
    assert.equal(d.segments[0].flightNumber, "EY285");
    assert.ok(d.returnSegments);
    assert.equal(d.returnSegments.length, 1);
    assert.equal(d.returnSegments[0].flightNumber, "EY284");
    assert.equal(d.returnStops, 0);
    assert.equal(offers[0].amountMinor, 17741058);
  });

  it("does not emit return-only standalone cards", () => {
    const offers = normalizeSearchResponse(fixtureRtResponse(), {
      origin: "LHE",
      destination: "AUH",
      departureDate: "2026-09-01",
      returnDate: "2026-09-08",
    });
    for (const o of offers) {
      assert.equal(o.details.segments[0].originCode, "LHE");
    }
  });

  it("one-way keeps only outbound bound", () => {
    const offers = normalizeSearchResponse(fixtureRtResponse(), {
      origin: "LHE",
      destination: "AUH",
      departureDate: "2026-09-01",
    });
    assert.equal(offers.length, 1);
    assert.equal(offers[0].details.returnDate, null);
    assert.equal(offers[0].details.returnSegments, undefined);
    assert.equal(offers[0].details.segments[0].flightNumber, "EY285");
  });
});
