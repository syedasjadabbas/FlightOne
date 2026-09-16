/**
 * TripServices Flights Search API.
 */
import { randomUUID } from "node:crypto";
import { travelportFetch } from "./http.js";
import { travelportConfig } from "./config.js";
import { normalizeSearchResponse } from "./normalize.js";

const CABIN_PREFERENCE = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "PremiumEconomy",
  BUSINESS: "Business",
  FIRST: "First",
};

/**
 * @param {import("../adapter.js").FlightSearchQuery} query
 * @returns {Record<string, unknown> | null}
 */
function buildSearchModifiersAir(query) {
  /** @type {Record<string, unknown>} */
  const modifiers = { "@type": "SearchModifiersAir" };
  let used = false;

  const cabin = query.cabinClass || "ECONOMY";
  if (cabin !== "ECONOMY") {
    modifiers.CabinPreference = [
      {
        "@type": "CabinPreference",
        preferenceType: "Permitted",
        cabins: [CABIN_PREFERENCE[cabin] || "Economy"],
      },
    ];
    used = true;
  }

  const carriers = [
    ...new Set(
      (query.preferredCarriers || [])
        .map((c) => String(c || "").trim().toUpperCase())
        .filter((c) => /^[A-Z0-9]{2}$/.test(c)),
    ),
  ].slice(0, 6);

  if (carriers.length > 0) {
    const preferenceType =
      query.carrierPreferenceType === "Preferred" ? "Preferred" : "Permitted";
    modifiers.CarrierPreference = [
      {
        "@type": "CarrierPreference",
        preferenceType,
        carriers,
      },
    ];
    used = true;
  }

  return used ? modifiers : null;
}

/**
 * @param {import("../adapter.js").FlightSearchQuery} query
 * @returns {Promise<import("../adapter.js").SupplierOffer[]>}
 */
export async function searchFlights(query) {
  const cfg = travelportConfig();
  const passengers = Math.min(9, Math.max(1, query.passengers || 1));

  /** @type {any[]} */
  const searchCriteria = [
    {
      "@type": "SearchCriteriaFlight",
      departureDate: query.departureDate,
      From: { value: query.origin },
      To: { value: query.destination },
    },
  ];

  if (query.returnDate) {
    searchCriteria.push({
      "@type": "SearchCriteriaFlight",
      departureDate: query.returnDate,
      From: { value: query.destination },
      To: { value: query.origin },
    });
  }

  /** @type {Record<string, unknown>} */
  const requestAir = {
    "@type": "CatalogProductOfferingsRequestAir",
    maxNumberOfUpsellsToReturn: 2,
    offersPerPage: cfg.maxOffers,
    contentSourceList: [cfg.contentSource],
    PassengerCriteria: [
      {
        "@type": "PassengerCriteria",
        number: passengers,
        passengerTypeCode: "ADT",
      },
    ],
    SearchCriteriaFlight: searchCriteria,
    CustomResponseModifiersAir: {
      SearchRepresentation: "Journey",
    },
  };

  const modifiers = buildSearchModifiersAir(query);
  if (modifiers) {
    requestAir.SearchModifiersAir = modifiers;
  }

  const requestedCurrency = String(
    query.requestedCurrency || cfg.requestedCurrency || "PKR",
  )
    .toUpperCase()
    .slice(0, 3);

  requestAir.PricingModifiersAir = {
    "@type": "PricingModifiersAir",
    currencyCode: requestedCurrency,
  };

  const body = {
    CatalogProductOfferingsQueryRequest: {
      CatalogProductOfferingsRequest: requestAir,
    },
  };

  const traceId = `fo-${randomUUID()}`;
  try {
    const { json } = await travelportFetch("/catalog/search/catalogproductofferings", {
      method: "POST",
      body,
      traceId,
    });
    return normalizeSearchResponse(json, query);
  } catch (err) {
    // Permitted carriers with no availability → Travelport errors; soft-empty.
    if (query.preferredCarriers?.length) {
      console.warn(
        "[travelport/search] preferred-carrier search failed:",
        err instanceof Error ? err.message : err,
      );
      return [];
    }
    throw err;
  }
}
