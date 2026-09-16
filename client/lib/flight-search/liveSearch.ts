/** True when the app should call Travelport for live inventory (default: on). */
export function isLiveFlightSearchEnabled(): boolean {
  return process.env.TRAVELPORT_LIVE_SEARCH !== "false";
}

/** Seed JSON inventory must never substitute for an empty live flight search. */
export function allowSeedFlightFallback(): boolean {
  return !isLiveFlightSearchEnabled();
}
