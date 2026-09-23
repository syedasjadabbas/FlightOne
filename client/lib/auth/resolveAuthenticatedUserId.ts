import { getApiBaseUrl, type ApiEnvelope } from "@/lib/api/baseApi";

/**
 * Resolve the authenticated user from the incoming Authorization header by
 * asking the API (`/auth/me`). Never trust a client-supplied userId field.
 */
export async function resolveAuthenticatedUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const envelope = (await res.json()) as ApiEnvelope<{ id?: string }>;
    const id = envelope?.data?.id;
    if (typeof id !== "string" || !id.trim() || id === "internal") return null;
    return id.trim();
  } catch {
    return null;
  }
}
