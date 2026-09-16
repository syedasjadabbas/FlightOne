/**
 * TripServices Stays SearchComplete (v12) — hotel search with rates in one call.
 */
import { randomUUID } from "node:crypto";
import { travelportFetch } from "./http.js";
import { travelportConfig } from "./config.js";
import { buildStaysSearchCompleteBody } from "./staysRequest.js";
import { normalizeStaysResponse } from "./stays.js";

/**
 * @param {import("../adapter.js").HotelSearchQuery} query
 * @returns {Promise<import("../adapter.js").SupplierOffer[]>}
 */
export async function searchHotels(query) {
  const cfg = travelportConfig();
  const wantedName = typeof query.hotelName === "string" ? query.hotelName.trim() : "";
  const currencyOverride =
    typeof query.requestedCurrency === "string"
      ? query.requestedCurrency.toUpperCase().slice(0, 3)
      : cfg.requestedCurrency;

  let json;
  try {
    ({ json } = await runSearchComplete(query, cfg, currencyOverride));
  } catch (err) {
    // Some name filters 500 on GDS trial content — fall back to city search.
    if (wantedName) {
      console.warn(
        `[stays] hotelNameContains "${wantedName}" failed (${err?.message || err}); retrying city-wide`,
      );
      ({ json } = await runSearchComplete({ ...query, hotelName: undefined }, cfg, currencyOverride));
    } else {
      throw err;
    }
  }

  let offers = normalizeStaysResponse(json, query, {
    requestedCurrency: currencyOverride,
  });

  if (wantedName) {
    const matched = offers.filter((o) => nameMatches(o.details?.hotelName, wantedName));
    if (matched.length > 0) return matched;
    // Keep luxury-first city results so the salesbot can pivot honestly.
    offers = [...offers].sort((a, b) => {
      const sa = Number(a.details?.starRating) || 0;
      const sb = Number(b.details?.starRating) || 0;
      if (sb !== sa) return sb - sa;
      return a.amountMinor - b.amountMinor;
    });
  }

  return offers;
}

/**
 * @param {import("../adapter.js").HotelSearchQuery} query
 * @param {ReturnType<typeof travelportConfig>} cfg
 * @param {string} requestedCurrency
 */
async function runSearchComplete(query, cfg, requestedCurrency) {
  const body = buildStaysSearchCompleteBody(query, {
    requestedCurrency,
    radiusKm: Number(process.env.TRAVELPORT_STAYS_RADIUS_KM) || 40,
    maxWaitMs: Number(process.env.TRAVELPORT_STAYS_MAX_WAIT_MS) || 10000,
  });

  return travelportFetch("/search/searchcomplete", {
    method: "POST",
    body,
    traceId: `fo-htl-${randomUUID()}`,
    baseUrl: cfg.hotelBaseUrlV12,
    acceptVersion: cfg.staysAcceptVersion,
    contentVersion: cfg.staysContentVersion,
  });
}

/**
 * @param {unknown} offerName
 * @param {string} wanted
 */
function nameMatches(offerName, wanted) {
  if (typeof offerName !== "string") return false;
  const a = offerName.toLowerCase();
  const b = wanted.toLowerCase();
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = b.split(/\s+/).filter((t) => t.length > 3);
  return tokens.length > 0 && tokens.every((t) => a.includes(t));
}
