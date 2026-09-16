/**
 * Build a validated TripServices Stays SearchComplete request body.
 *
 * Official schema (not the simplified migration snippets):
 * - stayDetails.guests.adults (integer ≥ 1) — NOT numberOfAdults
 * - stayDetails.rooms (integer ≥ 1)
 * - propertyFilter.location.type = "cityIATACode" | "airportIATACode" | …
 * - propertyFilter.location.details.iataCode
 * - propertyFilter.location.radius = { value: integer, unit: "km"|"mi" }
 *
 * @see https://support.travelport.com/webhelp/JSONAPIs/Hotelv11/Content/Hotel11/APIReferences/APIRef_SearchComplete.htm
 */

/**
 * @param {import("../adapter.js").HotelSearchQuery} query
 * @param {{ requestedCurrency: string, radiusKm?: number, maxWaitMs?: number }} opts
 */
export function buildStaysSearchCompleteBody(query, opts) {
  const adults = Math.trunc(Math.min(8, Math.max(1, Number(query.guests) || 1)));
  const rooms = Math.trunc(Math.min(5, Math.max(1, Number(query.rooms) || 1)));
  const iata = String(query.cityCode || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) {
    throw new Error(`Stays search requires a 3-letter IATA city/airport code, got: ${query.cityCode}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(query.checkOutDate)) {
    throw new Error("Stays search requires checkInDate/checkOutDate as YYYY-MM-DD");
  }

  const radiusValue = Math.trunc(
    Math.min(100, Math.max(1, Number(opts.radiusKm) || 25)),
  );
  const requestedCurrency = String(opts.requestedCurrency || "PKR")
    .toUpperCase()
    .slice(0, 3);

  /** @type {Record<string, unknown>} */
  const propertyFilter = {
    location: {
      type: "cityIATACode",
      details: {
        iataCode: iata,
      },
      radius: {
        value: radiusValue,
        unit: "km",
      },
    },
    returnOnlyAvailableProperties: true,
    returnRateSummaryInfo: true,
    maxWaitTime: Math.trunc(Math.max(1000, Number(opts.maxWaitMs) || 8000)),
  };

  const hotelName = typeof query.hotelName === "string" ? query.hotelName.trim() : "";
  if (hotelName) {
    propertyFilter.hotelNameContains = hotelName.slice(0, 80);
  }

  return {
    stayDetails: {
      checkInDateLocal: query.checkInDate,
      checkOutDateLocal: query.checkOutDate,
      rooms,
      guests: {
        adults,
      },
    },
    propertyFilter,
    requestedCurrency,
    returnCompleteNightlyRateBreakdown: false,
  };
}
