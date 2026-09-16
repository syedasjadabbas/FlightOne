import { PLACE_TO_IATA, placeToIata } from "@/lib/inventory/places";

/**
 * Extra city aliases IP/GPS APIs often return that should map to our inventory
 * / Travelport hubs.
 */
const CITY_ALIASES: Record<string, string> = {
  "lahore city": "Lahore",
  "lahore district": "Lahore",
  "karachi city": "Karachi",
  "islamabad capital territory": "Islamabad",
  rawalpindi: "Islamabad",
  "dubai city": "Dubai",
  sharjah: "Dubai",
  "abu dhabi": "Abu Dhabi",
  "city of london": "London",
  westminster: "London",
  "greater london": "London",
  "new york city": "New York",
  nyc: "New York",
  brooklyn: "New York",
  manhattan: "New York",
  "los angeles": "Los Angeles",
  "bangkok metropolis": "Bangkok",
  "kuala lumpur city": "Kuala Lumpur",
  "hong kong island": "Hong Kong",
  "new delhi": "Delhi",
  "bombay": "Mumbai",
};

/** Country defaults when city is unknown but we know the country (airport hub). */
const COUNTRY_HUB: Record<string, string> = {
  PK: "Lahore",
  AE: "Dubai",
  SA: "Jeddah",
  QA: "Doha",
  GB: "London",
  UK: "London",
  US: "New York",
  FR: "Paris",
  NL: "Amsterdam",
  ES: "Barcelona",
  IT: "Rome",
  TR: "Istanbul",
  TH: "Bangkok",
  MY: "Kuala Lumpur",
  SG: "Singapore",
  EG: "Cairo",
  MA: "Casablanca",
  LK: "Colombo",
  MV: "Maldives",
  IN: "Delhi",
  CA: "Toronto",
  AU: "Sydney",
  JP: "Tokyo",
  KR: "Seoul",
  HK: "Hong Kong",
  DE: "Frankfurt",
  CH: "Zurich",
};

/**
 * Resolve free-text city (/region) from a geo provider into a known place + IATA.
 * If nothing maps, keep the raw city and leave iata null (orchestrator asks / soft-falls back).
 */
export function matchTravellerPlace(input: {
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}): { place: string; iata: string | null; city: string } {
  const candidates = [input.city, input.region]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());

  for (const raw of candidates) {
    const direct = placeToIata(raw);
    if (direct) {
      return { place: canonicalPlaceName(raw) || raw, iata: direct, city: raw };
    }

    const aliased = CITY_ALIASES[raw.toLowerCase()];
    if (aliased) {
      return { place: aliased, iata: placeToIata(aliased), city: raw };
    }

    const lower = raw.toLowerCase();
    for (const place of Object.keys(PLACE_TO_IATA)) {
      const p = place.toLowerCase();
      if (lower.includes(p) || p.includes(lower)) {
        return { place, iata: PLACE_TO_IATA[place], city: raw };
      }
    }
  }

  const cc = input.countryCode?.toUpperCase();
  if (cc && COUNTRY_HUB[cc] && placeToIata(COUNTRY_HUB[cc])) {
    const hub = COUNTRY_HUB[cc];
    return {
      place: hub,
      iata: placeToIata(hub),
      city: candidates[0] || hub,
    };
  }

  const city = candidates[0] || "Lahore";
  // Unknown city — still surface it in pitch copy; flights need an IATA so leave null.
  return { place: city, iata: placeToIata(city), city };
}

function canonicalPlaceName(raw: string): string | null {
  const lower = raw.toLowerCase();
  for (const place of Object.keys(PLACE_TO_IATA)) {
    if (place.toLowerCase() === lower) return place;
  }
  return null;
}
