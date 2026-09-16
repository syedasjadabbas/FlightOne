/**
 * Normalize TripServices Search response → SupplierOffer[].
 *
 * Travelport prices are major-unit totals with CurrencyCode.decimalPlace.
 * We convert to integer minor units for lib/money.js.
 */
import { travelportConfig } from "./config.js";
import {
  buildFareMetadata,
  indexFareReferenceLists,
  priceToMinor,
} from "./fareMetadata.js";

const SUPPLIER_CODE = "GALILEO";

function currencyOf(priceNode) {
  const code = priceNode?.CurrencyCode?.value || priceNode?.CurrencyCode;
  if (typeof code === "string" && /^[A-Z]{3}$/.test(code)) return code;
  return "PKR";
}

function decimalPlaceOf(priceNode) {
  const d = priceNode?.CurrencyCode?.decimalPlace;
  return typeof d === "number" ? d : 2;
}

function indexReferenceLists(referenceList) {
  /** @type {Map<string, any>} */
  const flights = new Map();
  /** @type {Map<string, any>} */
  const products = new Map();

  for (const block of referenceList || []) {
    const type = block?.["@type"] || "";
    if (type.includes("ReferenceListFlight") || block?.Flight) {
      for (const f of block.Flight || []) {
        if (f?.id) flights.set(f.id, f);
      }
    }
    if (type.includes("ReferenceListProduct") || block?.Product) {
      for (const p of block.Product || []) {
        if (p?.id) products.set(p.id, p);
      }
    }
  }
  return { flights, products };
}

function cabinFromProduct(product) {
  const cabin = String(product?.cabin || product?.Cabin || "").toUpperCase();
  if (cabin.includes("FIRST")) return "FIRST";
  if (cabin.includes("BUSINESS")) return "BUSINESS";
  if (cabin.includes("PREMIUM")) return "PREMIUM_ECONOMY";
  return "ECONOMY";
}

function mapCabinToConsultant(cabinClass) {
  if (cabinClass === "BUSINESS" || cabinClass === "FIRST") return "business";
  if (cabinClass === "PREMIUM_ECONOMY") return "premium";
  return "economy";
}

/** Travelport returns ISO-8601 durations (PT3H20M) or occasionally minutes. */
export function parseDurationMinutes(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw !== "string" || !raw) return 0;
  const iso = raw.trim().toUpperCase();
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (m) {
    const h = Number(m[1] || 0);
    const mins = Number(m[2] || 0);
    const s = Number(m[3] || 0);
    return h * 60 + mins + Math.round(s / 60);
  }
  const asNum = Number(iso);
  return Number.isFinite(asNum) && asNum > 0 ? Math.round(asNum) : 0;
}

function clockFromTime(raw) {
  if (typeof raw !== "string" || !raw) return null;
  if (raw.includes("T")) return raw.split("T")[1]?.slice(0, 5) || null;
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  return null;
}

