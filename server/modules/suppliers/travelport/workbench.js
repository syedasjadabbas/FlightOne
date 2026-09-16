/**
 * Shared Travelport workbench id extraction (book + ticket paths).
 */

/**
 * @param {any} json
 * @returns {string | null}
 */
export function extractWorkbenchId(json) {
  const raw =
    json?.ReservationWorkbench?.Identifier?.value ||
    json?.ReservationWorkbench?.id ||
    json?.Identifier?.value ||
    json?.ReservationWorkbenchID ||
    json?.id ||
    null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}
