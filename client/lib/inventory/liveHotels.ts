/**
 * Live hotel search via filght-one-server → Travelport TripServices Stays.
 */
import type { HotelOffer } from "./types";
import { daysFromToday, placeToIata } from "./places";
import { searchSuppliers } from "./supplierSearch";

export interface LiveHotelQuery {
  city?: string;
  cityCode?: string;
  checkInDate?: string;
  checkOutDate?: string;
  rooms?: number;
  guests?: number;
  minStars?: number;
  /** Partial hotel name → Travelport hotelNameContains. */
  hotelName?: string;
  /** Preferred currency for Stays requestedCurrency (e.g. PKR, USD). */
  currency?: string;
}

/**
 * Returns live HotelOffers, or null if disabled / failed (caller uses seed).
 */
export async function searchLiveHotels(q: LiveHotelQuery): Promise<HotelOffer[] | null> {
  const cityCode = placeToIata(q.cityCode || q.city);
  if (!cityCode) return null;

  const offers = await searchSuppliers({
    product: "HOTEL",
    query: {
      cityCode,
      checkInDate: q.checkInDate || daysFromToday(21),
      checkOutDate: q.checkOutDate || daysFromToday(23),
      rooms: q.rooms ?? 1,
      guests: q.guests ?? 2,
      ...(q.hotelName ? { hotelName: q.hotelName } : {}),
      ...(q.currency ? { requestedCurrency: q.currency.toUpperCase().slice(0, 3) } : {}),
    },
  });

  if (!offers) return null;
  let hotels = offers.filter((o): o is HotelOffer => o.type === "hotel");
  if (q.minStars != null) {
    hotels = hotels.filter((o) => o.stars >= q.minStars!);
  }
  return hotels;
}
