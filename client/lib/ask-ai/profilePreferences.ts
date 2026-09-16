/**
 * Map Module 02 personalization / profile fields into soft TravelPlan defaults for Ava.
 * Conversation / previous-turn filters always win — profile only fills gaps.
 * Travel-history routes/airlines are prompt context only (never Module 01 ranking inputs).
 */
import type { IntentFilters } from "@/lib/consultant/types";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";

export type ProfileCompanionContext = {
  fullName: string;
  kind?: string | null;
  relationship?: string | null;
};

export type ProfileTravelHistoryContext = {
  totalBookings?: number;
  completedBookings?: number;
  recentProducts?: string[];
  frequentRoutes?: string[];
  frequentAirlines?: string[];
  frequentCabins?: string[];
  recentTrips?: Array<{
    product?: string | null;
    route?: string | null;
    airline?: string | null;
    cabin?: string | null;
    status?: string | null;
  }>;
};

export type ProfileTravelPreferences = {
  preferredAirlines?: string[];
  maxLayoverMinutes?: number | null;
  preferredCabin?: string | null;
  seatPref?: string | null;
  mealPref?: string | null;
  /** Soft airline codes from FF memberships (merged under preferredAirlines gaps). */
  loyaltyAirlineCodes?: string[];
  hotelLoyaltyChains?: string[];
  companions?: ProfileCompanionContext[];
  travelHistory?: ProfileTravelHistoryContext | null;
};

const CABINS = new Set(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]);

function uniqAirlines(codes: string[] | undefined): string[] | undefined {
  if (!codes?.length) return undefined;
  const out = [
    ...new Set(
      codes
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim().toUpperCase()),
    ),
  ].slice(0, 20);
  return out.length ? out : undefined;
}

function sanitizeStringList(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = [
    ...new Set(
      value
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim().toUpperCase()),
    ),
  ].slice(0, limit);
  return out.length ? out : undefined;
}

function sanitizeTravelHistory(
  raw: unknown,
): ProfileTravelHistoryContext | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const recentTrips = Array.isArray(h.recentTrips)
    ? h.recentTrips
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .map((t) => ({
          product: typeof t.product === "string" ? t.product : null,
          route: typeof t.route === "string" ? t.route.toUpperCase() : null,
          airline: typeof t.airline === "string" ? t.airline.toUpperCase() : null,
          cabin: typeof t.cabin === "string" ? t.cabin.toUpperCase() : null,
          status: typeof t.status === "string" ? t.status : null,
        }))
        .filter((t) => t.route || t.airline)
        .slice(0, 5)
    : undefined;

  const out: ProfileTravelHistoryContext = {
    totalBookings:
      typeof h.totalBookings === "number" && Number.isFinite(h.totalBookings)
        ? h.totalBookings
        : 0,
    completedBookings:
      typeof h.completedBookings === "number" && Number.isFinite(h.completedBookings)
        ? h.completedBookings
        : 0,
    recentProducts: Array.isArray(h.recentProducts)
      ? (h.recentProducts as unknown[])
          .filter((p): p is string => typeof p === "string")
          .slice(0, 5)
      : undefined,
    frequentRoutes: sanitizeStringList(h.frequentRoutes, 5),
    frequentAirlines: sanitizeStringList(h.frequentAirlines, 5),
    frequentCabins: sanitizeStringList(h.frequentCabins, 3),
    recentTrips,
  };

  const hasSignal =
    (out.totalBookings ?? 0) > 0 ||
    !!out.frequentRoutes?.length ||
    !!out.frequentAirlines?.length ||
    !!out.recentTrips?.length;
  return hasSignal ? out : null;
}

