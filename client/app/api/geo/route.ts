import { NextResponse } from "next/server";
import { buildTravellerLocation, defaultTravellerLocation } from "@/lib/geo/buildLocation";
import {
  clientIpFromHeaders,
  geoFromIp,
  locationFromEdgeHeaders,
} from "@/lib/geo/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IP / edge-header geolocation for Ava origin pitch.
 * GET /api/geo → TravellerLocation
 */
export async function GET(request: Request) {
  try {
    const edge = locationFromEdgeHeaders(request.headers);
    if (edge?.city || edge?.countryCode) {
      return NextResponse.json(
        buildTravellerLocation({
          city: edge.city,
          region: edge.region,
          countryCode: edge.countryCode,
          source: "ip",
        }),
      );
    }

    const ip = clientIpFromHeaders(request.headers);
    if (ip) {
      try {
        const geo = await geoFromIp(ip);
        return NextResponse.json(
          buildTravellerLocation({
            city: geo.city,
            region: geo.region,
            country: geo.country,
            countryCode: geo.countryCode,
            latitude: geo.latitude ?? undefined,
            longitude: geo.longitude ?? undefined,
            source: "ip",
          }),
        );
      } catch (e) {
        // Localhost / private IP / provider blip → default below.
        console.warn("[/api/geo] ip lookup failed:", e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json(defaultTravellerLocation());
  } catch (err) {
    console.error("[/api/geo]", err);
    return NextResponse.json(defaultTravellerLocation());
  }
}
