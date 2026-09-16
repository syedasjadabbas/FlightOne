/**
 * Server helpers to fetch geo from external providers.
 * Used by /api/geo and /api/geo/reverse — never call providers from the browser
 * directly (keeps keys/rate limits centralized).
 */

export type ReverseGeoResult = {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
};

export type IpGeoResult = ReverseGeoResult & {
  latitude: number | null;
  longitude: number | null;
};

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Reverse geocode via BigDataCloud client endpoint (no API key). */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeoResult> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("localityLanguage", "en");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`reverse geocode HTTP ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;

  return {
    city: firstString(j.city, j.locality, j.principalSubdivision),
    region: firstString(j.principalSubdivision, j.localityInfo),
    country: firstString(j.countryName),
    countryCode: firstString(j.countryCode)?.toUpperCase() ?? null,
  };
}

/** IP geolocation via ipapi.co (HTTPS, no key for modest volume). */
export async function geoFromIp(ip: string): Promise<IpGeoResult> {
  // Avoid looping on loopback / private ranges during local dev.
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    throw new Error("private_ip");
  }

  const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ip geo HTTP ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;
  if (j.error) throw new Error(String(j.reason || j.error));

  return {
    city: firstString(j.city),
    region: firstString(j.region, j.region_code),
    country: firstString(j.country_name),
    countryCode: firstString(j.country_code, j.country)?.toUpperCase() ?? null,
    latitude: typeof j.latitude === "number" ? j.latitude : Number(j.latitude) || null,
    longitude: typeof j.longitude === "number" ? j.longitude : Number(j.longitude) || null,
  };
}

/** Best-effort client IP from Next request headers. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/** Prefer edge-platform city headers when present (Vercel / Cloudflare). */
export function locationFromEdgeHeaders(headers: Headers): ReverseGeoResult | null {
  const city =
    headers.get("x-vercel-ip-city") ||
    headers.get("cf-ipcity") ||
    null;
  const countryCode =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    null;
  const region =
    headers.get("x-vercel-ip-country-region") ||
    headers.get("cf-region") ||
    null;

  if (!city && !countryCode) return null;
  return {
    city: city ? decodeURIComponent(city) : null,
    region: region ? decodeURIComponent(region) : null,
    country: null,
    countryCode: countryCode?.toUpperCase() ?? null,
  };
}