/** Narrow profile or /personalization JSON into ranking/prompt prefs (no document PII). */
export function profileToTravelPreferences(
  profile: Record<string, unknown> | null | undefined,
): ProfileTravelPreferences | null {
  if (!profile || typeof profile !== "object") return null;

  const preferred = uniqAirlines(
    Array.isArray(profile.preferredAirlines)
      ? (profile.preferredAirlines as unknown[]).filter(
          (c): c is string => typeof c === "string",
        )
      : undefined,
  );
  const loyaltyAirlineCodes = uniqAirlines(
    Array.isArray(profile.loyaltyAirlineCodes)
      ? (profile.loyaltyAirlineCodes as unknown[]).filter(
          (c): c is string => typeof c === "string",
        )
      : undefined,
  );

  const maxLayover =
    typeof profile.maxLayoverMinutes === "number" &&
    Number.isFinite(profile.maxLayoverMinutes) &&
    profile.maxLayoverMinutes >= 0
      ? Math.round(profile.maxLayoverMinutes)
      : null;

  const cabinRaw =
    typeof profile.preferredCabin === "string"
      ? profile.preferredCabin.trim().toUpperCase().replace(/\s+/g, "_")
      : null;
  const preferredCabin = cabinRaw && CABINS.has(cabinRaw) ? cabinRaw : null;

  const seatPref =
    typeof profile.seatPref === "string" && profile.seatPref.trim()
      ? profile.seatPref.trim().slice(0, 60)
      : null;
  const mealPref =
    typeof profile.mealPref === "string" && profile.mealPref.trim()
      ? profile.mealPref.trim().slice(0, 120)
      : null;

  const hotelLoyaltyChains = Array.isArray(profile.hotelLoyaltyChains)
    ? [
        ...new Set(
          (profile.hotelLoyaltyChains as unknown[])
            .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
            .map((c) => c.trim().toUpperCase()),
        ),
      ].slice(0, 20)
    : undefined;

  const companions = Array.isArray(profile.companions)
    ? (profile.companions as unknown[])
        .filter(
          (c): c is Record<string, unknown> =>
            !!c && typeof c === "object" && typeof (c as { fullName?: unknown }).fullName === "string",
        )
        .map((c) => ({
          fullName: String(c.fullName).trim().slice(0, 80),
          kind: typeof c.kind === "string" ? c.kind : null,
          relationship: typeof c.relationship === "string" ? c.relationship : null,
        }))
        .filter((c) => c.fullName.length > 0)
        .slice(0, 12)
    : undefined;

  const travelHistory = sanitizeTravelHistory(profile.travelHistory);

  // Ranking soft defaults: saved prefs + loyalty only. History airlines stay prompt-only.
  const mergedAirlines = uniqAirlines([
    ...(preferred ?? []),
    ...(loyaltyAirlineCodes ?? []),
  ]);

  if (
    !mergedAirlines?.length &&
    maxLayover == null &&
    !preferredCabin &&
    !seatPref &&
    !mealPref &&
    !(hotelLoyaltyChains && hotelLoyaltyChains.length) &&
    !(companions && companions.length) &&
    !travelHistory
  ) {
    return null;
  }

  return {
    preferredAirlines: mergedAirlines,
    loyaltyAirlineCodes,
    hotelLoyaltyChains: hotelLoyaltyChains?.length ? hotelLoyaltyChains : undefined,
    maxLayoverMinutes: maxLayover,
    preferredCabin,
    seatPref,
    mealPref,
    companions,
    travelHistory,
  };
}

/** Fill only keys the conversation has not already set. */
export function fillMissingIntentFilters(
  existing: IntentFilters | undefined,
  prefs: ProfileTravelPreferences,
): IntentFilters {
  const next: IntentFilters = { ...(existing ?? {}) };
  if (
    (!next.preferredAirlines || next.preferredAirlines.length === 0) &&
    prefs.preferredAirlines?.length
  ) {
    next.preferredAirlines = [...prefs.preferredAirlines];
  }
  if (next.maxLayoverMinutes == null && prefs.maxLayoverMinutes != null) {
    next.maxLayoverMinutes = prefs.maxLayoverMinutes;
  }
  return next;
}

