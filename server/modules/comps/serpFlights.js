import appLogger from "../../lib/logger.js";
import { isSerpConfigured } from "./serpHotels.js";

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AIRLINE_CODE_RE = /^[A-Z0-9]{2}$/;

const EMPTY = {
  options: [],
  lowestPriceMajor: null,
};

/** Align Google locale with quote currency — mismatched gl often empties results. */
function glForCurrency(currency) {
  switch (currency) {
    case "PKR":
      return "pk";
    case "INR":
      return "in";
    case "AED":
      return "ae";
    case "SAR":
      return "sa";
    case "GBP":
      return "uk";
    case "EUR":
      return "de";
    default:
      return "us";
  }
}

function carrierFromLeg(leg) {
  const num = leg.flight_number?.trim().toUpperCase() || "";
  const m = num.match(/^([A-Z0-9]{2})\d/);
  if (m) return m[1];
  const name = (leg.airline || "").toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(name)) return name;
  return null;
}

const TIME_LOCAL_RE = /(\d{1,2}:\d{2})/;

function timeLocalFromSerp(time) {
  if (!time) return undefined;
  const m = time.match(TIME_LOCAL_RE);
  if (!m) return undefined;
  const [h, min] = m[1].split(":");
  return `${h.padStart(2, "0")}:${min}`;
}

