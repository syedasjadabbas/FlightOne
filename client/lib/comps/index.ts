/**
 * Competitive intelligence — SerpAPI (Google Hotels / Flights) + Travelport resolve.
 *
 * Contracts:
 * - Bookable offer cards: GDS / Travelport only.
 * - Google / OTA figures: indicative narrative for Ava, never sold as ours.
 *
 * Hotels: named miss → scored comps → GDS; named hit + OTA cheaper → courtesy + cheaper comps.
 * Flights: preferred-airline courtesy + nearby airports + Google Flights market check.
 */
export { resolveHotelComps, type HotelCompsResolveResult } from "./hotelComps";
export { resolveFlightComps, type FlightCompsResolveResult } from "./flightComps";
export type { FlightCompsBundle } from "./flightComps";
export { isSerpConfigured } from "./serpHotels";
export type { HotelCompsBundle, HotelCompsQuery, IndicativeOtaComp } from "./types";
export { altAirports, airportsForMetro } from "./altAirports";
export {
  bucketsForGdsPipeline,
  fillEmptyFlightLegsFromWeb,
  isWebMetaConfigured,
  isWebMetaOffer,
  serpOptionsToFlightOffers,
} from "./webLegFallback";
