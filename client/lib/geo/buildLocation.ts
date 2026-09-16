import { currencyForCountry } from "./currency";
import { matchTravellerPlace } from "./matchPlace";
import type { TravellerLocation } from "./types";
import { DEFAULT_ORIGIN_PLACE, placeToIata } from "@/lib/inventory/places";

/** Safe fallback when GPS + IP both fail. */
export function defaultTravellerLocation(): TravellerLocation {
  return {
    city: DEFAULT_ORIGIN_PLACE,
    place: DEFAULT_ORIGIN_PLACE,
    country: "Pakistan",
    countryCode: "PK",
    iata: placeToIata(DEFAULT_ORIGIN_PLACE),
    currency: "PKR",
    source: "default",
  };
}

export function buildTravellerLocation(input: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  latitude?: number;
  longitude?: number;
  source: TravellerLocation["source"];
}): TravellerLocation {
  const matched = matchTravellerPlace({
    city: input.city,
    region: input.region,
    countryCode: input.countryCode,
  });

  return {
    city: matched.city,
    place: matched.place,
    country: input.country || undefined,
    countryCode: input.countryCode?.toUpperCase() || undefined,
    region: input.region || undefined,
    iata: matched.iata,
    currency: currencyForCountry(input.countryCode),
    source: input.source,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}
