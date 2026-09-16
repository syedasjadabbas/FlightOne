import { searchLiveHotels } from "@/lib/inventory/liveHotels";
import type { HotelOffer } from "@/lib/inventory/types";
import { hotelNameMatches } from "@/lib/consultant/knownHotels";
import { namesLikelySame, scoreHotelComps } from "./scoreHotelComps";
import { isSerpConfigured, searchGoogleHotels } from "./serpHotels";
import type {
  HotelCompsBundle,
  HotelCompsQuery,
  IndicativeOtaComp,
  SerpHotelProperty,
} from "./types";

export type HotelCompsResolveResult = {
  bundle: HotelCompsBundle;
  /** GDS-priced comps (and optionally the named stay if resolved here). */
  bookable: HotelOffer[];
};

function formatOta(priceMajor: number | null, currency: string): string | null {
  if (priceMajor == null) return null;
  const amount =
    Number.isInteger(priceMajor)
      ? priceMajor.toLocaleString("en-US")
      : priceMajor.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
  return `${currency.toUpperCase()} ${amount}`;
}

function pickTarget(
  asked: string,
  properties: SerpHotelProperty[],
): SerpHotelProperty | null {
  if (properties.length === 0) return null;
  const hit = properties.find((p) => namesLikelySame(p.name, asked));
  return hit || properties[0];
}

async function gdsForName(
  name: string,
  q: HotelCompsQuery,
  minStars: number,
): Promise<HotelOffer[]> {
  const live = await searchLiveHotels({
    city: q.city,
    hotelName: name.split(/\s+/).slice(0, 5).join(" "),
    minStars,
    guests: Math.max(2, q.adults ?? 2),
    rooms: 1,
    currency: q.currency,
    checkInDate: q.checkInDate,
    checkOutDate: q.checkOutDate,
  });
  if (!live?.length) return [];
  const matched = live.filter((o) => hotelNameMatches(o.name, name));
  return (matched.length > 0 ? matched : live).slice(0, 2);
}

/**
 * Discover true comps on Google Hotels, score them, resolve what we can price on GDS.
 * Bookable offers only come from GDS. Serp prices stay indicative.
 */
export async function resolveHotelComps(
  q: HotelCompsQuery,
): Promise<HotelCompsResolveResult | null> {
  if (!isSerpConfigured()) return null;

  const currency = q.currency.toUpperCase().slice(0, 3);
  const targetQuery = `${q.hotelName} ${q.city}`;

  const [targetHits, areaHits] = await Promise.all([
    searchGoogleHotels({
      q: targetQuery,
      checkInDate: q.checkInDate,
      checkOutDate: q.checkOutDate,
      currency,
      adults: q.adults,
      hotelClass: 5,
    }),
    searchGoogleHotels({
      q: `luxury hotels near ${q.hotelName} ${q.city}`,
      checkInDate: q.checkInDate,
      checkOutDate: q.checkOutDate,
      currency,
      adults: q.adults,
      hotelClass: 5,
    }),
  ]);

  const target = pickTarget(q.hotelName, targetHits);
  const pool = [...areaHits, ...targetHits];
  if (!target && pool.length === 0) return null;

  const anchor: SerpHotelProperty =
    target ??
    ({
      name: q.hotelName,
      stars: 5,
      rating: null,
      reviews: null,
      priceMajor: null,
      currency,
      gps: pool.find((p) => p.gps)?.gps ?? null,
      brandHint: null,
      yearBuilt: null,
      propertyToken: null,
    } satisfies SerpHotelProperty);

  const scored = scoreHotelComps(anchor, pool, 8);

  const indicative: IndicativeOtaComp[] = scored.slice(0, 5).map((c) => ({
    name: c.name,
    stars: c.stars,
    otaPriceLabel: formatOta(c.priceMajor, c.currency || currency),
    rating: c.rating,
    whyComparable: c.reasons.join(" · ") || "similar luxury profile",
  }));

  const bookable: HotelOffer[] = [];
  const gdsResolvedNames: string[] = [];

  for (const c of scored.slice(0, 5)) {
    const offers = await gdsForName(c.name, q, Math.max(4, c.stars - 1));
    for (const o of offers) {
      if (gdsResolvedNames.some((n) => hotelNameMatches(n, o.name))) continue;
      bookable.push(o);
      gdsResolvedNames.push(o.name);
    }
    if (bookable.length >= 4) break;
  }

  // Prefer cheaper GDS comps when our GDS target is undercut by OTA.
  const gdsNightly = q.gdsNightlyMajor ?? null;
  const otaNightly = target?.priceMajor ?? null;
  const gdsUndercutByOta =
    gdsNightly != null &&
    otaNightly != null &&
    otaNightly > 0 &&
    gdsNightly > otaNightly * 1.05;

  if (gdsUndercutByOta && gdsNightly != null) {
    bookable.sort((a, b) => a.netFare.amount - b.netFare.amount);
  }

  return {
    bundle: {
      targetName: q.hotelName,
      city: q.city,
      targetFoundOnSerp: Boolean(target),
      targetOtaPriceMajor: otaNightly,
      targetOtaCurrency: target?.currency || currency,
      gdsUndercutByOta,
      indicative,
      gdsResolvedNames,
    },
    bookable,
  };
}
