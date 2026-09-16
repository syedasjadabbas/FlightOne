/**
 * Live flight search via filght-one-server → Travelport TripServices.
 * Falls back to null when the API is unreachable so the consultant can use seed inventory.
 */
import type { FlightOffer } from "./types";
import { DEFAULT_ORIGIN_IATA, daysFromToday, placeToIata } from "./places";
import { searchSuppliers } from "./supplierSearch";
import { searchFlightsPreferredThenOpen } from "./searchFlightsPreferred";

export interface LiveFlightQuery {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  cabin?: "economy" | "premium" | "business";
  passengers?: number;
  /** Preferred currency override for Travelport PricingModifiersAir. */
  currency?: string;
  /** Explicit airline codes from the guest ask. */
  preferredCarriers?: string[];
}

function cabinToSupplier(
  cabin?: LiveFlightQuery["cabin"],
): "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST" {
  if (cabin === "business") return "BUSINESS";
  if (cabin === "premium") return "PREMIUM_ECONOMY";
  return "ECONOMY";
}

/**
 * Returns live FlightOffers, or null if live search is disabled / failed
 * (caller should fall back to seed inventory).
 */
export async function searchLiveFlights(q: LiveFlightQuery): Promise<FlightOffer[] | null> {
  const origin = placeToIata(q.origin) || DEFAULT_ORIGIN_IATA;
  const destination = placeToIata(q.destination);
  if (!destination || origin === destination) return null;

  const query = {
    origin,
    destination,
    departureDate: q.departureDate || daysFromToday(21),
    returnDate: q.returnDate,
    passengers: q.passengers ?? 1,
    cabinClass: cabinToSupplier(q.cabin),
    ...(q.currency
      ? { requestedCurrency: q.currency.toUpperCase().slice(0, 3) }
      : {}),
  };

  const offers = q.preferredCarriers?.length
    ? await searchFlightsPreferredThenOpen(query, q.preferredCarriers)
    : await searchSuppliers({ product: "FLIGHT", query });

  if (!offers) return null;
  return offers.filter((o): o is FlightOffer => o.type === "flight");
}
