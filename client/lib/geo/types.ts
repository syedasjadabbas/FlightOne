/**
 * Traveller location for Ava pitch (origin city / currency / copy).
 * Resolved client-side: browser GPS → reverse geocode, else IP geo.
 */

export type LocationSource = "browser" | "ip" | "default";

export interface TravellerLocation {
  /** Display city, e.g. "Karachi" */
  city: string;
  /** Canonical inventory place when we have one, else same as city */
  place: string;
  country?: string;
  countryCode?: string;
  region?: string;
  /** Nearest known IATA when place maps to PLACE_TO_IATA */
  iata: string | null;
  /** Preferred display/search currency for this traveller */
  currency: string;
  source: LocationSource;
  latitude?: number;
  longitude?: number;
}

export function isTravellerLocation(v: unknown): v is TravellerLocation {
  if (!v || typeof v !== "object") return false;
  const o = v as TravellerLocation;
  return (
    typeof o.city === "string" &&
    o.city.trim().length > 0 &&
    typeof o.place === "string" &&
    typeof o.source === "string" &&
    typeof o.currency === "string" &&
    (o.iata === null || typeof o.iata === "string")
  );
}
