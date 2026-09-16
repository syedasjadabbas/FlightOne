/**
 * Raw supplier search via filght-one-server → Travelport.
 * Accepts validated FLIGHT/HOTEL bodies (LLM or heuristic callers).
 */
import type { FlightOffer, FlightSegment, HotelOffer, Offer } from "./types";
import type {
  BaggageAllowance,
  FareRulesSummary,
  FlightFareMetadata,
  SupplierBookingRefs,
  SupplierPriceBreakdown,
} from "./fareTypes";
import { allConnectionWarnings } from "./connectionAnalysis";
import { iataToPlace, isKnownIata } from "./places";
import { airlineDisplayName } from "@/lib/consultant/airlines";
import { sameMetro } from "@/lib/comps/altAirports";
import {
  logNormalizedFlightRequest,
  logFlightSearchTiming,
} from "@/lib/flight-search/searchTelemetry";
import { getSearchUserId } from "./searchUserContext";

export type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

export interface FlightSearchQuery {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: CabinClass;
  requestedCurrency?: string;
  /** IATA airline codes — Travelport CarrierPreference. */
  preferredCarriers?: string[];
  /** Default Permitted when preferredCarriers are set. */
  carrierPreferenceType?: "Permitted" | "Preferred";
}

export interface HotelSearchQuery {
  cityCode: string;
  checkInDate: string;
  checkOutDate: string;
  rooms?: number;
  guests?: number;
  hotelName?: string;
  requestedCurrency?: string;
}

export type SupplierSearchBody =
  | { product: "FLIGHT"; query: FlightSearchQuery }
  | { product: "HOTEL"; query: HotelSearchQuery };

type SupplierOfferDto = {
  supplierCode: string;
  offerId: string;
  product: string;
  currency: string;
  /** Supplier net fare (never the customer sell price). */
  amountMinor: number;
  /** Module 05 authoritative customer sell price when server priced the offer. */
  sellAmountMinor?: number;
  pricing?: {
    markupBps?: number;
    appliedRules?: unknown[];
    netMinor?: number;
    amountMinor?: number;
  };
  supplierOfferSnapshotId?: string;
  snapshotId?: string;
  snapshotExpiresAt?: string;
  fareRules?: {
    refundable?: boolean;
    brandRef?: string | null;
    brandName?: string | null;
    brandCode?: string | null;
    fareBasisCode?: string | null;
    bookingClass?: string | null;
    fareType?: string | null;
    validatingCarrier?: string | null;
    baggage?: BaggageAllowance;
    fareRulesSummary?: FareRulesSummary;
  };
  priceBreakdown?: SupplierPriceBreakdown;
  /**
   * 0–100 from server Booking fulfillment history when sample is large enough.
   * Absent when unavailable — do not invent a default on the client.
   */
  supplierReliability?: number | null;
  /** Authoritative airline quality only when provided; never invent locally. */
  airlineScore?: number | null;
  details?: {
    origin?: string;
    destination?: string;
    cabin?: string;
    cabinClass?: string;
    baggageKg?: number;
    carrier?: string;
    stops?: number;
    durationMinutes?: number | null;
    departTimeLocal?: string;
    arriveTimeLocal?: string | null;
    departureDate?: string;
    returnDate?: string | null;
    flightNumber?: string | null;
    aircraft?: string | null;
    segments?: Array<{
      carrier?: string;
      flightNumber?: string;
      aircraft?: string | null;
      originCode?: string;
      destinationCode?: string;
      departureDate?: string;
      departTimeLocal?: string;
      arrivalDate?: string;
      arriveTimeLocal?: string;
      durationMinutes?: number | null;
      layoverMinutesAfter?: number;
    }>;
    returnSegments?: Array<{
      carrier?: string;
      flightNumber?: string;
      aircraft?: string | null;
      originCode?: string;
      destinationCode?: string;
      departureDate?: string;
      departTimeLocal?: string;
      arrivalDate?: string;
      arriveTimeLocal?: string;
      durationMinutes?: number | null;
      layoverMinutesAfter?: number;
    }>;
    returnStops?: number | null;
    returnDurationMinutes?: number | null;
    paymentTimeLimit?: string | null;
    seatsAvailable?: number | null;
    flightRefs?: string[];
    returnFlightRefs?: string[];
    productRef?: string | null;
    combinabilityCode?: string | null;
    transactionId?: string | null;
    contentSource?: string | null;
    cityCode?: string;
    city?: string;
    hotelName?: string;
    starRating?: number;
    area?: string;
    roomType?: string;
    breakfastIncluded?: boolean;
    checkInDate?: string;
    checkOutDate?: string;
  };
};