function parseSegments(legs) {
  if (!legs.length) return undefined;
  const out = [];
  for (const leg of legs) {
    const originCode = leg.departure_airport?.id?.trim().toUpperCase();
    const destinationCode = leg.arrival_airport?.id?.trim().toUpperCase();
    if (!originCode || !destinationCode) continue;
    const carrier =
      carrierFromLeg(leg) ||
      (leg.airline || "XX").trim().toUpperCase().slice(0, 2) ||
      "XX";
    const flightNumber = leg.flight_number?.trim().toUpperCase() || carrier;
    const departTimeLocal = timeLocalFromSerp(leg.departure_airport?.time);
    const arriveTimeLocal = timeLocalFromSerp(leg.arrival_airport?.time);
    const durationMinutes =
      typeof leg.duration === "number" && leg.duration > 0 ? leg.duration : undefined;
    out.push({
      carrier,
      flightNumber,
      originCode,
      destinationCode,
      ...(departTimeLocal ? { departTimeLocal } : {}),
      ...(arriveTimeLocal ? { arriveTimeLocal } : {}),
      ...(durationMinutes != null ? { durationMinutes } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

function toOption(row, currency) {
  const legs = row.flights || [];
  if (legs.length === 0 && row.price == null) return null;
  const airlines = [
    ...new Set(legs.map((l) => l.airline).filter((a) => Boolean(a))),
  ];
  const carriers = legs.map(carrierFromLeg).filter((c) => Boolean(c));
  const segments = parseSegments(legs);
  return {
    airlines,
    carrierHint: carriers[0] || null,
    priceMajor: typeof row.price === "number" && row.price > 0 ? row.price : null,
    currency,
    stops:
      typeof row.layovers?.length === "number"
        ? row.layovers.length
        : Math.max(0, legs.length - 1),
    durationMinutes:
      typeof row.total_duration === "number" ? row.total_duration : null,
    departureId: legs[0]?.departure_airport?.id || null,
    arrivalId: legs[legs.length - 1]?.arrival_airport?.id || null,
    ...(segments ? { segments } : {}),
  };
}

function normalizeIata(code) {
  const c = code.trim().toUpperCase();
  return IATA_RE.test(c) ? c : null;
}

function normalizeDate(raw) {
  const d = raw.trim();
  if (!DATE_RE.test(d)) return null;
  // Compare as UTC calendar days to avoid local TZ flipping "today".
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, day] = d.split("-").map(Number);
  const dateUtc = Date.UTC(y, m - 1, day);
  if (dateUtc < todayUtc) return null;
  return d;
}

function normalizeAirlineCodes(codes) {
  if (!codes?.length) return [];
  return [
    ...new Set(
      codes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => AIRLINE_CODE_RE.test(c)),
    ),
  ];
}

function parseResponse(json, fallbackCurrency) {
  const ccy = json.search_parameters?.currency || fallbackCurrency;
  const rows = [...(json.best_flights || []), ...(json.other_flights || [])];
  const options = rows
    .map((r) => toOption(r, ccy))
    .filter((o) => o != null)
    .slice(0, 16);
  const lowest =
    json.price_insights?.lowest_price ??
    options.reduce((min, o) => {
      if (o.priceMajor == null) return min;
      if (min == null || o.priceMajor < min) return o.priceMajor;
      return min;
    }, null);
  return { options, lowestPriceMajor: lowest };
}

async function fetchFlights(params, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      appLogger.warn(`[serp/flights] HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    appLogger.warn(`[serp/flights] failed: ${e instanceof Error ? e.message : e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google Flights via SerpAPI. Soft-fail → [].
 * One-way by default; set returnDate for round trip (type=1).
 *
 * Prefer filtering airlines locally — Serp `include_airlines` often returns
 * empty for otherwise valid routes (especially round trips).
 */
export async function searchGoogleFlights(opts) {
  if (!isSerpConfigured()) return EMPTY;
  const key = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!key) return EMPTY;

  const origin = normalizeIata(opts.origin);
  const destination = normalizeIata(opts.destination);
  const outboundDate = normalizeDate(opts.outboundDate);
  if (!origin || !destination || !outboundDate) {
    appLogger.warn(
      `[serp/flights] skip invalid query origin=${opts.origin} dest=${opts.destination} date=${opts.outboundDate}`,
    );
    return EMPTY;
  }

  const currency = opts.currency.toUpperCase().slice(0, 3);
  const returnDate = opts.returnDate ? normalizeDate(opts.returnDate) : null;
  // Round-trip only when return is valid and after outbound; else force one-way.
  const isRoundTrip = Boolean(returnDate && returnDate > outboundDate);
  const airlines = normalizeAirlineCodes(opts.includeAirlines);
  const timeoutMs = opts.timeoutMs ?? 20000;
  const gl = glForCurrency(currency);

  const buildParams = (deep, withAirlines) => {
    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: destination,
      outbound_date: outboundDate,
      currency,
      adults: String(Math.max(1, opts.adults ?? 1)),
      hl: "en",
      gl,
      type: isRoundTrip ? "1" : "2",
      api_key: key,
    });
    if (isRoundTrip && returnDate) params.set("return_date", returnDate);
    if (deep) params.set("deep_search", "true");
    if (withAirlines && airlines.length) {
      params.set("include_airlines", airlines.join(","));
    }
    return params;
  };

  const route = `${origin}→${destination} ${outboundDate}${isRoundTrip ? `/${returnDate}` : ""}`;

  // 1) Broad market search (no airline filter — most reliable).
  let json = await fetchFlights(buildParams(false, false), timeoutMs);
  if (json?.error || !json || parseResponse(json, currency).options.length === 0) {
    // 2) deep_search retry for flaky Google empty responses.
    json = await fetchFlights(buildParams(true, false), timeoutMs);
  }

  if (!json) return EMPTY;
  if (json.error) {
    appLogger.warn(`[serp/flights] ${route}: ${json.error}`);
    return EMPTY;
  }

  const result = parseResponse(json, currency);
  if (result.options.length === 0) {
    appLogger.warn(`[serp/flights] ${route}: empty after retry`);
    return EMPTY;
  }

  // Optional: if caller still asked for carriers, keep a filtered view only when hits exist.
  if (airlines.length) {
    const filtered = result.options.filter(
      (o) =>
        (o.carrierHint && airlines.includes(o.carrierHint)) ||
        o.airlines.some((name) =>
          airlines.some((code) => name.toUpperCase().includes(code)),
        ),
    );
    if (filtered.length > 0) {
      const lowest = filtered.reduce((min, o) => {
        if (o.priceMajor == null) return min;
        if (min == null || o.priceMajor < min) return o.priceMajor;
        return min;
      }, null);
      return { options: filtered, lowestPriceMajor: lowest };
    }
  }

  return result;
}
