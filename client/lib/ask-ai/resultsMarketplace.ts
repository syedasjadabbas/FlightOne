import {
  driveCategoryImage,
  hotelOfferImage,
  marketplaceImageAlt,
  placeMarketplaceImage,
  stayDiscoveryImage,
} from "./marketplaceImages";

import { FLIGHTONE_DESTINATIONS, type FlightOneDestination } from "@/lib/content/flightone";
import { altAirports } from "@/lib/comps/altAirports";
import { iataToPlace, isKnownIata, placeToIata } from "@/lib/inventory/places";
import type { OfferCard } from "@/lib/consultant/types";
import type { SearchResultsPanel } from "@/lib/ask-ai/types";

export type RelatedSearchLink = {
  id: string;
  label: string;
  prompt: string;
};

export type ExploreTile = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  imageUrl: string;
  imageAlt: string;
};

export type DestinationContext = {
  city: string;
  iata: string | null;
  originCity: string;
  originIata: string | null;
  marketing: FlightOneDestination | null;
};

/** Prefer structured flight city, then route label, then panel query. */
export function deriveDestinationContext(
  panel: SearchResultsPanel | null,
  offers: OfferCard[],
): DestinationContext {
  const flight = offers.find((o) => o.flight)?.flight;
  const cityFromOffer = flight?.destinationCity?.trim() || "";
  const originFromOffer = flight?.originCity?.trim() || "";
  const destCode = flight?.destinationCode?.toUpperCase() || null;
  const originCode = flight?.originCode?.toUpperCase() || null;

  let city = cityFromOffer;
  let originCity = originFromOffer;

  if (!city && panel?.legRoute) {
    const parts = panel.legRoute.split(/\s*[→\-–]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      originCity = originCity || parts[0]!;
      city = parts[parts.length - 1]!;
    }
  }

  if (!city && panel?.queryLabel) {
    const m = panel.queryLabel.match(/\bto\s+([A-Za-z][A-Za-z\s]+)/i);
    if (m?.[1]) city = m[1].trim();
  }

  const iata =
    destCode && isKnownIata(destCode)
      ? destCode
      : city
        ? placeToIata(city)
        : null;
  const originIata =
    originCode && isKnownIata(originCode)
      ? originCode
      : originCity
        ? placeToIata(originCity)
        : null;

  const resolvedCity = city || (iata ? iataToPlace(iata) : "");
  const resolvedOrigin = originCity || (originIata ? iataToPlace(originIata) : "Lahore");

  return {
    city: resolvedCity,
    iata,
    originCity: resolvedOrigin,
    originIata,
    marketing: matchMarketingDestination(resolvedCity, iata),
  };
}

function matchMarketingDestination(
  city: string,
  iata: string | null,
): FlightOneDestination | null {
  const lower = city.toLowerCase();
  if (!lower && !iata) return null;

  const byName = FLIGHTONE_DESTINATIONS.find(
    (d) =>
      d.name.toLowerCase() === lower ||
      lower.includes(d.name.toLowerCase()) ||
      d.name.toLowerCase().includes(lower),
  );
  if (byName) return byName;

  // City → country marketing match (Istanbul → Turkey, etc.)
  const CITY_TO_DEST: Record<string, string> = {
    IST: "turkey",
    SAW: "turkey",
    DXB: "dubai",
    DWC: "dubai",
    SHJ: "dubai",
    AUH: "dubai",
    BKK: "thailand",
    DMK: "thailand",
    KUL: "malaysia",
    SIN: "singapore",
    MLE: "maldives",
    CMB: "sri-lanka",
    CMN: "morocco",
    CAI: "egypt",
  };
  const id = iata ? CITY_TO_DEST[iata] : undefined;
  return id ? FLIGHTONE_DESTINATIONS.find((d) => d.id === id) ?? null : null;
}

export type DriveDiscoveryCard = {
  id: string;
  category: string;
  subtitle: string;
  prompt: string;
  imageUrl: string;
  imageAlt: string;
};

export type StayDiscoveryCard = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  imageUrl: string;
  imageAlt: string;
};

/** Prompt tiles when no live stay inventory is in the result set. Not priced listings. */
export function buildStayDiscoveryCards(ctx: DestinationContext): StayDiscoveryCard[] {
  if (!ctx.city) return [];

  const cards: StayDiscoveryCard[] = [
    {
      id: "hotels",
      title: `Hotels in ${ctx.city}`,
      subtitle: "Search live stays with Ava",
      prompt: `Add a hotel stay in ${ctx.city}`,
      imageUrl: stayDiscoveryImage("hotels", ctx.city),
      imageAlt: marketplaceImageAlt(ctx.city, "stay"),
    },
    {
      id: "luxury",
      title: "Luxury & 5-star",
      subtitle: ctx.marketing?.bestFor || "Premium properties",
      prompt: `Find luxury hotels in ${ctx.city}`,
      imageUrl: stayDiscoveryImage("luxury", ctx.city),
      imageAlt: `Luxury stays in ${ctx.city}`,
    },
    {
      id: "central",
      title: "City centre",
      subtitle: "Walkable neighbourhoods",
      prompt: `Hotels in central ${ctx.city}`,
      imageUrl: stayDiscoveryImage("central", ctx.city),
      imageAlt: `City centre stays in ${ctx.city}`,
    },
  ];

  return cards;
}

