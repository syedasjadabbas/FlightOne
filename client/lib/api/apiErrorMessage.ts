/**
 * Extract a human-readable message from an RTK Query error.
 *
 * The API returns `{ success: false, message: "..." }` on failure, and that
 * message is written for the end user ("Cannot refer yourself"). Prefer it over
 * a locally invented guess — a generic "something may be invalid" string throws
 * away the one piece of information that tells the user what to do next.
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err || typeof err !== "object") return fallback;
  const e = err as {
    data?: { message?: string; code?: string };
    error?: string;
    status?: number;
  };
  return e.data?.message || e.error || (e.status ? `Request failed (${e.status})` : fallback);
}