function buildFareMetadataFromDto(dto: SupplierOfferDto): FlightFareMetadata | undefined {
  const fr = dto.fareRules;
  const d = dto.details;
  const hasMeta =
    fr?.brandName ||
    fr?.fareBasisCode ||
    fr?.baggage ||
    fr?.fareRulesSummary ||
    dto.priceBreakdown ||
    d?.paymentTimeLimit ||
    d?.productRef;

  if (!hasMeta) return undefined;

  const bookingRefs: SupplierBookingRefs | undefined =
    d?.productRef || d?.transactionId
      ? {
          productRef: d.productRef ?? null,
          brandRef: fr?.brandRef ?? null,
          flightRefs: d.flightRefs,
          returnFlightRefs: d.returnFlightRefs,
          transactionId: d.transactionId ?? null,
          combinabilityCode: d.combinabilityCode ?? null,
          contentSource: d.contentSource ?? null,
        }
      : undefined;

  return {
    ...(fr?.brandName ? { brandName: fr.brandName } : {}),
    ...(fr?.brandCode ? { brandCode: fr.brandCode } : {}),
    ...(fr?.fareBasisCode ? { fareBasisCode: fr.fareBasisCode } : {}),
    ...(fr?.bookingClass ? { bookingClass: fr.bookingClass } : {}),
    ...(fr?.fareType ? { fareType: fr.fareType } : {}),
    ...(fr?.validatingCarrier ? { validatingCarrier: fr.validatingCarrier } : {}),
    ...(d?.paymentTimeLimit ? { paymentTimeLimit: d.paymentTimeLimit } : {}),
    ...(fr?.baggage ? { baggageAllowance: fr.baggage } : {}),
    ...(fr?.fareRulesSummary ? { fareRulesSummary: fr.fareRulesSummary } : {}),
    ...(dto.priceBreakdown ? { supplierPriceBreakdown: dto.priceBreakdown } : {}),
    ...(bookingRefs ? { bookingRefs } : {}),
    validationStatus: "search_only",
  };
}

function apiBase(): string {
  return (
    process.env.FLIGHTONE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8084/api/v1"
  ).replace(/\/$/, "");
}

