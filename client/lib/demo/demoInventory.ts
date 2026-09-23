/**
 * Demo-mode inventory served from the captured/generated Galileo corpus
 * (`galileo-fares.json`) instead of a live Travelport round-trip.
 *
 * Enabled with DEMO_FLIGHT_INVENTORY=true. Off by default, so production
 * behaviour is unchanged unless the flag is explicitly set.
 *
 * Only the 35 `generated: true` searches are synthetic; the other 5 are real
 * terminal captures. Both are historical and NOT bookable — this exists so a
 * demo keeps working when live GDS is slow or unavailable.
 */
import corpus from "./galileo-fares.json";
import type { FlightOffer, FlightSegment, Offer } from "@/lib/inventory/types";
import type { FlightSearchQuery, CabinClass } from "@/lib/inventory/supplierSearch";

/** `systemOffers` is authored to the FlightOffer contract; see expand.cjs. */
const OFFERS = corpus.systemOffers as unknown as FlightOffer[];

export function isDemoInventoryEnabled(): boolean {
  return process.env.DEMO_FLIGHT_INVENTORY === "true";
}

function cabinFromClass(c?: CabinClass): FlightOffer["cabin"] | undefined {
  if (!c) return undefined;
  if (c === "BUSINESS" || c === "FIRST") return "business";
  if (c === "PREMIUM_ECONOMY") return "premium";
  return "economy";
}

/**
 * Corpus offers carry no `passengers` dimension — fares are per-adult, so a
 * 2-pax ask still matches and the pricing engine multiplies downstream.
 * Date is matched exactly: a demo query for an uncovered date must return
 * nothing rather than silently serve a different day's fares.
 */
export function findDemoFlights(query: FlightSearchQuery): FlightOffer[] {
  const origin = query.origin?.toUpperCase();
  const destination = query.destination?.toUpperCase();
  if (!origin || !destination) return [];

  const wantCabin = cabinFromClass(query.cabinClass);
  const wantReturn = Boolean(query.returnDate);

  const tripTypeOk = (o: FlightOffer) =>
    // A one-way ask must not be answered with a round-trip total, and vice
    // versa — the netFare covers a different journey.
    wantReturn === Boolean(o.returnSegments?.length);

  let routeAndTrip = OFFERS.filter(
    (o) => o.originCode === origin && o.destinationCode === destination && tripTypeOk(o),
  );

  // 62 of 72 corpus routes have no reverse direction, so a multi-city return
  // leg (Paris→Lahore when only Lahore→Paris is priced) came back empty.
  // Mirror the priced direction rather than dropping the leg.
  if (routeAndTrip.length === 0) {
    const reverse = OFFERS.filter(
      (o) => o.originCode === destination && o.destinationCode === origin && tripTypeOk(o),
    );
    routeAndTrip = reverse.map(reverseOffer);
  }

  // Last resort: the corpus prices neither direction of this pair (e.g.
  // MLE→BCN). Stitch A→hub and hub→B from routes it does price, so an
  // arbitrary multi-city leg still returns something bookable-looking.
  if (routeAndTrip.length === 0 && !wantReturn) {
    routeAndTrip = stitchViaHub(origin, destination);
  }
  if (routeAndTrip.length === 0) return [];

  // Most corpus routes carry a single cabin, so an ask for any other one came
  // back empty on nearly every leg. Convert from whatever cabin IS priced —
  // in either direction: a few routes (LHE-VIE) are business-only, so
  // upgrading from economy alone still left an economy ask with nothing.
  let onRoute = wantCabin
    ? routeAndTrip.filter((o) => o.cabin === wantCabin)
    : routeAndTrip;
  if (onRoute.length === 0 && wantCabin) {
    // Prefer converting from economy when it exists — it is the densest
    // cabin and the least distorted starting point.
    const economy = routeAndTrip.filter((o) => o.cabin === "economy");
    const source = economy.length > 0 ? economy : routeAndTrip;
    onRoute = source.map((o) => convertCabin(o, wantCabin));
  }

  const wantDate = query.departureDate;
  let matches = onRoute.filter((o) => o.departureDate === wantDate);

  // 64 of 72 corpus routes carry exactly ONE date, so an exact-date match
  // leaves almost every realistic ask empty — and a multi-leg itinerary is
  // assembled with `skipExploratory`, so one empty leg kills the whole trip
  // with no fallback. Rebase the nearest priced date onto what was asked.
  if (matches.length === 0 && wantDate) {
    const nearest = nearestDate(onRoute, wantDate);
    if (nearest) {
      matches = onRoute
        .filter((o) => o.departureDate === nearest)
        .map((o) => shiftOfferToDate(o, wantDate, query.returnDate));
    }
  }

  const carriers = (query.preferredCarriers || []).map((c) => c.toUpperCase());
  if (carriers.length === 0) return matches;
  // Mirror the live path: preferred carriers rank first, others still shown.
  const hit = matches.filter((o) => carriers.includes(o.segments?.[0]?.carrier ?? ""));
  const rest = matches.filter((o) => !carriers.includes(o.segments?.[0]?.carrier ?? ""));
  return [...hit, ...rest];
}