function localMs(date, time) {
  if (!date || !time) return null;
  const t = time.length === 5 ? `${time}:00` : time.slice(0, 8);
  const ms = Date.parse(`${date}T${t}`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {any[]} segmentFlights
 */
export function buildFlightSegments(segmentFlights) {
  /** @type {any[]} */
  const segments = [];
  for (let i = 0; i < segmentFlights.length; i++) {
    const f = segmentFlights[i];
    const dep = f?.Departure || f?.departure || {};
    const arr = f?.Arrival || f?.arrival || {};
    const carrier = String(f?.carrier || f?.Carrier || f?.operatingCarrier || "XX")
      .trim()
      .toUpperCase()
      .slice(0, 2);
    const number = String(f?.number || f?.Number || f?.flightNumber || "").trim();
    const originCode = String(dep?.location || dep?.Location || "").toUpperCase();
    const destinationCode = String(arr?.location || arr?.Location || "").toUpperCase();
    const departureDate = String(dep?.date || dep?.Date || "").slice(0, 10);
    const arrivalDate = String(arr?.date || arr?.Date || "").slice(0, 10);
    const departTimeLocal = clockFromTime(dep?.time || dep?.Time || "") || "00:00";
    const arriveTimeLocal = clockFromTime(arr?.time || arr?.Time || "") || "00:00";
    const durationMinutes = parseDurationMinutes(f?.duration || f?.Duration);
    const equipment = f?.equipment || f?.Equipment || null;

    let layoverMinutesAfter;
    const next = segmentFlights[i + 1];
    if (next) {
      const nextDep = next?.Departure || next?.departure || {};
      const arrMs = localMs(arrivalDate, arriveTimeLocal);
      const nextMs = localMs(
        String(nextDep?.date || nextDep?.Date || "").slice(0, 10),
        clockFromTime(nextDep?.time || nextDep?.Time || "") || "",
      );
      if (arrMs != null && nextMs != null && nextMs >= arrMs) {
        layoverMinutesAfter = Math.round((nextMs - arrMs) / 60000);
      }
    }

    if (!originCode || !destinationCode) continue;
    segments.push({
      carrier,
      flightNumber: number ? `${carrier}${number}` : carrier,
      number: number || null,
      aircraft: equipment ? String(equipment) : null,
      originCode,
      destinationCode,
      departureDate,
      departTimeLocal,
      arrivalDate,
      arriveTimeLocal,
      durationMinutes: durationMinutes || null,
      ...(layoverMinutesAfter != null ? { layoverMinutesAfter } : {}),
    });
  }
  return segments;
}

function doorToDoorMinutes(segments) {
  if (segments.length === 0) return null;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const start = localMs(first.departureDate, first.departTimeLocal);
  const end = localMs(last.arrivalDate, last.arriveTimeLocal);
  if (start == null || end == null || end < start) return null;
  return Math.round((end - start) / 60000);
}

function sumSegmentMinutes(segments) {
  let sum = 0;
  for (const s of segments) {
    if (s.durationMinutes) sum += s.durationMinutes;
    if (s.layoverMinutesAfter) sum += s.layoverMinutesAfter;
  }
  return sum || null;
}

function boundDurationMinutes(segments) {
  return doorToDoorMinutes(segments) || sumSegmentMinutes(segments);
}

/**
 * Classify a CatalogProductOffering as outbound vs return for an RT query.
 * Prefer Travelport `sequence` (1 = first O&D, 2 = return). Fall back to
 * Departure/Arrival vs the search query, then segment geometry.
 *
 * @param {any} offering
 * @param {{ origin: string, destination: string }} query
 * @param {any[]} segments
 * @returns {"outbound"|"return"|"unknown"}
 */
export function classifyOfferingBound(offering, query, segments) {
  const seq = Number(offering?.sequence ?? offering?.Sequence);
  if (seq === 1) return "outbound";
  if (seq === 2) return "return";

  const dep = String(offering?.Departure || offering?.departure || "")
    .toUpperCase()
    .slice(0, 3);
  const arr = String(offering?.Arrival || offering?.arrival || "")
    .toUpperCase()
    .slice(0, 3);
  const origin = String(query.origin || "").toUpperCase();
  const destination = String(query.destination || "").toUpperCase();

  if (dep && arr) {
    if (dep === origin && arr === destination) return "outbound";
    if (dep === destination && arr === origin) return "return";
  }

  const first = segments[0]?.originCode;
  const last = segments[segments.length - 1]?.destinationCode;
  if (first === origin || last === destination) return "outbound";
  if (first === destination || last === origin) return "return";
  return "unknown";
}

/**
 * @param {string[]} codes
 * @returns {string[]}
 */
function normalizeCombinabilityCodes(codes) {
  return [
    ...new Set(
      (codes || [])
        .map((c) => String(c || "").trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Build a SupplierOffer from outbound (required) + optional return bound.
 *
 * @param {object} args
 */
function buildSupplierOffer({
  cfg,
  query,
  transactionId,
  amountMinor,
  currency,
  cabinClass,
  brandRef,
  productRef,
  combinabilityCode,
  outbound,
  returnBound,
  fareMeta,
}) {
  const outSegs = outbound.segments || [];
  const retSegs = returnBound?.segments || [];
  const carriers = [
    ...new Set(
      [...outSegs, ...retSegs].map((s) => s.carrier).filter(Boolean),
    ),
  ];
  const firstSeg = outSegs[0];
  const lastOut = outSegs[outSegs.length - 1];
  const outStops = Math.max(0, outSegs.length - 1);
  const retStops = Math.max(0, retSegs.length - 1);
  const durationMinutes = boundDurationMinutes(outSegs);
  const returnDurationMinutes = retSegs.length
    ? boundDurationMinutes(retSegs)
    : null;

  const offerIdParts = [
    outbound.offeringId || "o",
    combinabilityCode || "",
    productRef || "",
    (outbound.flightRefs || []).join("-"),
    returnBound ? (returnBound.flightRefs || []).join("-") : "",
  ].filter(Boolean);

  return {
    supplierCode: SUPPLIER_CODE,
    offerId: `TP-${offerIdParts.join("_")}`.slice(0, 180),
    product: "FLIGHT",
    currency,
    amountMinor,
    fareRules: {
      brandRef: brandRef || null,
      ...(fareMeta?.brandName ? { brandName: fareMeta.brandName } : {}),
      ...(fareMeta?.brandCode ? { brandCode: fareMeta.brandCode } : {}),
      ...(fareMeta?.fareBasisCode ? { fareBasisCode: fareMeta.fareBasisCode } : {}),
      ...(fareMeta?.bookingClass ? { bookingClass: fareMeta.bookingClass } : {}),
      ...(fareMeta?.fareType ? { fareType: fareMeta.fareType } : {}),
      ...(fareMeta?.validatingCarrier ? { validatingCarrier: fareMeta.validatingCarrier } : {}),
      ...(fareMeta?.refundable != null ? { refundable: fareMeta.refundable } : {}),
      ...(fareMeta?.baggage ? { baggage: fareMeta.baggage } : {}),
      ...(fareMeta?.fareRulesSummary &&
      Object.keys(fareMeta.fareRulesSummary).length
        ? { fareRulesSummary: fareMeta.fareRulesSummary }
        : {}),
    },
    ...(fareMeta?.priceBreakdown ? { priceBreakdown: fareMeta.priceBreakdown } : {}),
    details: {
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate ?? null,
      cabinClass,
      cabin: mapCabinToConsultant(cabinClass),
      carrier: carriers[0] || "XX",
      carriers,
      stops: outStops,
      returnStops: retSegs.length ? retStops : null,
      durationMinutes: durationMinutes || null,
      returnDurationMinutes: returnDurationMinutes || null,
      departTimeLocal: firstSeg?.departTimeLocal || "00:00",
      arriveTimeLocal: lastOut?.arriveTimeLocal || null,
      flightNumber: firstSeg?.flightNumber || null,
      aircraft: firstSeg?.aircraft || null,
      segments: outSegs,
      ...(retSegs.length ? { returnSegments: retSegs } : {}),
      flightRefs: outbound.flightRefs || [],
      ...(returnBound?.flightRefs?.length
        ? { returnFlightRefs: returnBound.flightRefs }
        : {}),
      offeringId: outbound.offeringId || null,
      productRef: productRef || null,
      combinabilityCode: combinabilityCode || null,
      transactionId,
      contentSource: cfg.contentSource,
      ...(fareMeta?.paymentTimeLimit ? { paymentTimeLimit: fareMeta.paymentTimeLimit } : {}),
      ...(fareMeta?.baggageKg != null ? { baggageKg: fareMeta.baggageKg } : {}),
      ...(fareMeta?.seatsAvailable != null ? { seatsAvailable: fareMeta.seatsAvailable } : {}),
    },
  };
}

/**
 * Collect every priced ProductBrandOffering as a single-bound partial.
 *
 * @param {any[]} offerings
 * @param {Map<string, any>} flights
 * @param {Map<string, any>} products
 * @param {{ origin: string, destination: string }} query
 */
function collectBoundPartials(offerings, flights, products, brands, terms, query) {
  /** @type {any[]} */
  const partials = [];

  for (const offering of offerings) {
    const options = offering?.ProductBrandOptions || [];
    for (const option of options) {
      const flightRefs = option?.flightRefs || [];
      const segmentFlights = flightRefs.map((ref) => flights.get(ref)).filter(Boolean);
      const segments = buildFlightSegments(segmentFlights);
      if (!segments.length) continue;

      const bound = classifyOfferingBound(offering, query, segments);
      const brandOfferings = option?.ProductBrandOffering || [];

      for (const brandOffering of brandOfferings) {
        const priceNode = brandOffering?.BestCombinablePrice || brandOffering?.Price;
        if (!priceNode) continue;

        const currency = currencyOf(priceNode);
        const decimals = decimalPlaceOf(priceNode);
        const total = priceNode.TotalPrice ?? priceNode.Total;
        // lib/money always uses ÷100. Travelport TotalPrice is major units even when
        // CurrencyCode.decimalPlace is 0 (whole rupees, no paise in the payload).
        const amountMinor = priceToMinor(total, decimals);
        if (amountMinor == null || amountMinor <= 0) continue;

        const productRef = brandOffering?.Product?.[0]?.productRef;
        const product = productRef ? products.get(productRef) : null;
        const cabinClass = cabinFromProduct(product);
        const codes = normalizeCombinabilityCodes(brandOffering?.CombinabilityCode);
        const brandRef = brandOffering?.Brand?.BrandRef || null;
        const termsRef =
          brandOffering?.TermsAndConditions?.termsAndConditionsRef || null;
        const fareMeta = buildFareMetadata({
          brandRef,
          productRef,
          product,
          brands,
          terms,
          termsRef,
          priceNode,
        });

        partials.push({
          bound,
          offeringId: offering?.id || null,
          flightRefs,
          segments,
          amountMinor,
          currency,
          cabinClass,
          productRef: productRef || null,
          brandRef,
          codes,
          fareMeta,
        });
      }
    }
  }

  return partials;
}

/**
 * Pair Journey RT outbound + return partials that share a CombinabilityCode.
 * Unpaired returns are dropped (they were previously shown as fake one-way cards).
 * Unpaired outbounds still emit with returnDate so the fare isn't lost, but without returnSegments.
 *
 * @param {any[]} partials
 * @param {object} ctx
 */
export function assembleOffersFromPartials(partials, ctx) {
  const { cfg, query, transactionId } = ctx;
  const isRoundTrip = Boolean(query.returnDate);

  if (!isRoundTrip) {
    return partials
      .filter((p) => p.bound !== "return")
      .sort((a, b) => a.amountMinor - b.amountMinor)
      .slice(0, cfg.maxOffers)
      .map((p) =>
        buildSupplierOffer({
          cfg,
          query,
          transactionId,
          amountMinor: p.amountMinor,
          currency: p.currency,
          cabinClass: p.cabinClass,
          brandRef: p.brandRef,
          productRef: p.productRef,
          combinabilityCode: p.codes[0] || null,
          outbound: p,
          returnBound: null,
          fareMeta: p.fareMeta,
        }),
      );
  }

  const outbounds = partials
    .filter((p) => p.bound === "outbound" || p.bound === "unknown")
    .sort((a, b) => a.amountMinor - b.amountMinor);
  const returns = partials.filter((p) => p.bound === "return");

  /** @type {Map<string, any[]>} */
  const returnsByCode = new Map();
  for (const r of returns) {
    for (const code of r.codes) {
      const list = returnsByCode.get(code) || [];
      list.push(r);
      returnsByCode.set(code, list);
    }
  }

  /** @type {import("../adapter.js").SupplierOffer[]} */
  const offers = [];
  const seen = new Set();

  for (const out of outbounds) {
    let matched = null;
    let matchedCode = out.codes[0] || null;

    for (const code of out.codes) {
      const candidates = returnsByCode.get(code) || [];
      if (!candidates.length) continue;
      // Prefer the return whose BestCombinablePrice matches the outbound RT total.
      matched =
        candidates.find((c) => c.amountMinor === out.amountMinor) || candidates[0];
      matchedCode = code;
      break;
    }

    // Fallback: same currency, any return — last resort so travellers still
    // see a return block when Travelport codes don't overlap cleanly.
    if (!matched && returns.length === 1) {
      matched = returns[0];
    }

    const key = [
      (out.flightRefs || []).join("-"),
      matched ? (matched.flightRefs || []).join("-") : "none",
      out.amountMinor,
      matchedCode || "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    offers.push(
      buildSupplierOffer({
        cfg,
        query,
        transactionId,
        amountMinor: out.amountMinor,
        currency: out.currency,
        cabinClass: out.cabinClass,
        brandRef: out.brandRef,
        productRef: out.productRef,
        combinabilityCode: matchedCode,
        outbound: out,
        returnBound: matched,
        fareMeta: out.fareMeta,
      }),
    );

    if (offers.length >= cfg.maxOffers) break;
  }

  return offers;
}

/**
 * @param {any} responseJson
 * @param {{ origin: string, destination: string, departureDate: string, returnDate?: string }} query
 */
export function normalizeSearchResponse(responseJson, query) {
  const cfg = travelportConfig();
  const root =
    responseJson?.CatalogProductOfferingsResponse ||
    responseJson?.CatalogProductOfferingsQueryResponse?.CatalogProductOfferingsResponse ||
    responseJson;

  const offerings = root?.CatalogProductOfferings?.CatalogProductOffering || [];
  const { flights, products } = indexReferenceLists(root?.ReferenceList);
  const { brands, terms } = indexFareReferenceLists(root?.ReferenceList);
  const transactionId = root?.transactionId || null;

  const partials = collectBoundPartials(offerings, flights, products, brands, terms, query);
  return assembleOffersFromPartials(partials, { cfg, query, transactionId });
}
