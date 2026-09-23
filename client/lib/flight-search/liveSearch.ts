/**
 * Live GDS inventory is always attempted via Express `/api/v1/suppliers/search`.
 * Disable with TRAVELPORT_LIVE_SEARCH=false on the **server**, not Next.
 */
export function isLiveFlightSearchEnabled(): boolean {
  // Demo mode serves the Galileo corpus in place of Travelport. It counts as
  // "live" so seed JSON never substitutes for it and empty demo legs surface
  // honestly instead of being papered over with unrelated inventory.
  if (process.env.DEMO_FLIGHT_INVENTORY === "true") return true;
  return Boolean(process.env.INTERNAL_API_KEY?.trim());
}

/** Seed JSON inventory must never substitute for an empty live flight search. */
export function allowSeedFlightFallback(): boolean {
  return !isLiveFlightSearchEnabled();
}