/**
 * Every city the corpus can reach from a given endpoint, in either direction.
 *
 * A fixed hub list does not work here: the corpus prices only 7 pairs where a
 * Gulf hub is an ENDPOINT — hubs mostly appear as connection points inside
 * itineraries. Connecting through whatever cities are actually priced covers
 * far more arbitrary pairs.
 */
function reachableFrom(code: string): Set<string> {
  const out = new Set<string>();
  for (const o of OFFERS) {
    if (o.returnSegments?.length) continue;
    if (o.originCode === code) out.add(o.destinationCode);
    else if (o.destinationCode === code) out.add(o.originCode);
  }
  return out;
}

/** Any offer on this exact pair, in either direction, mirrored if needed. */
function directionalOffers(from: string, to: string): FlightOffer[] {
  const forward = OFFERS.filter(
    (o) =>
      o.originCode === from &&
      o.destinationCode === to &&
      !o.returnSegments?.length,
  );
  if (forward.length > 0) return forward;
  return OFFERS.filter(
    (o) =>
      o.originCode === to &&
      o.destinationCode === from &&
      !o.returnSegments?.length,
  ).map(reverseOffer);
}

/**
 * Build A→hub→B from two priced legs when the corpus has no direct pair.
 *
 * The stitched fare is the sum of its parts and the connection is a nominal
 * 150 minutes — this is demo inventory, not a real through-fare, and it is
 * tagged `connection` + `stitched` so it is never mistaken for one.
 */
function stitchViaHub(origin: string, destination: string, depth = 0): FlightOffer[] {
  const out: FlightOffer[] = [];

  const fromOrigin = reachableFrom(origin);
  const toDestination = reachableFrom(destination);
  let hubs = [...fromOrigin]
    .filter((c) => c !== origin && c !== destination && toDestination.has(c))
    // Deterministic, and keeps the option count sane on dense corpora.
    .sort()
    .slice(0, 3);

  // No shared intermediate (e.g. ISB→BKK). Allow one more hop: pick a city
  // reachable from the origin that itself shares an intermediate with the
  // destination, and let the recursive call build the second half.
  if (hubs.length === 0) {
    const twoHop = [...fromOrigin]
      .filter((c) => c !== origin && c !== destination)
      .sort()
      .find((c) => {
        const mid = reachableFrom(c);
        return [...mid].some(
          (m) => m !== origin && m !== c && m !== destination && toDestination.has(m),
        );
      });
    if (twoHop) hubs = [twoHop];
  }

  for (const hub of hubs) {
    const first = directionalOffers(origin, hub);
    // The second half may itself need a hub. `depth` caps this at two hops —
    // beyond that the itinerary stops resembling anything sellable.
    const second =
      directionalOffers(hub, destination).length > 0
        ? directionalOffers(hub, destination)
        : depth < 1
          ? stitchViaHub(hub, destination, depth + 1)
          : [];
    if (first.length === 0 || second.length === 0) continue;

    // Cheapest viable pairing per hub — enough for a demo, and deterministic.
    const a = first.reduce((x, y) => (y.netFare.amount < x.netFare.amount ? y : x));
    const b = second.reduce((x, y) => (y.netFare.amount < x.netFare.amount ? y : x));
    const aSegs = a.segments ?? [];
    const bSegs = b.segments ?? [];
    if (aSegs.length === 0 || bSegs.length === 0) continue;

    const baseDay = dayNumber(a.departureDate ?? aSegs[0].departureDate);
    const lastA = aSegs[aSegs.length - 1];
    const arrivalShift = dayNumber(lastA.arrivalDate) - baseDay;

    // Re-date the second leg to depart the day the first one lands.
    const bBase = dayNumber(bSegs[0].departureDate);
    const bShift = baseDay + arrivalShift - bBase;
    const rebasedB = bSegs.map((s) => ({
      ...s,
      departureDate: new Date((dayNumber(s.departureDate) + bShift) * DAY_MS)
        .toISOString()
        .slice(0, 10),
      arrivalDate: new Date((dayNumber(s.arrivalDate) + bShift) * DAY_MS)
        .toISOString()
        .slice(0, 10),
    }));

    const segments = [
      ...aSegs.map((s, i) =>
        i === aSegs.length - 1 ? { ...s, layoverMinutesAfter: 150 } : s,
      ),
      ...rebasedB,
    ];

    const lastSeg = segments[segments.length - 1];
    const durationMinutes =
      segments.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0) + 150;

    out.push({
      ...a,
      id: `${a.id}+${b.id}-VIA${hub}`,
      destination: b.destination,
      destinationCode: destination,
      arriveTimeLocal: lastSeg.arriveTimeLocal,
      stops: segments.length - 1,
      durationMinutes,
      segments,
      netFare: { ...a.netFare, amount: a.netFare.amount + b.netFare.amount },
      marketPrice: {
        ...a.marketPrice,
        amount: a.marketPrice.amount + b.marketPrice.amount,
      },
      // No single supplier priced this pairing — never present it as a quotable
      // through-fare snapshot.
      supplierOfferSnapshotId: undefined,
      tags: ["connection", a.cabin, "stitched", `via-${hub.toLowerCase()}`],
    });
  }

  return out;
}