export function dtoToFlightOffer(
  dto: SupplierOfferDto,
  query?: Pick<FlightSearchQuery, "origin" | "destination">,
): FlightOffer | null {
  const segments = mapSegments(dto.details?.segments);
  const returnSegments = mapSegments(dto.details?.returnSegments);

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const originCode = (dto.details?.origin || firstSeg?.originCode || "").toUpperCase();
  const destinationCode = (dto.details?.destination || lastSeg?.destinationCode || "").toUpperCase();

  if (!originCode || !destinationCode) return null;
  if (!Number.isInteger(dto.amountMinor) || dto.amountMinor <= 0) return null;

  if (query) {
    const reqOrigin = query.origin.toUpperCase();
    const reqDest = query.destination.toUpperCase();
    const originOk = originCode === reqOrigin || sameMetro(originCode, reqOrigin);
    const destOk = destinationCode === reqDest || sameMetro(destinationCode, reqDest);
    if (!originOk || !destOk) return null;
  }

  const cabinRaw = (dto.details?.cabin || "economy").toLowerCase();
  const cabin =
    cabinRaw === "business" || cabinRaw === "premium" || cabinRaw === "economy"
      ? cabinRaw
      : "economy";

  const currency = dto.currency || "PKR";
  const net = { amount: dto.amountMinor, currency };

  const carrierCode = (dto.details?.carrier || firstSeg?.carrier || "XX").toUpperCase().slice(0, 2);
  const stops =
    segments.length > 0
      ? Math.max(0, segments.length - 1)
      : (dto.details?.stops ?? 0);
  const durationMinutes =
    segments.length > 0
      ? sumSegmentDurationMinutes(segments)
      : typeof dto.details?.durationMinutes === "number" && dto.details.durationMinutes > 0
        ? dto.details.durationMinutes
        : 0;

  const arriveTimeLocal =
    dto.details?.arriveTimeLocal || lastSeg?.arriveTimeLocal || undefined;

  const aircraft = dto.details?.aircraft ?? firstSeg?.aircraft ?? undefined;

  const fareMetadata = buildFareMetadataFromDto(dto);
  if (fareMetadata && segments.length) {
    fareMetadata.connectionWarnings = allConnectionWarnings(segments, returnSegments);
  }

  const snapshotId = dto.supplierOfferSnapshotId || dto.snapshotId;

  const serverSell =
    Number.isInteger(dto.sellAmountMinor) &&
    (dto.sellAmountMinor as number) > 0 &&
    dto.sellAmountMinor !== dto.amountMinor
      ? { amount: dto.sellAmountMinor as number, currency }
      : Number.isInteger(dto.sellAmountMinor) && (dto.sellAmountMinor as number) > 0
        ? { amount: dto.sellAmountMinor as number, currency }
        : undefined;

  return {
    id: dto.offerId,
    type: "flight",
    supplier: "Travelport",
    ...(snapshotId ? { supplierOfferSnapshotId: snapshotId } : {}),
    ...(dto.snapshotExpiresAt ? { snapshotExpiresAt: dto.snapshotExpiresAt } : {}),
    origin: iataToPlace(originCode),
    originCode,
    destination: iataToPlace(destinationCode),
    destinationCode,
    airline: airlineDisplayName(carrierCode),
    cabin,
    stops,
    durationMinutes,
    departTimeLocal: firstSeg?.departTimeLocal || dto.details?.departTimeLocal || "00:00",
    ...(arriveTimeLocal ? { arriveTimeLocal } : {}),
    ...(dto.details?.departureDate ? { departureDate: dto.details.departureDate } : {}),
    ...(dto.details?.flightNumber || firstSeg?.flightNumber
      ? { flightNumber: dto.details?.flightNumber || firstSeg?.flightNumber }
      : {}),
    ...(aircraft ? { aircraft } : {}),
    ...(segments.length > 0 ? { segments } : {}),
    ...(returnSegments.length > 0 ? { returnSegments } : {}),
    ...(typeof dto.details?.returnStops === "number"
      ? { returnStops: dto.details.returnStops }
      : {}),
    ...(typeof dto.details?.returnDurationMinutes === "number" &&
    dto.details.returnDurationMinutes > 0
      ? { returnDurationMinutes: dto.details.returnDurationMinutes }
      : {}),
    ...(dto.details?.returnDate
      ? { returnDate: dto.details.returnDate }
      : {}),
    ...(dto.fareRules?.refundable != null
      ? { refundable: dto.fareRules.refundable }
      : {}),
    ...(dto.details?.baggageKg != null && dto.details.baggageKg > 0
      ? { baggageKg: dto.details.baggageKg }
      : {}),
    ...(dto.details?.seatsAvailable != null && dto.details.seatsAvailable > 0
      ? { unitsLeft: dto.details.seatsAvailable }
      : {}),
    ...(fareMetadata ? { fareMetadata } : {}),
    ...(typeof dto.airlineScore === "number" && Number.isFinite(dto.airlineScore)
      ? { airlineScore: dto.airlineScore }
      : {}),
    ...(typeof dto.supplierReliability === "number" &&
    Number.isFinite(dto.supplierReliability)
      ? { supplierReliability: dto.supplierReliability }
      : {}),
    netFare: net,
    marketPrice: net,
    ...(serverSell ? { serverSellPrice: serverSell } : {}),
    ...(dto.pricing
      ? {
          serverPricing: {
            markupBps: dto.pricing.markupBps,
            appliedRules: dto.pricing.appliedRules,
          },
        }
      : {}),
    tags: ["live", "travelport", "gds"],
  };
}

function sumSegmentDurationMinutes(segments: FlightSegment[]): number {
  let total = 0;
  for (const s of segments) {
    if (typeof s.durationMinutes === "number" && s.durationMinutes > 0) {
      total += s.durationMinutes;
    }
    if (typeof s.layoverMinutesAfter === "number" && s.layoverMinutesAfter > 0) {
      total += s.layoverMinutesAfter;
    }
  }
  return total;
}

