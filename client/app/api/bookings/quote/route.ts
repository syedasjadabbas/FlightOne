import { API_BASE_URL, type ApiEnvelope } from "@/lib/api/baseApi";
import { quotePayloadFromOffer, type QuoteableOffer } from "@/lib/bookings/quoteFromOffer";

/**
 * Authenticated quote create — forwards to filght-one-server with the user JWT.
 * Client amount/net fields are stripped; snapshot id is required.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