/** Car-hire prompts — navigation only, no live car inventory. */
export function buildDriveDiscoveryCards(ctx: DestinationContext): DriveDiscoveryCard[] {
  if (!ctx.city) return [];

  return [
    {
      id: "compact",
      category: "Compact",
      subtitle: "Easy city driving",
      prompt: `Car rental in ${ctx.city} — compact car`,
      imageUrl: driveCategoryImage("compact"),
      imageAlt: marketplaceImageAlt("Compact", "car"),
    },
    {
      id: "suv",
      category: "SUV",
      subtitle: "Family & luggage",
      prompt: `Car rental in ${ctx.city} — SUV`,
      imageUrl: driveCategoryImage("suv"),
      imageAlt: marketplaceImageAlt("SUV", "car"),
    },
    {
      id: "premium",
      category: "Premium",
      subtitle: "Comfort & space",
      prompt: `Car rental in ${ctx.city} — premium car`,
      imageUrl: driveCategoryImage("premium"),
      imageAlt: marketplaceImageAlt("Premium", "car"),
    },
  ];
}

/** Hotel / package offers already present in the result set. */
export function realStayOffers(offers: OfferCard[]): OfferCard[] {
  return offers.filter((o) => o.type === "hotel" || o.type === "package");
}

/**
 * Discovery tiles from the current destination + known metro airports.
 * These are navigation prompts — not live inventory claims.
 * Kept destination-local so Dubai content never appears on an Istanbul search.
 */
export function buildExploreTiles(ctx: DestinationContext): ExploreTile[] {
  const tiles: ExploreTile[] = [];
  const seen = new Set<string>();

  const push = (title: string, subtitle: string, prompt: string, id: string) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tiles.push({
      id,
      title,
      subtitle,
      prompt,
      imageUrl: placeMarketplaceImage(title),
      imageAlt: marketplaceImageAlt(title, "place"),
    });
  };

  if (ctx.city) {
    push(
      ctx.city,
      ctx.marketing?.bestFor || "Flights & stays",
      `Flights to ${ctx.city} from ${ctx.originCity}`,
      `dest-${ctx.iata || ctx.city}`,
    );
  }

  if (ctx.iata) {
    for (const alt of altAirports(ctx.iata, 4)) {
      if (!isKnownIata(alt)) continue;
      const place = iataToPlace(alt);
      if (!place || place.toLowerCase() === ctx.city.toLowerCase()) continue;
      push(
        place,
        `Nearby airport · ${alt}`,
        `Flights from ${ctx.originCity} to ${place}`,
        `metro-${alt}`,
      );
    }
  }

  return tiles.slice(0, 5);
}

/** Related route searches the app can actually resolve. */
export function buildRelatedSearches(ctx: DestinationContext): RelatedSearchLink[] {
  const links: RelatedSearchLink[] = [];
  const seen = new Set<string>();

  const push = (label: string, prompt: string, id: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    links.push({ id, label, prompt });
  };

  if (ctx.originCity && ctx.iata) {
    for (const alt of altAirports(ctx.iata, 3)) {
      if (!isKnownIata(alt)) continue;
      const place = iataToPlace(alt);
      if (!place || place.toLowerCase() === ctx.city.toLowerCase()) continue;
      push(
        `${ctx.originCity} → ${place}`,
        `Flights from ${ctx.originCity} to ${place}`,
        `rel-${ctx.originIata || "o"}-${alt}`,
      );
    }
  }

  if (ctx.city && ctx.originCity && ctx.city.toLowerCase() !== ctx.originCity.toLowerCase()) {
    push(
      `${ctx.city} → ${ctx.originCity}`,
      `Flights from ${ctx.city} to ${ctx.originCity}`,
      `rel-reverse`,
    );
  }

  // Extra popular routes from same origin (known IATA only)
  const popular = ["Istanbul", "Dubai", "Bangkok", "Kuala Lumpur", "Jeddah"];
  for (const name of popular) {
    if (links.length >= 6) break;
    if (name.toLowerCase() === ctx.city.toLowerCase()) continue;
    const code = placeToIata(name);
    if (!code) continue;
    push(
      `${ctx.originCity} → ${name}`,
      `Flights from ${ctx.originCity} to ${name}`,
      `rel-pop-${code}`,
    );
  }

  return links.slice(0, 6);
}
