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