function mapSegments(
  raw: NonNullable<SupplierOfferDto["details"]>["segments"],
): FlightSegment[] {
  if (!raw?.length) return [];
  const out: FlightSegment[] = [];
  for (const s of raw) {
    if (!s?.originCode || !s?.destinationCode) continue;
    const carrier = (s.carrier || "XX").toUpperCase().slice(0, 2);
    out.push({
      carrier,
      flightNumber: s.flightNumber || carrier,
      aircraft: s.aircraft ?? null,
      originCode: s.originCode.toUpperCase(),
      destinationCode: s.destinationCode.toUpperCase(),
      departureDate: s.departureDate || "",
      departTimeLocal: s.departTimeLocal || "00:00",
      arrivalDate: s.arrivalDate || "",
      arriveTimeLocal: s.arriveTimeLocal || "00:00",
      durationMinutes:
        typeof s.durationMinutes === "number" && s.durationMinutes > 0
          ? s.durationMinutes
          : null,
      ...(typeof s.layoverMinutesAfter === "number"
        ? { layoverMinutesAfter: s.layoverMinutesAfter }
        : {}),
    });
  }
  return out;
}

export function dtoToHotelOffer(dto: SupplierOfferDto): HotelOffer | null {
  if (!Number.isInteger(dto.amountMinor) || dto.amountMinor <= 0) return null;
  const cityCode = dto.details?.cityCode || "XXX";
  const city = dto.details?.city || iataToPlace(cityCode);
  const net = { amount: dto.amountMinor, currency: dto.currency || "PKR" };
  const market = {
    amount: Math.round(dto.amountMinor * 1.1),
    currency: net.currency,
  };
  const stars = Math.min(5, Math.max(1, Number(dto.details?.starRating) || 3));
  const snapshotId = dto.supplierOfferSnapshotId || dto.snapshotId;
  const serverSell =
    Number.isInteger(dto.sellAmountMinor) && (dto.sellAmountMinor as number) > 0
      ? { amount: dto.sellAmountMinor as number, currency: net.currency }
      : undefined;

  return {
    id: dto.offerId,
    type: "hotel",
    supplier: "Travelport",
    ...(snapshotId ? { supplierOfferSnapshotId: snapshotId } : {}),
    ...(dto.snapshotExpiresAt ? { snapshotExpiresAt: dto.snapshotExpiresAt } : {}),
    city,
    cityCode,
    name: dto.details?.hotelName || "Hotel",
    area: dto.details?.area || "City centre",
    stars,
    roomType: dto.details?.roomType || "Standard Room",
    breakfastIncluded: Boolean(dto.details?.breakfastIncluded),
    ratingScore: 7.5 + stars * 0.3,
    reviewCount: 100,
    distanceToCentreKm: 2,
    ...(dto.fareRules?.refundable != null
      ? { refundable: dto.fareRules.refundable }
      : {}),
    ...(typeof dto.supplierReliability === "number" &&
    Number.isFinite(dto.supplierReliability)
      ? { supplierReliability: dto.supplierReliability }
      : {}),
    netFare: net,
    marketPrice: market,
    ...(serverSell ? { serverSellPrice: serverSell } : {}),
    ...(dto.pricing
      ? {
          serverPricing: {
            markupBps: dto.pricing.markupBps,
            appliedRules: dto.pricing.appliedRules,
          },
        }
      : {}),
    tags: ["live", "travelport", "stays"],
  };
}

/**
 * POST raw supplier body. Returns offers, or null if live search disabled / failed.
 * Concurrent identical FLIGHT queries coalesce onto one in-flight fetch (multi-city
 * + carrier discovery + alt-airport probes often repeat the same OD/date).
 * After the fetch completes, a short TTL keeps sequential duplicates (recovery
 * reshape / dual-origin / comps) from hammering Travelport again within ~8s.
 *
 * Cache key = product + query (+ userId). preferredCarriers order is normalized
 * so ["EK","QR"] and ["QR","EK"] share one entry. See supplierSearch.cache.test.ts.
 *
 * Expected open-jaw reduction (LHE/ISB→LON→SFO→MCO): client fan-out of ~60–100+
 * POST /suppliers/search collapses toward unique OD/date/carrier keys; combined
 * with server TTL, expect ~50–70% fewer outbound Travelport CatalogSearch calls.
 */
const inflightSupplierSearch = new Map<string, Promise<Offer[] | null>>();
const recentSupplierSearch = new Map<
  string,
  { at: number; value: Offer[] | null }
>();

