/**
 * Landmark hotels travellers name by brand. Maps aliases → city + search name
 * so "stay at Burj Al Arab" becomes a Dubai Stays search with hotelNameContains,
 * not a generic cheapest-in-city dump.
 */

export interface KnownHotel {
  /** Canonical display / SearchComplete hotelNameContains string. */
  name: string;
  city: string;
  cityCode: string;
  /** Prefer luxury tier when pivoting away from an exact miss. */
  minStars: number;
  /**
   * Fallback name filter when exact name 500s / isn't in GDS trial content
   * (e.g. Burj → Jumeirah beach luxury strip).
   */
  searchHint?: string;
}

/** Longer aliases first so "burj al arab" wins over a shorter substring. */
const KNOWN_HOTELS: { alias: string; hotel: KnownHotel }[] = [
  {
    alias: "burj al arab",
    hotel: {
      name: "Burj Al Arab",
      city: "Dubai",
      cityCode: "DXB",
      minStars: 5,
      searchHint: "Jumeirah",
    },
  },
  {
    alias: "atlantis the palm",
    hotel: {
      name: "Atlantis The Palm",
      city: "Dubai",
      cityCode: "DXB",
      minStars: 5,
      searchHint: "Palm Jumeirah",
    },
  },
  {
    alias: "atlantis",
    hotel: {
      name: "Atlantis",
      city: "Dubai",
      cityCode: "DXB",
      minStars: 5,
      searchHint: "Palm Jumeirah",
    },
  },
  {
    alias: "address downtown",
    hotel: {
      name: "Address Downtown",
      city: "Dubai",
      cityCode: "DXB",
      minStars: 5,
      searchHint: "Downtown",
    },
  },
  {
    alias: "armani hotel dubai",
    hotel: { name: "Armani Hotel", city: "Dubai", cityCode: "DXB", minStars: 5 },
  },
  {
    alias: "armani hotel",
    hotel: { name: "Armani Hotel", city: "Dubai", cityCode: "DXB", minStars: 5 },
  },
  {
    alias: "raffles singapore",
    hotel: { name: "Raffles", city: "Singapore", cityCode: "SIN", minStars: 5 },
  },
  {
    alias: "marina bay sands",
    hotel: { name: "Marina Bay Sands", city: "Singapore", cityCode: "SIN", minStars: 5 },
  },
];

export function matchKnownHotel(message: string): KnownHotel | undefined {
  const lower = message.toLowerCase();
  for (const { alias, hotel } of KNOWN_HOTELS) {
    if (lower.includes(alias)) return hotel;
  }
  return undefined;
}

/** Case-insensitive name match against live/seed hotel offers. */
export function hotelNameMatches(offerName: string, wanted: string): boolean {
  const a = offerName.toLowerCase();
  const b = wanted.toLowerCase();
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = b.split(/\s+/).filter((t) => t.length > 3);
  return tokens.length > 0 && tokens.every((t) => a.includes(t));
}
