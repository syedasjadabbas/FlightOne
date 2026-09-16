/**
 * Travelport TripServices config from env.
 * Docs: docs/integrations/travelport-tripservices.md (frontend repo).
 */
export function isTravelportConfigured() {
  return Boolean(
    process.env.TRAVELPORT_USERNAME &&
      process.env.TRAVELPORT_PASSWORD &&
      process.env.TRAVELPORT_CLIENT_ID &&
      process.env.TRAVELPORT_CLIENT_SECRET &&
      (process.env.TRAVELPORT_ACCESS_GROUP || process.env.TRAVELPORT_PCC),
  );
}

export function travelportConfig() {
  if (!isTravelportConfigured()) {
    throw new Error("Travelport credentials are not configured");
  }

  const env = (process.env.TRAVELPORT_ENV || "pp").toLowerCase();
  const isProd = env === "prod" || env === "production";

  return {
    username: process.env.TRAVELPORT_USERNAME,
    password: process.env.TRAVELPORT_PASSWORD,
    clientId: process.env.TRAVELPORT_CLIENT_ID,
    clientSecret: process.env.TRAVELPORT_CLIENT_SECRET,
    accessGroup: process.env.TRAVELPORT_ACCESS_GROUP || "",
    /** TVP-PCC-CORE style, e.g. UM2_1G */
    pccCore: process.env.TRAVELPORT_PCC || "",
    authUrl: isProd
      ? "https://auth.travelport.net/oauth/token"
      : "https://auth.pp.travelport.net/oauth/token",
    airBaseUrl: isProd
      ? "https://api.travelport.net/11/air"
      : "https://api.pp.travelport.net/11/air",
    hotelBaseUrlV11: isProd
      ? "https://api.travelport.net/11/hotel"
      : "https://api.pp.travelport.net/11/hotel",
    hotelBaseUrlV12: isProd
      ? "https://api.travelport.net/12/hotel"
      : "https://api.pp.travelport.net/12/hotel",
    acceptVersion: process.env.TRAVELPORT_ACCEPT_VERSION || "11",
    contentVersion: process.env.TRAVELPORT_CONTENT_VERSION || "11",
    staysAcceptVersion: process.env.TRAVELPORT_STAYS_ACCEPT_VERSION || "12",
    staysContentVersion: process.env.TRAVELPORT_STAYS_CONTENT_VERSION || "12",
    timeoutMs: Number(process.env.TRAVELPORT_TIMEOUT_MS) || 45000,
    contentSource: process.env.TRAVELPORT_CONTENT_SOURCE || "GDS",
    maxOffers: Number(process.env.TRAVELPORT_MAX_OFFERS) || 24,
    requestedCurrency: process.env.TRAVELPORT_CURRENCY || "PKR",
  };
}
