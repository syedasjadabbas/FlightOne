/**
 * Module 09 — journey change detection + status provider (no DB).
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  detectMeaningfulStatusChanges,
  journeyChangeDedupeKey,
  maybeBoardingReminder,
} from "./journey.changes.js";
import {
  getJourneyStatusCapability,
  normalizeFlightStatusPayload,
  fetchFlightStatus,
  setStatusFetcherForTests,
  resetStatusFetcherForTests,
} from "./journey.statusProvider.js";

describe("journey.statusProvider", () => {
  after(() => resetStatusFetcherForTests());

  it("defaults to unconfigured / cannot poll live", () => {
    const cap = getJourneyStatusCapability({ JOURNEY_STATUS_PROVIDER: "unconfigured" });
    assert.equal(cap.configured, false);
    assert.equal(cap.canPollLive, false);
  });

  it("http without URL is misconfigured", () => {
    const cap = getJourneyStatusCapability({
      JOURNEY_STATUS_PROVIDER: "http",
      JOURNEY_STATUS_HTTP_URL: "",
    });
    assert.equal(cap.canPollLive, false);
  });

  it("never invents fields when normalizing sparse payloads", () => {
    const snap = normalizeFlightStatusPayload({ status: "DELAYED" }, { flightNumber: "PK309" });
    assert.equal(snap.flightNumber, "PK309");
    assert.equal(snap.gate, null);
    assert.equal(snap.terminal, null);
    assert.equal(snap.minutesDelayed, null);
    assert.equal(snap.observedAt, null);
  });

  it("does not advertise ancillary feeds as deferred (they have their own providers)", () => {
    const cap = getJourneyStatusCapability({ JOURNEY_STATUS_PROVIDER: "unconfigured" });
    assert.deepEqual(cap.deferredFeeds, []);
  });

  it("missing observedAt is DATA_UNAVAILABLE — never VERIFIED", async () => {
    process.env.NODE_ENV = "test";
    setStatusFetcherForTests(async () => ({
      status: "DELAYED",
      minutesDelayed: 30,
      // no observedAt
    }));
    const result = await fetchFlightStatus({ flightNumber: "PK309" });
    assert.equal(result.dataStatus, "DATA_UNAVAILABLE");
    assert.equal(result.isFact, false);
    assert.equal(result.snapshot, null);
    resetStatusFetcherForTests();
  });

  it("provider failure surfaces PROVIDER_ERROR without inventing status", async () => {
    process.env.NODE_ENV = "test";
    setStatusFetcherForTests(async () => {
      throw new Error("upstream timeout");
    });
    const result = await fetchFlightStatus({ flightNumber: "PK309" });
    assert.equal(result.dataStatus, "PROVIDER_ERROR");
    assert.equal(result.isFact, false);
    assert.equal(result.snapshot, null);
    resetStatusFetcherForTests();
  });

  it("fetchFlightStatus returns UNCONFIGURED without fabricating", async () => {
    process.env.NODE_ENV = "test";
    resetStatusFetcherForTests();
    const prev = process.env.JOURNEY_STATUS_PROVIDER;
    process.env.JOURNEY_STATUS_PROVIDER = "unconfigured";
    const result = await fetchFlightStatus({ flightNumber: "PK309" });
    assert.equal(result.dataStatus, "UNCONFIGURED");
    assert.equal(result.isFact, false);
    assert.equal(result.snapshot, null);
    process.env.JOURNEY_STATUS_PROVIDER = prev;
  });

  it("test fetcher can return attributed status only when injected", async () => {
    process.env.NODE_ENV = "test";
    setStatusFetcherForTests(async () => ({
      status: "DELAYED",
      minutesDelayed: 45,
      gate: "B12",
      observedAt: new Date().toISOString(),
      source: "test-feed",
    }));
    const result = await fetchFlightStatus({ flightNumber: "PK309" });
    assert.equal(result.isFact, true);
    assert.equal(result.snapshot.minutesDelayed, 45);
    assert.equal(result.snapshot.gate, "B12");
    resetStatusFetcherForTests();
  });
});

describe("journey.changes", () => {
  it("detects delay, gate, terminal, cancellation", () => {
    const changes = detectMeaningfulStatusChanges(
      { status: "SCHEDULED", gate: "A1", terminal: "1", minutesDelayed: 0 },
      {
        status: "CANCELLED",
        gate: "A2",
        terminal: "2",
        minutesDelayed: 0,
        flightNumber: "PK309",
      },
      { flightNumber: "PK309" },
    );
    assert.ok(changes.some((c) => c.type === "CANCELLED" && c.escalateRecommended));
    assert.ok(changes.some((c) => c.type === "GATE_CHANGE"));
    assert.ok(changes.some((c) => c.type === "TERMINAL_CHANGE"));
  });

  it("unchanged snapshot yields no changes", () => {
    const snap = { status: "SCHEDULED", gate: "A1", terminal: "1", minutesDelayed: 0 };
    assert.deepEqual(detectMeaningfulStatusChanges(snap, { ...snap }), []);
  });

  it("stable dedupe keys", () => {
    assert.equal(
      journeyChangeDedupeKey("w1", { type: "DELAY", fingerprint: "delay:45" }),
      "journey-change:w1:DELAY:delay:45",
    );
  });

  it("boarding reminder only inside lead window using real departAt", () => {
    const departAt = new Date(Date.now() + 60 * 60 * 1000);
    const hit = maybeBoardingReminder(
      { flightNumber: "PK309", departAt },
      { now: new Date(), leadMinutes: 90 },
    );
    assert.ok(hit);
    assert.equal(hit.type, "BOARDING");
    const miss = maybeBoardingReminder(
      { flightNumber: "PK309", departAt: new Date(Date.now() + 5 * 60 * 60 * 1000) },
      { now: new Date(), leadMinutes: 90 },
    );
    assert.equal(miss, null);
  });
});
