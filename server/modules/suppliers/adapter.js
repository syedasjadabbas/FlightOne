/**
 * Supplier Integration Layer — adapter interface (dev guide §7: "supplier
 * integrations are isolated behind an adapter layer... Galileo/RateHawk today
 * and Amadeus/Sabre/NDC/Hotelbeds/etc. later are swappable without touching
 * booking orchestration or pricing logic"). Every real supplier adapter must
 * implement this shape; booking orchestration (modules/bookings/) and the
 * search route below never call a supplier SDK directly.
 *
 * @typedef {Object} SupplierOffer
 * @property {string} supplierCode  e.g. "GALILEO", "RATEHAWK"
 * @property {string} offerId       supplier-side offer/rate identifier
 * @property {"FLIGHT"|"HOTEL"} product
 * @property {string} currency      ISO 4217, e.g. "USD"
 * @property {number} amountMinor   supplier net fare, integer minor units (lib/money.js) — never a float
 * @property {Object} [fareRules]   cancellation policy / fare rules snapshot
 * @property {Object} [details]     supplier-specific normalized details (route, hotel, dates, etc.)
 *
 * @typedef {Object} FlightSearchQuery
 * @property {string} origin           IATA airport/city code
 * @property {string} destination      IATA airport/city code
 * @property {string} departureDate    ISO date, "YYYY-MM-DD"
 * @property {string} [returnDate]     ISO date, "YYYY-MM-DD"
 * @property {number} [passengers]
 * @property {string} [cabinClass]     "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"
 * @property {string} [requestedCurrency] Optional ISO 4217 override via PricingModifiersAir
 * @property {string[]} [preferredCarriers] Optional IATA airline codes for CarrierPreference
 * @property {"Permitted"|"Preferred"} [carrierPreferenceType] Default Permitted when preferredCarriers set
 *
 * @typedef {Object} HotelSearchQuery
 * @property {string} cityCode
 * @property {number} [regionId] RateHawk numeric region id (IATA cityCode is not a region id)
 * @property {string} checkInDate   ISO date, "YYYY-MM-DD"
 * @property {string} checkOutDate  ISO date, "YYYY-MM-DD"
 * @property {number} [rooms]
 * @property {number} [guests]
 * @property {string} [hotelName]   Optional partial hotel name (SearchComplete hotelNameContains)
 * @property {string} [requestedCurrency] Optional ISO 4217 override (else TRAVELPORT_CURRENCY)
 *
 * @typedef {Object} SupplierAdapter
 * @property {(query: FlightSearchQuery) => Promise<SupplierOffer[]>} [searchFlights]
 * @property {(query: HotelSearchQuery) => Promise<SupplierOffer[]>} [searchHotels]
 */

import { AppError } from "../../lib/customError.js";
export {
  DEFAULT_SUPPLIER_TIMEOUT_MS,
  resetSupplierCircuitsForTests,
  getSupplierCircuitStateForTests,
  withCircuitBreaker,
} from "./adapter.circuit.js";
import { DEFAULT_SUPPLIER_TIMEOUT_MS } from "./adapter.circuit.js";

/**
 * Merge adapter results. Preserves supplier identity and offer ids.
 * Does not rank (Module 04) and does not alter prices.
 * @param {Array<import('./adapter.js').SupplierOffer[]>} batches
 */
export function mergeSupplierOffers(batches) {
  const seen = new Set();
  const out = [];
  for (const batch of batches || []) {
    if (!Array.isArray(batch)) continue;
    for (const offer of batch) {
      if (!offer?.supplierCode || !offer?.offerId) continue;
      const key = `${String(offer.supplierCode).toUpperCase()}:${offer.offerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(offer);
    }
  }
  return out;
}

/**
 * Wrap a supplier call with a hard timeout so a slow/down supplier degrades
 * gracefully (a 504) instead of hanging the booking flow (dev guide §7).
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label = "supplier call") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new AppError(504, `${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

// Re-export timeout default for callers that imported DEFAULT from this module historically.
void DEFAULT_SUPPLIER_TIMEOUT_MS;