/**
 * Mirror a priced itinerary to fly the opposite direction.
 *
 * Sectors are reversed and re-chained, keeping each sector's duration and
 * layover, so the journey stays internally consistent. Local clock times are
 * carried over from the sector being mirrored — a demo-grade approximation,
 * not a real return schedule.
 */
function reverseOffer(offer: FlightOffer): FlightOffer {
  const src = offer.segments ?? [];
  if (src.length === 0) return offer;

  const reversed = [...src].reverse();
  const depDate = offer.departureDate ?? src[0].departureDate;
  const baseDay = dayNumber(depDate);

  const segments: FlightSegment[] = reversed.map((s, i) => {
    const mirror = src[src.length - 1 - i];
    // Day offset of this sector within the original trip, preserved so an
    // overnight connection stays overnight in the mirrored direction.
    const dayShift = dayNumber(s.departureDate) - dayNumber(src[0].departureDate);
    const arrShift = dayNumber(s.arrivalDate) - dayNumber(s.departureDate);
    const departureDate = new Date((baseDay + dayShift) * DAY_MS).toISOString().slice(0, 10);
    return {
      ...s,
      originCode: s.destinationCode,
      destinationCode: s.originCode,
      departureDate,
      departTimeLocal: s.departTimeLocal,
      arrivalDate: new Date((baseDay + dayShift + arrShift) * DAY_MS)
        .toISOString()
        .slice(0, 10),
      arriveTimeLocal: s.arriveTimeLocal,
      layoverMinutesAfter:
        i < reversed.length - 1 ? mirror.layoverMinutesAfter : undefined,
    };
  });

  return {
    ...offer,
    id: `${offer.id}-REV`,
    origin: offer.destination,
    originCode: offer.destinationCode,
    destination: offer.origin,
    destinationCode: offer.originCode,
    departTimeLocal: segments[0].departTimeLocal,
    arriveTimeLocal: segments[segments.length - 1].arriveTimeLocal,
    departureDate: segments[0].departureDate,
    flightNumber: segments[0].flightNumber,
    segments,
  };
}

/**
 * Cabin multipliers over the economy fare — representative market ratios for
 * long-haul ex-PK, not supplier pricing. Demo-grade, like the rest of the
 * generated corpus.
 */
const CABIN_MULTIPLIER: Record<string, number> = {
  economy: 1,
  premium: 2.1,
  business: 3.4,
};

/**
 * Re-price an itinerary into another cabin, scaling relative to the cabin it
 * is already in — so this works downward (business → economy) as well as up.
 */
