/**
 * External calendar adapter for predictive recs.
 * Never fabricates events. Default: unconfigured.
 */
export function getCalendarProviderName(env = process.env) {
  return (env.CALENDAR_PROVIDER || "unconfigured").trim().toLowerCase();
}

export function getCalendarCapability(env = process.env) {
  const provider = getCalendarProviderName(env);
  if (provider === "unconfigured" || provider === "none") {
    return {
      provider: "unconfigured",
      configured: false,
      available: false,
      reason:
        "Calendar integration is not configured. Predictive suggestions use your FlightOne bookings, searches, and preferences only.",
      events: [],
    };
  }
  if (provider === "http") {
    const url = (env.CALENDAR_HTTP_URL || "").trim();
    const key = (env.CALENDAR_HTTP_API_KEY || "").trim();
    if (!url || !key) {
      return {
        provider: "http",
        configured: false,
        available: false,
        reason: "Calendar provider is incomplete — events are not available.",
        events: [],
      };
    }
    return {
      provider: "http",
      configured: true,
      available: false,
      reason:
        "Calendar provider is configured but event sync is not enabled. Suggestions use your FlightOne bookings and searches only.",
      events: [],
    };
  }
  return {
    provider: "unconfigured",
    configured: false,
    available: false,
    reason: "Calendar integration is not configured.",
    events: [],
  };
}

/**
 * Live calendar fetch is not implemented without a configured provider.
 * Always fail closed — never invent events.
 */
export async function listCalendarEventsForUser(_userId, env = process.env) {
  const cap = getCalendarCapability(env);
  return {
    ...cap,
    events: [],
  };
}
