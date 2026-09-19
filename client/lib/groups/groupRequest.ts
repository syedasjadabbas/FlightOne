export const MIN_GROUP_PASSENGERS = 10;

export function isValidGroupPassengerCount(value: unknown): boolean {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= MIN_GROUP_PASSENGERS && n <= 500;
}

const NETWORK_MESSAGE =
  "We couldn’t submit your request right now. Please try again in a moment.";
const SESSION_MESSAGE = "Your session has expired. Please sign in again.";
const DUPLICATE_MESSAGE = "This request has already been submitted.";
const MIN_TRAVELLERS_MESSAGE = "Group travel requests require at least 10 travellers.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractStatus(error: unknown): number | string | undefined {
  const rec = asRecord(error);
  if (!rec) return undefined;
  const status = rec.status ?? rec.originalStatus;
  if (typeof status === "number" || typeof status === "string") return status;
  return undefined;
}

function extractServerMessage(error: unknown): string {
  const rec = asRecord(error);
  if (!rec) return typeof error === "string" ? error : "";
  const data = rec.data;
  if (typeof data === "string") return data;
  const dataRec = asRecord(data);
  if (dataRec) {
    if (typeof dataRec.message === "string") return dataRec.message;
    if (typeof dataRec.error === "string") return dataRec.error;
  }
  if (typeof rec.error === "string") return rec.error;
  if (typeof rec.message === "string" && rec.message !== "Rejected") return rec.message;
  return "";
}

function looksTechnical(text: string): boolean {
  return /prisma|p2002|p2025|stack trace|at\s+\S+\s+\(|sqlstate|econnrefused|enotfound|internal server|node_modules/i.test(
    text,
  );
}

function mapKnownFragment(fragment: string): string | null {
  const text = fragment.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (
    /at least 10 passenger/.test(lower) ||
    /between 10 and 500 passenger/.test(lower) ||
    /greater than or equal to 10/.test(lower)
  ) {
    return MIN_TRAVELLERS_MESSAGE;
  }
  if (/cannot exceed 500|less than or equal to 500/.test(lower)) {
    return "Group travel requests cannot exceed 500 travellers.";
  }
  if (/2–10 letters|2-10 letters|iata or city code/.test(lower)) {
    return "Please enter a valid origin and destination (2–10 letters, such as LHE or DXB).";
  }
  if (/origin and destination must be different/.test(lower)) {
    return "Origin and destination must be different.";
  }
  if (/invalid date|invalid time|expected date/.test(lower)) {
    return "Please select a valid travel date.";
  }
  if (/departuredate is required when returndate/.test(lower)) {
    return "Please select a valid travel date.";
  }
  if (/returndate cannot be before/.test(lower)) {
    return "Please select a valid travel date.";
  }
  if (/idempotency key already used|already submitted|already used/.test(lower)) {
    return DUPLICATE_MESSAGE;
  }
  if (/authentication required|unauthorized|jwt expired|invalid or expired/.test(lower)) {
    return SESSION_MESSAGE;
  }
  if (/invalid email|email/.test(lower) && /invalid|required/.test(lower)) {
    return "Please enter your contact email.";
  }
  if (/contactemail|contact email/.test(lower)) {
    return "Please enter your contact email.";
  }
  if (/contactname|contact name/.test(lower) && /required|at least 1/.test(lower)) {
    return "Please enter your contact name.";
  }
  if (/\bname\b/.test(lower) && /required|at least 1 character/.test(lower)) {
    return "Please enter your group name.";
  }
  if (/\borigin\b/.test(lower) && /required|at least 1/.test(lower)) {
    return "Please enter your origin.";
  }
  if (/\bdestination\b/.test(lower) && /required|at least 1/.test(lower)) {
    return "Please enter your destination.";
  }
  if (/string must contain at least 1 character|required/.test(lower)) {
    return "Please complete the required fields.";
  }
  if (/invalid enum value/.test(lower)) {
    if (/type/.test(lower)) return "Please choose a group type.";
    if (/flexib/.test(lower)) return "Please choose how flexible your travel dates are.";
    if (/cabin/.test(lower)) return "Please choose a cabin preference.";
    return "Please check the highlighted fields and try again.";
  }
  if (/idempotencykey|idempotency key/.test(lower) && /at least 8/.test(lower)) {
    return NETWORK_MESSAGE;
  }
  return null;
}

/**
 * Maps RTK Query / API submit failures to traveller-facing copy.
 * Never returns Prisma, stack traces, or other internals.
 */
export function formatGroupRequestSubmitError(error: unknown): string {
  const status = extractStatus(error);
  if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR" || status === "PARSING_ERROR") {
    return NETWORK_MESSAGE;
  }
  if (status === 401 || status === 403) {
    return SESSION_MESSAGE;
  }
  if (typeof status === "number" && status >= 500) {
    return NETWORK_MESSAGE;
  }

  const raw = extractServerMessage(error);
  if (looksTechnical(raw)) {
    return NETWORK_MESSAGE;
  }

  const fragments = raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const mapped = fragments
    .map(mapKnownFragment)
    .filter((msg): msg is string => Boolean(msg));
  if (mapped.length) {
    return [...new Set(mapped)].join(" ");
  }

  if (status === 409) {
    return DUPLICATE_MESSAGE;
  }

  return NETWORK_MESSAGE;
}
