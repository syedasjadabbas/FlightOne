/**
 * Normalize TripServices Stays SearchComplete → SupplierOffer[] (HOTEL).
 *
 * Travelport returns property rates in local currency and attaches
 * hotelsResponse.currencyExchangeRates for requestedCurrency. Docs state the
 * API does NOT convert amounts — we apply conversionFactor ourselves so chat
 * and booking always see requestedCurrency totals (e.g. PKR).
 */
import { travelportConfig } from "./config.js";
import { priceToMinor } from "./fareMetadata.js";

const SUPPLIER_CODE = "TRAVELPORT";

/** @param {unknown} major */
function toMinorPositive(major) {
  const minor = priceToMinor(major);
  return minor != null && minor > 0 ? minor : null;
}

function nightsBetween(checkIn, checkOut) {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.max(1, Math.round((b - a) / 86400000));
}

function pickHotels(root) {
  return root?.hotelsResponse?.propertyItems || root?.propertyItems || [];
}

/**
 * @param {any[]} rates
 * @returns {Map<string, number>} key `${source}->${target}` → conversionFactor
 */
export function buildFxMap(rates) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const row of rates || []) {
    const source = String(row?.sourceCurrency || "").toUpperCase();
    const target = String(row?.targetCurrency || "").toUpperCase();
    const factor = Number(row?.conversionFactor);
    if (!source || !target || !Number.isFinite(factor) || factor <= 0) continue;
    map.set(`${source}->${target}`, factor);
  }
  return map;
}

/**
 * Convert a major-unit amount using Travelport FX table.
 * @returns {{ amount: number, currency: string, converted: boolean, factor: number | null, sourceCurrency: string }}
 */
export function convertMajorAmount(amount, sourceCurrency, targetCurrency, fxMap) {
  const source = String(sourceCurrency || "").toUpperCase();
  const target = String(targetCurrency || source).toUpperCase();
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return { amount: NaN, currency: target, converted: false, factor: null, sourceCurrency: source };
  }
  if (!source || !target || source === target) {
    return { amount: n, currency: target || source, converted: false, factor: null, sourceCurrency: source };
  }
  const factor = fxMap.get(`${source}->${target}`);
  if (factor == null) {
    // No FX row — keep source currency rather than invent a rate.
    return { amount: n, currency: source, converted: false, factor: null, sourceCurrency: source };
  }
  return {
    amount: n * factor,
    currency: target,
    converted: true,
    factor,
    sourceCurrency: source,
  };
}

function starFromRatings(hotel) {
  const ratings = hotel?.propertyInfo?.ratings || [];
  for (const r of ratings) {
    const v = Number(r?.value ?? r?.rating ?? r?.score);
    if (Number.isFinite(v) && v > 0) {
      if (v <= 5) return Math.min(5, Math.round(v));
      if (v <= 10) return Math.min(5, Math.round(v / 2));
      return Math.min(5, Math.round(v / 20));
    }
  }
  return 3;
}

function breakfastFromHotel(hotel) {
  const amenities = hotel?.propertyInfo?.amenities || [];
  return amenities.some((a) => {
    const text = String(a?.name || a?.description || a?.code || "").toLowerCase();
    return text.includes("breakfast");
  });
}

/**
 * @param {any} responseJson
 * @param {import("../adapter.js").HotelSearchQuery} query
 * @param {{ requestedCurrency?: string }} [opts]
 */