function fillMissingCabin(
  query: FlightSearchQuery,
  preferredCabin: string | null | undefined,
): FlightSearchQuery {
  if (!preferredCabin || query.cabinClass) return query;
  if (!CABINS.has(preferredCabin)) return query;
  return {
    ...query,
    cabinClass: preferredCabin as FlightSearchQuery["cabinClass"],
  };
}

/**
 * Apply saved profile preferences under conversation intent.
 * Latest explicit TravelPlan filters / cabin always win.
 * History patterns are not applied to ranking filters.
 */
export function applyProfilePreferenceDefaults(
  plan: TravelPlan | null,
  prefs: ProfileTravelPreferences | null | undefined,
): TravelPlan | null {
  if (!plan || !prefs) return plan;

  if (plan.action === "search") {
    return {
      ...plan,
      filters: fillMissingIntentFilters(plan.filters, prefs),
      searches: plan.searches.map((s) =>
        s.product === "FLIGHT"
          ? {
              ...s,
              query: fillMissingCabin(s.query, prefs.preferredCabin),
            }
          : s,
      ),
    };
  }

  if (plan.action === "clarify" && plan.draft) {
    return {
      ...plan,
      draft: {
        ...plan.draft,
        filters: fillMissingIntentFilters(plan.draft.filters, prefs),
        searches: plan.draft.searches.map((s) =>
          s.product === "FLIGHT"
            ? {
                ...s,
                query: fillMissingCabin(s.query, prefs.preferredCabin),
              }
            : s,
        ),
      },
    };
  }

  return plan;
}

/** Soft prompt context — never invents booking facts or document numbers. */
export function formatProfilePrefsForPrompt(
  prefs: ProfileTravelPreferences | null | undefined,
): string | null {
  if (!prefs) return null;
  const bits: string[] = [];
  if (prefs.preferredAirlines?.length) {
    bits.push(`preferred airlines ${prefs.preferredAirlines.join(", ")}`);
  }
  if (prefs.preferredCabin) bits.push(`cabin ${prefs.preferredCabin}`);
  if (prefs.maxLayoverMinutes != null) {
    bits.push(`max layover ${Math.round(prefs.maxLayoverMinutes / 60)}h`);
  }
  if (prefs.seatPref) bits.push(`seat ${prefs.seatPref}`);
  if (prefs.mealPref) bits.push(`meal ${prefs.mealPref}`);
  if (prefs.hotelLoyaltyChains?.length) {
    bits.push(`hotel loyalty ${prefs.hotelLoyaltyChains.join(", ")}`);
  }
  if (prefs.companions?.length) {
    const names = prefs.companions
      .map((c) => c.fullName)
      .filter(Boolean)
      .slice(0, 5);
    if (names.length) bits.push(`saved companions/family on profile: ${names.join(", ")}`);
  }

  const hist = prefs.travelHistory;
  if (hist) {
    if ((hist.totalBookings ?? 0) > 0) {
      bits.push(
        `prior bookings on file: ${hist.totalBookings}` +
          (hist.completedBookings
            ? ` (${hist.completedBookings} completed)`
            : ""),
      );
    }
    if (hist.frequentRoutes?.length) {
      bits.push(`past routes ${hist.frequentRoutes.slice(0, 4).join(", ")}`);
    }
    if (hist.frequentAirlines?.length) {
      bits.push(
        `airlines flown before ${hist.frequentAirlines.slice(0, 4).join(", ")}`,
      );
    }
    if (hist.frequentCabins?.length) {
      bits.push(`past cabins ${hist.frequentCabins.join(", ")}`);
    }
    if (hist.recentTrips?.length) {
      const tripBits = hist.recentTrips
        .slice(0, 3)
        .map((t) =>
          [t.route, t.airline, t.cabin].filter(Boolean).join(" "),
        )
        .filter(Boolean);
      if (tripBits.length) bits.push(`recent trips: ${tripBits.join("; ")}`);
    }
  }

  if (!bits.length) return null;
  return `SAVED TRAVELLER PREFERENCES (use only when the user did not contradict them this turn): ${bits.join("; ")}.`;
}
