/**
 * Live GDS inventory is always attempted via Express `/api/v1/suppliers/search`.
 * Disable with TRAVELPORT_LIVE_SEARCH=false on the **server**, not Next.
 */
export function isLiveFlightSearchEnabled(): boolean {
  return Boolean(process.env.INTERNAL_API_KEY?.trim());
}

/** Seed JSON inventory must never substitute for an empty live flight search. */
export function allowSeedFlightFallback(): boolean {
  return !isLiveFlightSearchEnabled();
}
