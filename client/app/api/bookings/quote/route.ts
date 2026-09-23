import { API_BASE_URL, type ApiEnvelope } from "@/lib/api/baseApi";
import { quotePayloadFromOffer, type QuoteableOffer } from "@/lib/bookings/quoteFromOffer";

/**
 * Authenticated quote create — forwards to filght-one-server with the user JWT.
 * Client amount/net fields are stripped; snapshot id is required.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exchange an offline demo fare for a real SupplierOfferSnapshot row.
 *
 * Returns null when minting fails, so the caller falls through to the normal
 * "no snapshot" 409 rather than surfacing a confusing demo-specific error.
 */
function padHhmm(timeStr: unknown): string | undefined {
  if (typeof timeStr !== "string" || !timeStr.trim()) return undefined;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = match[1].padStart(2, "0");
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

function cleanIsoDate(dateStr: unknown): string {
  if (typeof dateStr === "string" && dateStr.trim()) {
    const match = dateStr.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return new Date().toISOString().slice(0, 10);
}

function cleanSegment(seg: any, defaultDate: string) {
  if (!seg || typeof seg !== "object") return null;
  const rawCarrier = String(seg.carrier ?? seg.airlineCode ?? seg.airline ?? "FL1").trim();
  const carrier = (
    rawCarrier.length > 3
      ? (rawCarrier.match(/\b[A-Z0-9]{2,3}\b/i)?.[0] ?? rawCarrier.slice(0, 3))
      : rawCarrier
  ).toUpperCase();
  const originCode = String(seg.originCode ?? "").trim().slice(0, 3).toUpperCase();
  const destinationCode = String(seg.destinationCode ?? "").trim().slice(0, 3).toUpperCase();
  if (originCode.length !== 3 || destinationCode.length !== 3) return null;

  const departureDate = cleanIsoDate(seg.departureDate || defaultDate);
  const arrivalDate = cleanIsoDate(seg.arrivalDate || departureDate);
  const departTimeLocal = padHhmm(seg.departTimeLocal) || "08:00";
  const arriveTimeLocal = padHhmm(seg.arriveTimeLocal) || "12:00";

  return {
    carrier,
    flightNumber: String(seg.flightNumber ?? "FL100").slice(0, 10),
    originCode,
    destinationCode,
    departureDate,
    departTimeLocal,
    arrivalDate,
    arriveTimeLocal,
    ...(typeof seg.durationMinutes === "number" && seg.durationMinutes >= 0
      ? { durationMinutes: Math.round(seg.durationMinutes) }
      : {}),
    ...(typeof seg.layoverMinutesAfter === "number" && seg.layoverMinutesAfter >= 0
      ? { layoverMinutesAfter: Math.round(seg.layoverMinutesAfter) }
      : {}),
    ...(seg.aircraft ? { aircraft: String(seg.aircraft).slice(0, 10) } : {}),
    ...(seg.bookingClass ? { bookingClass: String(seg.bookingClass).slice(0, 3) } : {}),
  };
}

/**
 * Exchange an offline demo fare for a real SupplierOfferSnapshot row.
 *
 * Returns null when minting fails, so the caller falls through to the normal
 * "no snapshot" 409 rather than surfacing a confusing demo-specific error.
 */
async function mintDemoSnapshot(
  input: Record<string, unknown>,
  auth: string,
): Promise<string | null> {
  const flight = (input.flight as Record<string, unknown> | undefined) ?? {};
  const netMinor = Number(input.priceMinor);
  if (!Number.isInteger(netMinor) || netMinor <= 0) return null;

  const origin = String(flight.originCode ?? input.originCode ?? "").toUpperCase().slice(0, 3);
  const destination = String(flight.destinationCode ?? input.destinationCode ?? "").toUpperCase().slice(0, 3);
  if (origin.length !== 3 || destination.length !== 3) return null;

  const departureDate = cleanIsoDate(flight.departureDate);
  const rawCarrier = String(flight.airlineCode ?? flight.airline ?? "FL1").trim();
  const carrier = (
    rawCarrier.length > 3
      ? (rawCarrier.match(/\b[A-Z0-9]{2,3}\b/i)?.[0] ?? rawCarrier.slice(0, 3))
      : rawCarrier
  ).toUpperCase();

  const departTimeLocal = padHhmm(flight.departTimeLocal);
  const arriveTimeLocal = padHhmm(flight.arriveTimeLocal);

  const rawSegments = Array.isArray(flight.segments) ? flight.segments : [];
  const segments = rawSegments.map((s) => cleanSegment(s, departureDate)).filter(Boolean);

  const rawReturnSegments = Array.isArray(flight.returnSegments) ? flight.returnSegments : [];
  const returnSegments = rawReturnSegments.map((s) => cleanSegment(s, departureDate)).filter(Boolean);

  const res = await fetch(`${API_BASE_URL}/suppliers/demo-snapshot`, {
    method: "POST",
    headers: {
      Authorization: auth,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      offerId: String(input.id ?? `demo_${Date.now()}`),
      currency: String(input.currency ?? "PKR").toUpperCase().slice(0, 3),
      netMinor,
      product: input.type === "hotel" ? "HOTEL" : "FLIGHT",
      itinerary: {
        origin,
        destination,
        departureDate,
        ...(input.returnDate ? { returnDate: cleanIsoDate(input.returnDate) } : {}),
        ...(flight.cabin ? { cabin: String(flight.cabin).slice(0, 20) } : {}),
        ...(carrier ? { carrier } : {}),
        ...(typeof flight.stops === "number" ? { stops: Math.min(Math.max(0, flight.stops), 5) } : {}),
        ...(typeof flight.durationMinutes === "number" && flight.durationMinutes > 0
          ? { durationMinutes: Math.round(flight.durationMinutes) }
          : {}),
        ...(flight.flightNumber ? { flightNumber: String(flight.flightNumber).slice(0, 10) } : {}),
        ...(departTimeLocal ? { departTimeLocal } : {}),
        ...(arriveTimeLocal ? { arriveTimeLocal } : {}),
        ...(segments.length > 0 ? { segments } : {}),
        ...(returnSegments.length > 0 ? { returnSegments } : {}),
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error("[mintDemoSnapshot] Failed to mint demo snapshot:", res.status, errorText);
    return null;
  }
  const json = (await res.json().catch(() => null)) as
    | { data?: { supplierOfferSnapshotId?: string } }
    | null;
  return json?.data?.supplierOfferSnapshotId ?? null;
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  try {
    let snapshotId =
      typeof input.supplierOfferSnapshotId === "string" && input.supplierOfferSnapshotId.trim()
        ? input.supplierOfferSnapshotId.trim()
        : null;

    // A `snap_demo_*` id comes from the offline corpus and matches no DB row,
    // so the booking engine would reject it as an invalid reference. Exchange
    // it for a genuine snapshot before quoting.
    if (snapshotId?.startsWith("snap_demo_")) {
      snapshotId = await mintDemoSnapshot(input, auth);
    }

    if (!snapshotId) {
      // Resolve snapshot dynamically for the authenticated user
      const flight = (input.flight as Record<string, any>) || {};
      const origin = (flight.originCode || input.originCode || "").toString().toUpperCase();
      const destination = (flight.destinationCode || input.destinationCode || "").toString().toUpperCase();
      const departureDate = flight.departureDate || new Date().toISOString().slice(0, 10);
      const returnDate = flight.returnDate || undefined;
      const cabinClass = (flight.cabin || input.cabin || "ECONOMY").toString().toUpperCase();

      if (origin && destination) {
        const searchRes = await fetch(`${API_BASE_URL}/suppliers/search`, {
          method: "POST",
          headers: {
            Authorization: auth,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product: input.type === "hotel" ? "HOTEL" : "FLIGHT",
            query: {
              origin,
              destination,
              departureDate,
              ...(returnDate ? { returnDate } : {}),
              cabinClass,
              passengers: 1,
            },
          }),
          cache: "no-store",
        });

        if (searchRes.ok) {
          const searchJson = (await searchRes.json().catch(() => null)) as any;
          const offers: any[] = searchJson?.data?.offers ?? searchJson?.offers ?? [];
          const inputId = input.id;
          const inputFlightNo = flight.flightNumber;
          const inputCarrier = flight.airlineCode || flight.airline;

          const matched =
            offers.find((o) => o.offerId === inputId || o.id === inputId) ||
            offers.find(
              (o) =>
                inputFlightNo &&
                (o.details?.flightNumber === inputFlightNo ||
                  o.details?.segments?.[0]?.flightNumber === inputFlightNo),
            ) ||
            offers.find(
              (o) =>
                inputCarrier &&
                (o.details?.carrier === inputCarrier ||
                  o.supplierCode === inputCarrier),
            ) ||
            offers[0];

          if (matched) {
            snapshotId =
              matched.supplierOfferSnapshotId ||
              matched.snapshotId ||
              null;
          }
        }
      }
    }

    if (snapshotId) {
      input.supplierOfferSnapshotId = snapshotId;
    } else {
      // Without a snapshot Express can only reject this, and its rejection was
      // surfacing as an empty `{}` to the client. Fail here with a reason the
      // UI can actually show — 409 so it reads as "re-price", not "broken".
      return Response.json(
        {
          error:
            "This fare's supplier quote is no longer available. Run the search again to re-price it.",
          code: "SNAPSHOT_UNAVAILABLE",
        },
        { status: 409 },
      );
    }

    const meta =
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};
    const payload = quotePayloadFromOffer(input as QuoteableOffer, {
      companyId:
        typeof meta.companyId === "string"
          ? meta.companyId
          : typeof input.companyId === "string"
            ? input.companyId
            : undefined,
      projectCodeId:
        typeof meta.projectCodeId === "string"
          ? meta.projectCodeId
          : typeof input.projectCodeId === "string"
            ? input.projectCodeId
            : undefined,
    });

    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    if (!res.ok) {
      return Response.json(
        { error: json?.message || "Quote failed", details: json },
        { status: res.status },
      );
    }
    return Response.json(json, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote failed";
    const missing = /snapshot/i.test(message);
    return Response.json({ error: message }, { status: missing ? 409 : 400 });
  }
}
