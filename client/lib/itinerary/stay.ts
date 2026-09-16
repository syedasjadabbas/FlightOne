/**
 * Stay-duration convention (backend SSOT — never LLM arithmetic).
 *
 * nights = calendar-day difference between arrival local date and next
 * departure local date. Example: arrive 2026-06-04, leave 2026-06-06 → 2 nights.
 * days uses the same calendar delta (departure − arrival).
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcNoon(iso: string): number | null {
  if (!ISO.test(iso)) return null;
  const ms = Date.parse(`${iso}T12:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

/** Calendar nights between an arrival date and the next departure date. */
export function calendarNightsBetween(arriveIso: string, departIso: string): number | null {
  const a = parseUtcNoon(arriveIso);
  const d = parseUtcNoon(departIso);
  if (a == null || d == null) return null;
  const days = Math.round((d - a) / 86_400_000);
  return days >= 0 ? days : null;
}

/** Alias — same calendar delta as nights (departure − arrival). */
export function calendarDaysBetween(arriveIso: string, departIso: string): number | null {
  return calendarNightsBetween(arriveIso, departIso);
}