function convertCabin(offer: FlightOffer, cabin: FlightOffer["cabin"]): FlightOffer {
  const from = CABIN_MULTIPLIER[offer.cabin] ?? 1;
  const to = CABIN_MULTIPLIER[cabin] ?? 1;
  const factor = to / from;
  const scale = (amount: number) => Math.round((amount * factor) / 100) * 100;
  const baggageKg = cabin === "business" ? 40 : cabin === "premium" ? 35 : 30;

  return {
    ...offer,
    id: `${offer.id}-${cabin.toUpperCase().slice(0, 3)}`,
    cabin,
    baggageKg,
    refundable: cabin === "business",
    netFare: { ...offer.netFare, amount: scale(offer.netFare.amount) },
    marketPrice: { ...offer.marketPrice, amount: scale(offer.marketPrice.amount) },
    ...(offer.fareMetadata
      ? {
          fareMetadata: {
            ...offer.fareMetadata,
            brandName:
              cabin === "business"
                ? "Business Saver"
                : cabin === "premium"
                  ? "Premium Flex"
                  : "Economy Saver",
            ...(offer.fareMetadata.supplierPriceBreakdown
              ? {
                  supplierPriceBreakdown: {
                    ...offer.fareMetadata.supplierPriceBreakdown,
                    baseMinor: scale(
                      offer.fareMetadata.supplierPriceBreakdown.baseMinor ?? 0,
                    ),
                    taxesMinor: scale(
                      offer.fareMetadata.supplierPriceBreakdown.taxesMinor ?? 0,
                    ),
                    totalMinor: scale(
                      offer.fareMetadata.supplierPriceBreakdown.totalMinor,
                    ),
                  },
                }
              : {}),
          },
        }
      : {}),
    tags: [
      ...offer.tags.filter((t) => !["economy", "premium", "business"].includes(t)),
      cabin,
    ],
  };
}

const DAY_MS = 86_400_000;

const dayNumber = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

const addDays = (iso: string, days: number): string =>
  new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);

/** Priced date on this route closest to what the traveller asked for. */
function nearestDate(offers: FlightOffer[], wantDate: string): string | null {
  const want = dayNumber(wantDate);
  if (!Number.isFinite(want)) return null;
  let best: string | null = null;
  let bestGap = Infinity;
  for (const o of offers) {
    if (!o.departureDate) continue;
    const gap = Math.abs(dayNumber(o.departureDate) - want);
    // Ties resolve to the earlier date so the choice is deterministic.
    if (gap < bestGap || (gap === bestGap && best && o.departureDate < best)) {
      bestGap = gap;
      best = o.departureDate;
    }
  }
  return best;
}

function shiftSegments(segments: FlightSegment[] | undefined, days: number) {
  return segments?.map((s) => ({
    ...s,
    departureDate: addDays(s.departureDate, days),
    arrivalDate: addDays(s.arrivalDate, days),
  }));
}

/**
 * Move a priced offer onto the requested date, preserving local times, sector
 * durations and the fare. Only the calendar dates move — a fare shifted by a
 * few days stays representative, and the demo corpus is not live pricing.
 */
function shiftOfferToDate(
  offer: FlightOffer,
  wantDate: string,
  wantReturnDate?: string,
): FlightOffer {
  if (!offer.departureDate) return offer;
  const days = dayNumber(wantDate) - dayNumber(offer.departureDate);
  if (days === 0) return offer;

  const shifted: FlightOffer = {
    ...offer,
    // A shifted offer is a different sellable thing — a distinct id keeps
    // dedupe, selection and snapshot minting from colliding with the original.
    id: `${offer.id}-D${wantDate.replace(/-/g, "")}`,
    departureDate: wantDate,
    segments: shiftSegments(offer.segments, days),
  };

  if (offer.returnSegments?.length) {
    // Keep the original trip length unless the traveller named a return date.
    const returnDays =
      wantReturnDate && offer.returnDate
        ? dayNumber(wantReturnDate) - dayNumber(offer.returnDate)
        : days;
    shifted.returnSegments = shiftSegments(offer.returnSegments, returnDays);
    shifted.returnDate = offer.returnDate
      ? addDays(offer.returnDate, returnDays)
      : offer.returnDate;
  }

  return shifted;
}

/** Null (not []) when the corpus has nothing, so callers fall through to live. */
export function searchDemoFlights(query: FlightSearchQuery): Offer[] | null {
  const hits = findDemoFlights(query);
  return hits.length > 0 ? hits : null;
}
