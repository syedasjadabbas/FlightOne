import type { Gps, SerpHotelProperty } from "./types";

type SerpRawProperty = {
  name?: string;
  type?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  overall_rating?: number;
  reviews?: number;
  hotel_class?: number | string;
  extracted_hotel_class?: number;
  extracted_price?: number;
  rate_per_night?: { extracted_lowest?: number; lowest?: string };
  property_token?: string;
  description?: string;
  amenities?: string[];
};

type SerpHotelsResponse = {
  error?: string;
  properties?: SerpRawProperty[];
  search_parameters?: { currency?: string };
};

function apiKey(): string | undefined {
  return process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY || undefined;
}

export function isSerpConfigured(): boolean {
  return Boolean(apiKey());
}

function parseStars(p: SerpRawProperty): number {
  if (typeof p.extracted_hotel_class === "number" && p.extracted_hotel_class > 0) {
    return Math.min(5, Math.round(p.extracted_hotel_class));
  }
  if (typeof p.hotel_class === "number") return Math.min(5, Math.round(p.hotel_class));
  if (typeof p.hotel_class === "string") {
    const m = p.hotel_class.match(/(\d)/);
    if (m) return Math.min(5, Number(m[1]));
  }
  return 4;
}

function parsePrice(p: SerpRawProperty): number | null {
  if (typeof p.extracted_price === "number" && p.extracted_price > 0) return p.extracted_price;
  const lowest = p.rate_per_night?.extracted_lowest;
  if (typeof lowest === "number" && lowest > 0) return lowest;
  return null;
}

function parseGps(p: SerpRawProperty): Gps | null {
  const lat = p.gps_coordinates?.latitude;
  const lng = p.gps_coordinates?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function parseYearBuilt(p: SerpRawProperty): number | null {
  const blob = [p.description, ...(p.amenities || [])].filter(Boolean).join(" ");
  const m = blob.match(
    /(?:built|opened|established|construction)\s*(?:in\s*)?(19\d{2}|20[0-2]\d)/i,
  );
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= new Date().getUTCFullYear() + 1 ? y : null;
}

function brandHint(name: string): string | null {
  const n = name.toLowerCase();
  const brands = [
    "jumeirah",
    "four seasons",
    "ritz-carlton",
    "ritz carlton",
    "st. regis",
    "st regis",
    "mandarin oriental",
    "rosewood",
    "waldorf",
    "hilton",
    "marriott",
    "sheraton",
    "westin",
    "hyatt",
    "fairmont",
    "intercontinental",
    "sofitel",
    "raffles",
    "park hyatt",
    "autograph",
    "luxury collection",
    "edition",
    "w hotel",
    "address",
    "palace",
    "bulgari",
    "arman",
  ];
  return brands.find((b) => n.includes(b)) ?? null;
}

function toProperty(p: SerpRawProperty, currency: string): SerpHotelProperty | null {
  const name = (p.name || "").trim();
  if (!name) return null;
  // Prefer hotels over vacation rentals when type is set.
  if (p.type && /vacation|apartment|home/i.test(p.type) && !/hotel/i.test(p.type)) {
    return null;
  }
  return {
    name,
    stars: parseStars(p),
    rating: typeof p.overall_rating === "number" ? p.overall_rating : null,
    reviews: typeof p.reviews === "number" ? p.reviews : null,
    priceMajor: parsePrice(p),
    currency,
    gps: parseGps(p),
    brandHint: brandHint(name),
    yearBuilt: parseYearBuilt(p),
    propertyToken: p.property_token || null,
  };
}

/**
 * Google Hotels via SerpAPI. Returns [] when key missing or call fails —
 * never throws into the chat path.
 */
export async function searchGoogleHotels(opts: {
  q: string;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  adults?: number;
  hotelClass?: number;
  timeoutMs?: number;
}): Promise<SerpHotelProperty[]> {
  const key = apiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    engine: "google_hotels",
    q: opts.q,
    check_in_date: opts.checkInDate,
    check_out_date: opts.checkOutDate,
    currency: opts.currency.toUpperCase().slice(0, 3),
    adults: String(opts.adults ?? 2),
    gl: "us",
    hl: "en",
    api_key: key,
  });
  if (opts.hotelClass != null) {
    params.set("hotel_class", String(opts.hotelClass));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 18000);

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[serp/hotels] HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as SerpHotelsResponse;
    if (json.error) {
      console.warn("[serp/hotels]", json.error);
      return [];
    }
    const currency = json.search_parameters?.currency || opts.currency;
    return (json.properties || [])
      .map((p) => toProperty(p, currency))
      .filter((p): p is SerpHotelProperty => p != null)
      .slice(0, 24);
  } catch (e) {
    console.warn("[serp/hotels] failed:", e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
