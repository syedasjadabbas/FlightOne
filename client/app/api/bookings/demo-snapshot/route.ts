import { API_BASE_URL } from "@/lib/api/baseApi";

/**
 * Mints a real supplier offer snapshot for a demo-corpus fare.
 *
 * Demo offers ship a `snap_demo_*` id that matches no DB row, so the booking
 * engine rejected them with 409 "Invalid supplier offer reference". This
 * forwards to Express, which creates a genuine row owned by the authenticated
 * user — the booking engine's contract is unchanged.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.DEMO_FLIGHT_INVENTORY !== "true") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

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

  const res = await fetch(`${API_BASE_URL}/suppliers/demo-snapshot`, {
    method: "POST",
    headers: {
      Authorization: auth,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return Response.json(
      { error: (json as { message?: string })?.message || "Could not prepare the demo fare" },
      { status: res.status },
    );
  }
  return Response.json(json, { status: res.status });
}
