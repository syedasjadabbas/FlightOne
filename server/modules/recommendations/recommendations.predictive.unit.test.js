import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeFareInsight, FARE_MIN_HISTORICAL_SAMPLES } from "./recommendations.fare.js";
import { buildPredictiveItems } from "./recommendations.predictive.js";
import { getCalendarCapability } from "./recommendations.calendar.js";

describe("fare insight", () => {
  it("does not invent a prediction without enough historical observations", () => {
    const out = computeFareInsight({
      currentAmountMinor: 50000,
      currency: "PKR",
      historicalAmounts: [48000],
    });
    assert.equal(out.currentFare.available, true);
    assert.equal(out.currentFare.source, "verified_current");
    assert.equal(out.prediction.available, false);
    assert.equal(out.prediction.status, "INSUFFICIENT_DATA");
    assert.equal(out.prediction.suggestedAction, "NOT_ENOUGH_DATA");
    assert.match(out.prediction.explanation, /not enough/i);
  });

  it("returns a grounded inference when enough observations exist", () => {
    assert.ok(FARE_MIN_HISTORICAL_SAMPLES >= 3);
    const out = computeFareInsight({
      currentAmountMinor: 80000,
      currency: "PKR",
      historicalAmounts: [50000, 52000, 51000, 53000],
      daysUntilDepart: 30,
    });
    assert.equal(out.prediction.available, true);
    assert.equal(out.prediction.status, "INFERENCE");
    assert.equal(out.prediction.trend, "UP");
    assert.equal(out.prediction.suggestedAction, "BOOK_NOW");
    assert.match(out.prediction.explanation, /not a guaranteed saving/i);
  });

  it("suggests consider waiting when current fare is below earlier observations", () => {
    const out = computeFareInsight({
      currentAmountMinor: 40000,
      currency: "PKR",
      historicalAmounts: [60000, 61000, 59000],
      daysUntilDepart: 40,
    });
    assert.equal(out.prediction.suggestedAction, "CONSIDER_WAIT");
    assert.equal(out.prediction.trend, "DOWN");
  });
});

describe("predictive items", () => {
  it("returns no items without verified history", () => {
    const items = buildPredictiveItems({ bookings: [], snapshots: [], watches: [] });
    assert.equal(items.length, 0);
  });

  it("grounds a recommendation in a verified booking route", () => {
    const items = buildPredictiveItems({
      bookings: [
        {
          status: "COMPLETED",
          product: "FLIGHT",
          metadata: { origin: "LHE", destination: "DXB" },
          createdAt: new Date(),
        },
      ],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].origin, "LHE");
    assert.equal(items[0].destination, "DXB");
    assert.match(items[0].reason, /previous trips/i);
    assert.ok(!/Japan|London|calendar event in Paris/i.test(JSON.stringify(items)));
  });

  it("uses a last-year departure month as a seasonal reminder", () => {
    const now = new Date("2026-09-19T00:00:00.000Z");
    const items = buildPredictiveItems({
      now,
      bookings: [
        {
          status: "COMPLETED",
          metadata: {
            origin: "LHE",
            destination: "DXB",
            departAt: "2025-09-12T08:00:00.000Z",
          },
          createdAt: new Date("2025-08-01T00:00:00.000Z"),
        },
      ],
    });
    const seasonal = items.find((i) => i.kind === "SEASONAL_TRIP");
    assert.ok(seasonal);
    assert.match(seasonal.reason, /around this time in 2025/i);
  });

  it("does not emit calendar recommendations when the calendar is unconfigured", () => {
    const cap = getCalendarCapability({ CALENDAR_PROVIDER: "unconfigured" });
    assert.equal(cap.configured, false);
    const items = buildPredictiveItems({
      calendar: cap,
      bookings: [],
    });
    assert.equal(items.some((i) => i.kind === "CALENDAR_EVENT"), false);
  });

  it("does not invent calendar events when a provider is named but sync is off", () => {
    const cap = getCalendarCapability({
      CALENDAR_PROVIDER: "http",
      CALENDAR_HTTP_URL: "https://example.invalid/cal",
      CALENDAR_HTTP_API_KEY: "not-a-real-key",
    });
    assert.equal(cap.configured, true);
    assert.equal(cap.available, false);
    assert.ok(!String(cap.reason).toLowerCase().includes("api_key"));
    const items = buildPredictiveItems({ calendar: { ...cap, events: [] } });
    assert.equal(items.length, 0);
  });

  it("does not emit a search-pattern rec with only one snapshot", () => {
    const snap = (n) => ({
      netMinor: 1000 + n,
      currency: "PKR",
      createdAt: new Date(),
      supplierBookingRefs: { itinerary: { origin: "KHI", destination: "JED" } },
    });
    const items = buildPredictiveItems({ snapshots: [snap(1), snap(2)] });
    assert.equal(items.some((i) => i.kind === "SEARCH_PATTERN"), false);
  });

  it("emits a search-pattern rec from three verified snapshots", () => {
    const snap = (n) => ({
      netMinor: 1000 + n,
      currency: "PKR",
      createdAt: new Date(),
      supplierBookingRefs: { itinerary: { origin: "KHI", destination: "JED" } },
    });
    const items = buildPredictiveItems({ snapshots: [snap(1), snap(2), snap(3)] });
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "SEARCH_PATTERN");
    assert.match(items[0].reason, /frequently search/i);
  });

  it("uses an upcoming journey watch as a verified reminder", () => {
    const items = buildPredictiveItems({
      watches: [
        {
          id: "watch-1",
          departAt: new Date("2026-10-01T00:00:00.000Z"),
          metadata: { origin: "LHE", destination: "LHR" },
        },
      ],
    });
    assert.equal(items[0].kind, "UPCOMING_JOURNEY");
    assert.match(items[0].reason, /upcoming monitored journey/i);
    assert.equal(items[0].destination, "LHR");
  });
});
