/**
 * Profile → Ava preference merge tests.
 * Run: npx vitest run lib/ask-ai/profilePreferences.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  applyProfilePreferenceDefaults,
  fillMissingIntentFilters,
  formatProfilePrefsForPrompt,
  profileToTravelPreferences,
} from "./profilePreferences";
import type { TravelPlan } from "@/lib/consultant/travelPlan";

describe("profileToTravelPreferences", () => {
  it("maps ranking-relevant fields only", () => {
    const prefs = profileToTravelPreferences({
      preferredAirlines: ["ey", "PK"],
      maxLayoverMinutes: 180,
      preferredCabin: "business",
      seatPref: "aisle",
      mealPref: "halal",
      phone: "+92",
    });
    expect(prefs?.preferredAirlines).toEqual(["EY", "PK"]);
    expect(prefs?.maxLayoverMinutes).toBe(180);
    expect(prefs?.preferredCabin).toBe("BUSINESS");
    expect(prefs?.seatPref).toBe("aisle");
  });

  it("merges loyalty airline codes into preferredAirlines for soft defaults", () => {
    const prefs = profileToTravelPreferences({
      preferredAirlines: ["PK"],
      loyaltyAirlineCodes: ["ey", "QR"],
      hotelLoyaltyChains: ["marriott"],
      companions: [{ fullName: "Kid", kind: "FAMILY" }],
      travelHistory: { totalBookings: 2, completedBookings: 1 },
    });
    expect(prefs?.preferredAirlines).toEqual(["PK", "EY", "QR"]);
    expect(prefs?.loyaltyAirlineCodes).toEqual(["EY", "QR"]);
    expect(prefs?.hotelLoyaltyChains).toEqual(["MARRIOTT"]);
    expect(prefs?.companions?.[0].fullName).toBe("Kid");
  });

  it("returns null when nothing useful is set", () => {
    expect(profileToTravelPreferences({ displayName: "Ada" })).toBeNull();
  });
});

describe("fillMissingIntentFilters / applyProfilePreferenceDefaults", () => {
  it("fills preferred airlines when conversation left them empty", () => {
    const filled = fillMissingIntentFilters(
      {},
      { preferredAirlines: ["EY"], maxLayoverMinutes: 120 },
    );
    expect(filled.preferredAirlines).toEqual(["EY"]);
    expect(filled.maxLayoverMinutes).toBe(120);
  });

  it("does not overwrite explicit conversation preferences", () => {
    const filled = fillMissingIntentFilters(
      { preferredAirlines: ["QR"], maxLayoverMinutes: 90 },
      { preferredAirlines: ["EY"], maxLayoverMinutes: 180 },
    );
    expect(filled.preferredAirlines).toEqual(["QR"]);
    expect(filled.maxLayoverMinutes).toBe(90);
  });

  it("applies cabin only when search query cabin is unset", () => {
    const plan = {
      action: "search" as const,
      searches: [
        {
          product: "FLIGHT" as const,
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "2026-09-18",
            passengers: 1,
          },
        },
      ],
      filters: {},
    } satisfies TravelPlan;

    const withCabin = applyProfilePreferenceDefaults(plan, {
      preferredCabin: "BUSINESS",
      preferredAirlines: ["EY"],
    });
    expect(withCabin && withCabin.action === "search" && withCabin.searches[0]).toMatchObject({
      query: { cabinClass: "BUSINESS" },
    });
    expect(withCabin && withCabin.action === "search" && withCabin.filters).toMatchObject({
      preferredAirlines: ["EY"],
    });

    const explicit: TravelPlan = {
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "2026-09-18",
            passengers: 1,
            cabinClass: "ECONOMY",
          },
        },
      ],
      filters: { preferredAirlines: ["PK"] },
    };
    const kept = applyProfilePreferenceDefaults(explicit, {
      preferredCabin: "BUSINESS",
      preferredAirlines: ["EY"],
    });
    expect(
      kept &&
        kept.action === "search" &&
        kept.searches[0].product === "FLIGHT" &&
        kept.searches[0].query.cabinClass,
    ).toBe("ECONOMY");
    expect(kept && kept.action === "search" && kept.filters?.preferredAirlines).toEqual([
      "PK",
    ]);
  });
});

describe("formatProfilePrefsForPrompt", () => {
  it("formats soft context without inventing facts", () => {
    const line = formatProfilePrefsForPrompt({
      preferredAirlines: ["EY"],
      seatPref: "window",
      mealPref: "halal",
      companions: [{ fullName: "Sam" }],
      travelHistory: {
        totalBookings: 3,
        completedBookings: 2,
        frequentRoutes: ["LHE-DXB"],
        frequentAirlines: ["EY", "PK"],
        recentTrips: [{ route: "LHE-DXB", airline: "EY", cabin: "ECONOMY" }],
      },
    });
    expect(line).toMatch(/preferred airlines EY/i);
    expect(line).toMatch(/seat window/i);
    expect(line).toMatch(/meal halal/i);
    expect(line).toMatch(/Sam/);
    expect(line).toMatch(/prior bookings on file: 3/);
    expect(line).toMatch(/past routes LHE-DXB/);
    expect(line).toMatch(/airlines flown before EY, PK/);
    expect(line).toMatch(/recent trips: LHE-DXB EY ECONOMY/);
  });

  it("does not push history airlines into ranking filters", () => {
    const prefs = profileToTravelPreferences({
      travelHistory: {
        totalBookings: 2,
        frequentAirlines: ["QR"],
        frequentRoutes: ["ISB-JED"],
      },
    });
    expect(prefs?.preferredAirlines).toBeUndefined();
    expect(prefs?.travelHistory?.frequentAirlines).toEqual(["QR"]);
    const filled = fillMissingIntentFilters({}, prefs!);
    expect(filled.preferredAirlines).toBeUndefined();
  });
});
