/**
 * Flight GDS retrieval with carrier discovery.
 *
 * Travelport "open market" often returns a thin, one-airline slice (e.g. only
 * Etihad on LHE→PEK) even when other carriers (Thai TG) are bookable under a
 * Permitted-carrier search. Recommendation can only score what we fetch —
 * so when diversity is low we probe additional majors and merge, then let
 * price/duration curation pick cheapest / fastest / best value.
 */
import {
  airlineIataCode,
  airlineMatchesPreference,
} from "@/lib/consultant/airlines";
import type { Offer } from "./types";
import { isFlight } from "./types";
import {
  searchSuppliers,
  type FlightSearchQuery,
} from "./supplierSearch";

/**
 * Majors commonly competitive on PK / Asia / Gulf–US leisure routes.
 * Probed one-at-a-time when open market is carrier-poor (multi-code Permitted
 * requests that include the dominate open carrier can suppress others).
 */
const DISCOVERY_CARRIERS = [
  "PK",
  "TG",
  "EK",
  "QR",
  "SQ",
  "UL",
  "SV",
  "WY",
  "CX",
  "MH",
  "EY",
  "CZ",
] as const;

/** Run discovery when open market has fewer than this many distinct carriers. */
export const LOW_DIVERSITY_THRESHOLD = 3;
/** Cap extra GDS calls per leg (latency budget). */
const MAX_DISCOVERY_PROBES = 4;
/** Bound concurrent Permitted-carrier probes (avoid stampeding Travelport). */
const DISCOVERY_PROBE_CONCURRENCY = 2;

/** True when open-market inventory already has healthy carrier diversity. */
export function openMarketAlreadyDiverse(offers: Offer[]): boolean {
  return carrierCodesInOffers(offers).size >= LOW_DIVERSITY_THRESHOLD;
}

/**
 * Pakistan-origin airports → the home flag carrier a Pakistani traveller
 * expects to see compared, regardless of how many other carriers the open
 * market already returned. Without this, PIA can be silently crowded out of
 * discovery whenever Etihad/Emirates/Qatar alone already clear the generic
 * diversity threshold below — see the LHE-DXB / LHE-SHJ agent bug reports.
 */
const HOME_CARRIER_BY_ORIGIN: Record<string, string> = {
  LHE: "PK",
  ISB: "PK",
  KHI: "PK",
  MUX: "PK",
  PEW: "PK",
  SKT: "PK",
};

/**
 * Carriers the open-market result already covers (marketing + segment ops).
 * Exported so E2E raw-ID audits can mirror the same discovery fan-out.
 */
export function carrierCodesInOffers(offers: Offer[]): Set<string> {
  const out = new Set<string>();
  for (const o of offers) {
    if (!isFlight(o)) continue;
    const code = airlineIataCode(o.airline);
    if (/^[A-Z0-9]{2}$/.test(code)) out.add(code);
    for (const s of o.segments || []) {
      const c = (s.carrier || "").toUpperCase().slice(0, 2);
      if (/^[A-Z0-9]{2}$/.test(c)) out.add(c);
    }
  }
  return out;
}

/**
 * Extra Permitted-carrier probes that searchFlightsPreferredThenOpen will run
 * after an open-market response. Empty when diversity is already healthy and
 * the home flag carrier (if any) is present.
 */
export function discoveryCarriersToProbe(
  query: FlightSearchQuery,
  openOffers: Offer[],
): string[] {
  const present = carrierCodesInOffers(openOffers);
  const homeCarrier = HOME_CARRIER_BY_ORIGIN[query.origin.toUpperCase()];
  const homeCarrierMissing = !!homeCarrier && !present.has(homeCarrier);

  if (present.size >= LOW_DIVERSITY_THRESHOLD && !homeCarrierMissing) {
    return [];
  }

  const genericProbes =
    present.size >= LOW_DIVERSITY_THRESHOLD
      ? []
      : DISCOVERY_CARRIERS.filter((c) => c !== homeCarrier && !present.has(c)).slice(
          0,
          MAX_DISCOVERY_PROBES,
        );
  return homeCarrierMissing ? [homeCarrier!, ...genericProbes] : [...genericProbes];
}

export async function searchFlightsPreferredThenOpen(
  query: FlightSearchQuery,
  preferredCarriers?: string[],
): Promise<Offer[] | null> {
  const carriers = [
    ...new Set(
      (preferredCarriers || [])
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z0-9]{2}$/.test(c)),
    ),
  ].slice(0, 6);

  if (carriers.length > 0) {
    const [forced, open] = await Promise.all([
      searchSuppliers({
        product: "FLIGHT",
        query: {
          ...query,
          preferredCarriers: carriers,
          carrierPreferenceType: "Permitted",
        },
      }),
      searchSuppliers({ product: "FLIGHT", query }),
    ]);
    const merged = mergeFlightOffers(forced, open);
    if (!merged) return null;
    return rankPreferredCarriersFirst(merged, carriers);
  }

  const open = await searchSuppliers({ product: "FLIGHT", query });
  const openList = open ?? [];
  const toProbe = discoveryCarriersToProbe(query, openList);
  if (toProbe.length === 0) {
    return openList.length > 0 ? openList : null;
  }

  const probed = await mapWithConcurrency(
    toProbe,
    DISCOVERY_PROBE_CONCURRENCY,
    (code) =>
      searchSuppliers({
        product: "FLIGHT",
        query: {
          ...query,
          preferredCarriers: [code],
          carrierPreferenceType: "Permitted",
        },
      }),
  );

  const merged = mergeFlightOffers(
    openList,
    probed.flatMap((batch) => batch ?? []),
  );
  return merged;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

function mergeFlightOffers(
  a: Offer[] | null | Offer[],
  b: Offer[] | null | Offer[],
): Offer[] | null {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length === 0 && right.length === 0) return null;
  const seen = new Set<string>();
  const out: Offer[] = [];
  for (const o of [...left, ...right]) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

function rankPreferredCarriersFirst(offers: Offer[], preferred: string[]): Offer[] {
  const hit: Offer[] = [];
  const rest: Offer[] = [];
  for (const o of offers) {
    if (o.type === "flight" && airlineMatchesPreference(o.airline, preferred)) {
      hit.push(o);
    } else {
      rest.push(o);
    }
  }
  return [...hit, ...rest];
}
