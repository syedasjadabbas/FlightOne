/**
 * Module 09 — ancillary providers + change detection (no DB).
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  getAncillaryCapabilities,
  fetchWeatherDisruption,
  fetchHotelCheckInStatus,
  fetchTransferStatus,
  fetchImmigrationAdvisory,
  setAncillaryFetcherForTests,
  resetAncillaryFetchersForTests,
} from "./journey.ancillaryProviders.js";
import {
  detectWeatherChanges,
  detectHotelStatusChanges,
  detectTransferStatusChanges,
  detectImmigrationChanges,
  maybeHotelCheckinReminder,
  maybeTransferReminder,
  ancillaryDedupeKey,
} from "./journey.ancillaryChanges.js";

describe("journey.ancillaryProviders", () => {
  after(() => resetAncillaryFetchersForTests());

  it("defaults all ancillary feeds to unconfigured", () => {
    const caps = getAncillaryCapabilities({
      JOURNEY_WEATHER_PROVIDER: "unconfigured",
      JOURNEY_HOTEL_STATUS_PROVIDER: "unconfigured",
      JOURNEY_TRANSFER_STATUS_PROVIDER: "unconfigured",
      JOURNEY_IMMIGRATION_PROVIDER: "unconfigured",
    });
    assert.equal(caps.weather.canPollLive, false);
    assert.equal(caps.hotel.canPollLive, false);
    assert.equal(caps.transfer.canPollLive, false);
    assert.equal(caps.immigration.canPollLive, false);
  });

  it("weather fetch returns UNCONFIGURED without inventing alerts", async () => {
    resetAncillaryFetchersForTests();
    const r = await fetchWeatherDisruption(
      { origin: "LHE", destination: "DXB" },
      { JOURNEY_WEATHER_PROVIDER: "unconfigured", NODE_ENV: "test" },
    );
    assert.equal(r.dataStatus, "UNCONFIGURED");
    assert.equal(r.snapshot, null);
  });

  it("hotel/transfer/immigration unconfigured never invent status", async () => {
    const env = {
      JOURNEY_HOTEL_STATUS_PROVIDER: "unconfigured",
      JOURNEY_TRANSFER_STATUS_PROVIDER: "unconfigured",
      JOURNEY_IMMIGRATION_PROVIDER: "unconfigured",
      NODE_ENV: "test",
    };
    assert.equal(
      (await fetchHotelCheckInStatus({ checkInDate: "2026-09-10" }, env)).dataStatus,
      "UNCONFIGURED",
    );
    assert.equal(
      (await fetchTransferStatus({ pickupAt: "2026-09-10T08:00:00Z" }, env)).dataStatus,
      "UNCONFIGURED",
    );
    assert.equal(
      (await fetchImmigrationAdvisory({ destinationCountry: "AE" }, env)).dataStatus,
      "UNCONFIGURED",
    );
  });

  it("test weather fetcher returns attributed alert only when injected", async () => {
    process.env.NODE_ENV = "test";
    setAncillaryFetcherForTests("weather", async () => ({
      alertId: "wx1",
      title: "Thunderstorm",
      summary: "Severe storms near DXB",
      severity: "HIGH",
      airportCode: "DXB",
      observedAt: new Date().toISOString(),
      source: "test-wx",
    }));
    const r = await fetchWeatherDisruption({ destination: "DXB" });
    assert.equal(r.isFact, true);
    assert.equal(r.snapshot.alertId, "wx1");
    resetAncillaryFetchersForTests();
  });
});

describe("journey.ancillaryChanges", () => {
  it("detects weather / hotel / transfer / immigration changes", () => {
    assert.equal(
      detectWeatherChanges(null, {
        alertId: "a1",
        title: "Fog",
        severity: "MED",
        airportCode: "LHE",
      }).length,
      1,
    );
    assert.equal(
      detectHotelStatusChanges({ status: "CONFIRMED" }, { status: "CANCELLED" })[0].type,
      "HOTEL_CHECKIN",
    );
    assert.equal(
      detectTransferStatusChanges({ status: "SCHEDULED" }, { status: "DELAYED" })[0].type,
      "TRANSFER",
    );
    assert.equal(
      detectImmigrationChanges(null, {
        advisoryId: "i1",
        title: "Entry note",
        summary: "Carry onward ticket",
        destinationCountry: "AE",
      }).length,
      1,
    );
  });

  it("unchanged snapshots yield no changes", () => {
    const wx = { alertId: "a1", title: "Fog", severity: "MED" };
    assert.deepEqual(detectWeatherChanges(wx, { ...wx }), []);
  });

  it("hotel check-in reminder uses booking date only", () => {
    const hit = maybeHotelCheckinReminder(
      { checkInDate: new Date(Date.now() + 6 * 3600_000).toISOString() },
      { now: new Date(), leadHours: 24 },
    );
    assert.ok(hit);
    assert.equal(hit.type, "HOTEL_CHECKIN");
    assert.match(hit.body, /booking data only/i);
  });

  it("transfer reminder uses booking pickup only", () => {
    const hit = maybeTransferReminder(
      { transferPickupAt: new Date(Date.now() + 60 * 60_000).toISOString() },
      { now: new Date(), leadMinutes: 180 },
    );
    assert.ok(hit);
    assert.equal(hit.type, "TRANSFER");
  });

  it("stable ancillary dedupe keys", () => {
    assert.equal(
      ancillaryDedupeKey("weather", "w1", "a1:HIGH:Storm"),
      "journey-weather:w1:a1:HIGH:Storm",
    );
  });
});
