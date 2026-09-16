/**
 * Hotel competitive intelligence — SerpAPI Google Hotels + GDS resolve.
 * Bookable cards = Travelport only. Google/OTA figures are indicative narrative.
 */

export type Gps = { lat: number; lng: number };

export type SerpHotelProperty = {
  name: string;
  stars: number;
  rating: number | null;
  reviews: number | null;
  /** Nightly major units in `currency` when Serp returned a rate. */
  priceMajor: number | null;
  currency: string;
  gps: Gps | null;
  brandHint: string | null;
  yearBuilt: number | null;
  propertyToken: string | null;
};

export type ScoredHotelComp = SerpHotelProperty & {
  score: number;
  reasons: string[];
};

export type IndicativeOtaComp = {
  name: string;
  stars: number;
  /** Formatted for prompt only — never show as FlightOne bookable price. */
  otaPriceLabel: string | null;
  rating: number | null;
  whyComparable: string;
};

export type HotelCompsBundle = {
  targetName: string;
  city: string;
  /** Whether the named property was found on Google Hotels. */
  targetFoundOnSerp: boolean;
  /** Indicative OTA nightly for the asked property (narrative only). */
  targetOtaPriceMajor: number | null;
  targetOtaCurrency: string | null;
  /** True when our GDS rate is meaningfully above Google/OTA for the same stay. */
  gdsUndercutByOta: boolean;
  /** Stronger comps for the LLM (may lack GDS — still indicate). */
  indicative: IndicativeOtaComp[];
  /** Bookable hotel names we successfully priced on GDS (subset). */
  gdsResolvedNames: string[];
};

export type HotelCompsQuery = {
  hotelName: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  adults?: number;
  /** Our GDS nightly major (same currency) when we already hold the named stay. */
  gdsNightlyMajor?: number | null;
};
