/**
 * Travelport fare metadata extraction unit tests.
 * Run: node --test modules/suppliers/travelport/fareMetadata.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFareMetadata,
  extractBaggageFromTerms,
  extractPriceBreakdown,
} from "./fareMetadata.js";

describe("extractPriceBreakdown", () => {
  it("reconciles base + taxes + fees to total", () => {
    const b = extractPriceBreakdown({
      CurrencyCode: { value: "PKR", decimalPlace: 0 },
      Base: 82460,
      TotalTaxes: 17680,
      TotalFees: 0,
      TotalPrice: 100140,
    });
    assert.ok(b);
    assert.equal(b.totalMinor, 10014000);
    assert.equal(b.baseMinor, 8246000);
    assert.equal(b.taxesMinor, 1768000);
  });
});

describe("extractBaggageFromTerms", () => {
  it("parses carry-on and checked from TermsAndConditions", () => {
    const bag = extractBaggageFromTerms(
      {
        BaggageAllowance: [
          {
            baggageType: "CarryOn",
            ProductRef: ["p0"],
            BaggageItem: [{ includedInOfferPrice: "Yes", quantity: 1 }],
          },
          {
            baggageType: "FirstCheckedBag",
            ProductRef: ["p0"],
            BaggageItem: [
              {
                includedInOfferPrice: "No",
                Measurement: [{ measurementType: "Weight", unit: "Kilograms", value: 0 }],
              },
            ],
          },
        ],
      },
      "p0",
    );
    assert.equal(bag.carryOn.included, true);
    assert.equal(bag.checked.included, false);
    assert.equal(bag.checked.weightKg, 0);
  });
});

describe("buildFareMetadata", () => {
  it("combines brand name, rules, and breakdown", () => {
    const meta = buildFareMetadata({
      brandRef: "b0",
      productRef: "p0",
      product: {
        PassengerFlight: [
          {
            FlightProduct: [{ fareBasisCode: "LNN00H6K", classOfService: "L" }],
          },
        ],
      },
      brands: new Map([
        [
          "b0",
          {
            name: "Economy Basic",
            BrandAttribute: [
              { classification: "Refund", inclusion: "Not Offered" },
              { classification: "Rebooking", inclusion: "Not Offered" },
            ],
          },
        ],
      ]),
      terms: new Map([
        [
          "T0",
          {
            Penalties: [
              {
                Cancel: [
                  {
                    Penalty: [{ "@type": "PenaltyPercent", Percent: 100 }],
                  },
                ],
                Change: [
                  {
                    Penalty: [{ "@type": "PenaltyPercent", Percent: 100 }],
                  },
                ],
              },
            ],
            PaymentTimeLimit: "2026-09-10T23:59:00Z",
            ValidatingAirline: [{ ValidatingAirline: "EY" }],
          },
        ],
      ]),
      termsRef: "T0",
      priceNode: {
        CurrencyCode: { value: "PKR", decimalPlace: 0 },
        Base: 82460,
        TotalTaxes: 17680,
        TotalFees: 0,
        TotalPrice: 100140,
      },
    });
    assert.equal(meta.brandName, "Economy Basic");
    assert.equal(meta.fareBasisCode, "LNN00H6K");
    assert.equal(meta.refundable, false);
    assert.equal(meta.fareRulesSummary.cancellation, "Non-refundable");
    assert.equal(meta.validatingCarrier, "EY");
    assert.ok(meta.priceBreakdown.totalMinor === 10014000);
  });
});
