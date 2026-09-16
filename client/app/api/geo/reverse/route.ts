import { NextResponse } from "next/server";
import { buildTravellerLocation, defaultTravellerLocation } from "@/lib/geo/buildLocation";
import { reverseGeocode } from "@/lib/geo/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Browser GPS reverse-geocode for Ava origin pitch.
 * GET /api/geo/reverse?lat=&lon= → TravellerLocation
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  try {
    const geo = await reverseGeocode(lat, lon);
    return NextResponse.json(
      buildTravellerLocation({
        city: geo.city,
        region: geo.region,
        country: geo.country,
        countryCode: geo.countryCode,
        latitude: lat,
        longitude: lon,
        source: "browser",
      }),
    );
  } catch (err) {
    console.warn("[/api/geo/reverse]", err instanceof Error ? err.message : err);
    return NextResponse.json(defaultTravellerLocation());
  }
}
