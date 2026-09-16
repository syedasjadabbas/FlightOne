/**
 * Galileo GDS adapter — Travelport TripServices Flights when configured,
 * otherwise deterministic stub offers for local orchestration tests.
 *
 * Supplier code stays GALILEO (content host). HTTP talks to TripServices.
 * See flight-one/docs/integrations/travelport-tripservices.md.
 */
import { DEFAULT_SUPPLIER_TIMEOUT_MS, withTimeout } from "./adapter.js";
import { isTravelportConfigured } from "./travelport/config.js";
import * as travelportSearch from "./travelport/search.js";

const SUPPLIER_CODE = "GALILEO";

function fakeOffer(query, index) {
  const amountMinor = 28000 + index * 5500;
  return {
    supplierCode: SUPPLIER_CODE,
    offerId: `GAL-${query.origin}${query.destination}-${index + 1}`,
    product: "FLIGHT",
    currency: "USD",
    amountMinor,
    fareRules: {
      refundable: index === 0,
      changeFeeMinor: index === 0 ? 0 : 7500,
    },
    details: {
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate ?? null,
      cabinClass: query.cabinClass ?? "ECONOMY",
      cabin: "economy",
      carrier: index === 0 ? "PK" : "EK",
      stops: index,
      durationMinutes: 180 + index * 45,
      departTimeLocal: index === 0 ? "08:30" : "14:15",
    },
  };
}

async function performStubSearch(query) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [fakeOffer(query, 0), fakeOffer(query, 1)];
}

/** @param {import('./adapter.js').FlightSearchQuery} query */
export async function searchFlights(query, { timeoutMs } = {}) {
  if (isTravelportConfigured()) {
    const ms = timeoutMs ?? (Number(process.env.TRAVELPORT_TIMEOUT_MS) || 45000);
    return withTimeout(
      travelportSearch.searchFlights(query),
      ms,
      `${SUPPLIER_CODE} Travelport searchFlights`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      `[${SUPPLIER_CODE}] Travelport not configured — refusing stub flight inventory in production`,
    );
    return [];
  }

  console.warn(`[${SUPPLIER_CODE}] Travelport not configured — using local stub offers (dev only)`);
  return withTimeout(
    performStubSearch(query),
    timeoutMs ?? DEFAULT_SUPPLIER_TIMEOUT_MS,
    `${SUPPLIER_CODE} searchFlights`,
  );
}