/** Align with server SUPPLIER_SEARCH_CACHE_TTL_MS default. */
const SUPPLIER_SEARCH_RESULT_TTL_MS = 8_000;

function supplierSearchCacheKey(
  body: SupplierSearchBody,
  userId?: string,
): string {
  if (body.product === "FLIGHT") {
    const q = body.query;
    const carriers = [...(q.preferredCarriers || [])]
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
      .sort();
    return JSON.stringify({
      product: "FLIGHT",
      origin: q.origin.toUpperCase(),
      destination: q.destination.toUpperCase(),
      departureDate: q.departureDate,
      returnDate: q.returnDate ?? null,
      passengers: q.passengers ?? 1,
      cabinClass: (q.cabinClass || "ECONOMY").toUpperCase(),
      preferredCarriers: carriers,
      carrierPreferenceType: carriers.length
        ? q.carrierPreferenceType || "Permitted"
        : null,
      requestedCurrency: q.requestedCurrency?.toUpperCase() ?? null,
      userId: userId ?? null,
    });
  }
  return JSON.stringify({
    product: body.product,
    query: body.query,
    userId: userId ?? null,
  });
}

export async function searchSuppliers(
  body: SupplierSearchBody,
  options?: { userId?: string },
): Promise<Offer[] | null> {
  if (process.env.TRAVELPORT_LIVE_SEARCH === "false") return null;

  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    console.warn("[supplier-search] INTERNAL_API_KEY missing — skipping Travelport");
    return null;
  }

  if (body.product === "FLIGHT") {
    const { origin, destination } = body.query;
    if (origin === destination) {
      console.warn("[supplier-search] rejected same origin/destination", { origin });
      return null;
    }
    if (!isKnownIata(origin) || !isKnownIata(destination)) {
      console.warn("[supplier-search] unknown IATA", { origin, destination });
      return null;
    }
  }

  const userId = options?.userId || getSearchUserId();
  const cacheKey = supplierSearchCacheKey(body, userId);

  const cached = recentSupplierSearch.get(cacheKey);
  if (cached && Date.now() - cached.at < SUPPLIER_SEARCH_RESULT_TTL_MS) {
    return cached.value;
  }

  const existing = inflightSupplierSearch.get(cacheKey);
  if (existing) return existing;

  const pending = searchSuppliersUncached(body, {
    internalKey,
    userId,
  })
    .then((value) => {
      recentSupplierSearch.set(cacheKey, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inflightSupplierSearch.delete(cacheKey);
    });
  inflightSupplierSearch.set(cacheKey, pending);
  return pending;
}

/** Test helper — drop in-flight + TTL maps. */
export function clearSupplierSearchClientCacheForTests() {
  inflightSupplierSearch.clear();
  recentSupplierSearch.clear();
}

/** Exported for regression tests that assert key stability. */
export function supplierSearchCacheKeyForTests(
  body: SupplierSearchBody,
  userId?: string,
): string {
  return supplierSearchCacheKey(body, userId);
}

async function searchSuppliersUncached(
  body: SupplierSearchBody,
  opts: { internalKey: string; userId?: string },
): Promise<Offer[] | null> {
  if (body.product === "FLIGHT") {
    logNormalizedFlightRequest(body.query);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), body.product === "HOTEL" ? 55000 : 50000);
  const started = Date.now();

  try {
    const res = await fetch(`${apiBase()}/suppliers/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Internal-Api-Key": opts.internalKey,
        ...(opts.userId ? { "X-FlightOne-User-Id": opts.userId } : {}),
      },
      body: JSON.stringify({ product: body.product, query: body.query }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[supplier-search] HTTP ${res.status} product=${body.product}`);
      return null;
    }

    const json = (await res.json()) as {
      data?: { offers?: SupplierOfferDto[] };
      offers?: SupplierOfferDto[];
    };
    const raw = json?.data?.offers ?? json?.offers ?? [];

    if (body.product === "FLIGHT") {
      logFlightSearchTiming("travelport", Date.now() - started);
      const query = body.query;
      return raw
        .map((dto) => dtoToFlightOffer(dto, query))
        .filter((o): o is FlightOffer => o != null);
    }
    return raw.map(dtoToHotelOffer).filter((o): o is HotelOffer => o != null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.warn(
      `[supplier-search] failed${timedOut ? " (timeout)" : ""}:`,
      msg,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