export function normalizeStaysResponse(responseJson, query, opts = {}) {
  const cfg = travelportConfig();
  const requestedCurrency = String(opts.requestedCurrency || cfg.requestedCurrency || "PKR")
    .toUpperCase()
    .slice(0, 3);
  const fxMap = buildFxMap(responseJson?.hotelsResponse?.currencyExchangeRates);
  const hotels = pickHotels(responseJson);
  const nights = nightsBetween(query.checkInDate, query.checkOutDate);
  const maxOffers = Math.max(cfg.maxOffers, query.hotelName ? 24 : cfg.maxOffers);
  /** @type {import("../adapter.js").SupplierOffer[]} */
  const offers = [];

  for (const hotel of hotels) {
    if (hotel?.availability === false) continue;

    const bestRate =
      hotel?.lowestPublicAvailableRate ||
      hotel?.lowestUnfilteredPublicAvailableRate ||
      hotel?.roomTypes?.[0]?.rates?.[0];
    if (!bestRate) continue;

    const sourceCurrency = String(bestRate?.currencyCode || requestedCurrency)
      .toUpperCase()
      .slice(0, 3);
    const nightlyRaw =
      bestRate?.averageNightlyTotalPrice?.amount ??
      bestRate?.averageNightlyRate?.amount ??
      null;
    const stayTotalRaw = bestRate?.totalPrice?.amount ?? null;

    const nightlyFx = convertMajorAmount(nightlyRaw, sourceCurrency, requestedCurrency, fxMap);
    const stayFx =
      stayTotalRaw != null
        ? convertMajorAmount(stayTotalRaw, sourceCurrency, requestedCurrency, fxMap)
        : null;

    let amountMinor = Number.isFinite(nightlyFx.amount) ? toMinorPositive(nightlyFx.amount) : null;
    let stayTotalMinor =
      stayFx && Number.isFinite(stayFx.amount) ? toMinorPositive(stayFx.amount) : null;
    const displayCurrency = nightlyFx.currency || sourceCurrency;

    if (amountMinor == null && stayTotalMinor != null) {
      amountMinor = Math.round(stayTotalMinor / nights);
    }
    if (amountMinor == null) continue;
    if (stayTotalMinor == null) stayTotalMinor = amountMinor * nights;

    const id = hotel?.propertyCode || hotel?.name || String(offers.length + 1);
    const city = hotel?.propertyInfo?.address?.city || query.cityCode;
    const area =
      hotel?.propertyInfo?.address?.street ||
      hotel?.propertyInfo?.address?.postalCode ||
      "City centre";

    offers.push({
      supplierCode: SUPPLIER_CODE,
      offerId: `TP-HTL-${id}-${query.checkInDate}`.slice(0, 180),
      product: "HOTEL",
      currency: displayCurrency,
      amountMinor,
      fareRules: {
        refundable: Boolean(bestRate?.terms?.refundable),
        stayTotalMinor,
        nights,
      },
      details: {
        cityCode: query.cityCode,
        city,
        checkInDate: query.checkInDate,
        checkOutDate: query.checkOutDate,
        rooms: query.rooms ?? 1,
        guests: query.guests ?? 1,
        hotelName: hotel?.name || "Hotel",
        starRating: starFromRatings(hotel),
        area,
        roomType:
          bestRate?.shortRoomDescription ||
          hotel?.roomTypes?.[0]?.shortRoomDescription ||
          "Standard Room",
        breakfastIncluded: breakfastFromHotel(hotel),
        nights,
        stayTotalMinor,
        chainCode: hotel?.chainCode || null,
        propertyCode: hotel?.propertyCode || null,
        rateKey: bestRate?.rateKey?.value || null,
        rateAuthority: bestRate?.rateKey?.authority || null,
        sourceCurrency,
        sourceNightlyMajor: nightlyRaw,
        sourceStayTotalMajor: stayTotalRaw,
        fxConverted: Boolean(nightlyFx.converted),
        fxFactor: nightlyFx.factor,
        requestedCurrency,
      },
    });
  }

  // Prefer name matches before price sort/truncate when the guest named a hotel.
  const wanted = typeof query.hotelName === "string" ? query.hotelName.trim().toLowerCase() : "";
  offers.sort((a, b) => {
    if (wanted) {
      const am = String(a.details?.hotelName || "")
        .toLowerCase()
        .includes(wanted.split(/\s+/).filter((t) => t.length > 3)[0] || wanted);
      const bm = String(b.details?.hotelName || "")
        .toLowerCase()
        .includes(wanted.split(/\s+/).filter((t) => t.length > 3)[0] || wanted);
      if (am !== bm) return am ? -1 : 1;
    }
    return a.amountMinor - b.amountMinor;
  });

  return offers.slice(0, maxOffers);
}
