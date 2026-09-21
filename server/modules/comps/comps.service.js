import { searchGoogleFlights } from "./serpFlights.js";
import { isSerpConfigured, searchGoogleHotels } from "./serpHotels.js";

export { isSerpConfigured };

/** Soft-fail wrapper — never throws on missing key / upstream errors. */
export async function searchFlights(opts) {
  return searchGoogleFlights(opts);
}

/** Soft-fail wrapper — returns { properties } for the HTTP payload. */
export async function searchHotels(opts) {
  const properties = await searchGoogleHotels(opts);
  return { properties };
}
