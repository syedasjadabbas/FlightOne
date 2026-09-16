import type { TravellerLocation } from "@/lib/geo/types";
import { fromConsultantPlan } from "@/lib/travel-planner/adapter";
import {
  buildOpenJawRecoveryPlan,
  mergeRecoveryBuckets,
  planningPlanForOpenJawRecovery,
  shouldReshapeOpenJaw,
  type OpenJawRecoveryResult,
  type RecoverySearchStage,
} from "@/lib/travel-planner/openJawRecovery";
import {
  offersFromItineraries,
  runItineraryPipeline,
} from "@/lib/travel-planner/orchestrator";
import type { ScoredOffer } from "@/lib/recommendation/recommendation";
import { rank } from "@/lib/recommendation/recommendation";
import { priceAll } from "@/lib/pricing/pricing";
import { isFlight, type Offer } from "@/lib/inventory/types";
import type { ExtractedIntent, ItinerarySummary } from "@/lib/consultant/types";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import { bucketsForGdsPipeline } from "@/lib/comps/webLegFallback";
import { retrieveFromPlan, type RetrieveResult } from "./retrieve";
import { toOfferCard } from "./offerCard";
import { toItinerarySummaries } from "./itinerarySummaries";
import {
  buildDateSpan,
  buildLegGdsDiagnostics,
  buildLegRoute,
  buildMultiCityEmptyReply,
  buildMultiCityParams,
  buildTripTitle,
  clonePlanWithOrigin,
  dualOriginTargets,
  isMultiCitySearch,
  originLabel,
  type SearchPlan,
} from "./multiCity";
import type { LegSearchPanel, OriginVariantPanel, SearchResultsPanel } from "./types";
import { RAIL_MAX } from "./buildSearchPanel";

const STAGE_LABEL: Record<RecoverySearchStage, string> = {
  to_stopover: "Outbound to stopover",
  to_main: "Stopover to main destination",
  positioning: "Positioning flight",
  via_main_direct: "Direct to main destination",
  return: "Return home",
};

function routesForStage(recovery: OpenJawRecoveryResult, stage: RecoverySearchStage): string {
  const routes: string[] = [];
  for (let i = 0; i < recovery.searchStages.length; i++) {
    if (recovery.searchStages[i] !== stage) continue;
    const leg = recovery.plan.searches[i];
    if (leg.product !== "FLIGHT") continue;
    routes.push(`${leg.query.origin} → ${leg.query.destination}`);
  }
  return [...new Set(routes)].join(" / ");
}

function stageOrder(recovery: OpenJawRecoveryResult): RecoverySearchStage[] {
  const hasPos = recovery.searchStages.includes("positioning");
  return hasPos
    ? ["to_stopover", "to_main", "positioning", "return"]
    : ["to_stopover", "to_main", "return"];
}

function bucketWasLive(
  recovery: OpenJawRecoveryResult,
  retrieved: RetrieveResult,
  stage: RecoverySearchStage,
): boolean {
  for (let i = 0; i < recovery.searchStages.length; i++) {
    if (recovery.searchStages[i] !== stage) continue;
    if (retrieved.legLive?.[i]) return true;
  }
  return false;
}

function bucketWasWeb(
  recovery: OpenJawRecoveryResult,
  retrieved: RetrieveResult,
  stage: RecoverySearchStage,
): boolean {
  for (let i = 0; i < recovery.searchStages.length; i++) {
    if (recovery.searchStages[i] !== stage) continue;
    if (retrieved.legWeb?.[i]) return true;
  }
  return false;
}

function journeyBuckets(
  retrieved: RetrieveResult,
  plan: SearchPlan,
  recovery: OpenJawRecoveryResult | null,
): Offer[][] {
  if (recovery && retrieved.legs) {
    return mergeRecoveryBuckets(
      recovery.plan.searches,
      retrieved.legs,
      recovery.searchStages,
    );
  }
  const out: Offer[][] = [];
  for (let i = 0; i < plan.searches.length; i++) {
    if (plan.searches[i].product !== "FLIGHT") continue;
    out.push(retrieved.legs?.[i] ?? []);
  }
  return out;
}

function buildLegPanels(args: {
  retrieved: RetrieveResult;
  plan: SearchPlan;
  recovery: OpenJawRecoveryResult | null;
  moneyLocale: string;
  prepareOffers: (offers: Offer[]) => Offer[];
}): LegSearchPanel[] {
  const { retrieved, plan, recovery, moneyLocale, prepareOffers } = args;
  if (!retrieved.legs?.length) return [];

  const buckets = journeyBuckets(retrieved, plan, recovery);
  const metas: { route: string; stageLabel?: string; live: boolean; web: boolean }[] = [];

  if (recovery) {
    const order = stageOrder(recovery);
    for (let i = 0; i < buckets.length; i++) {
      const stage = order[i] ?? "to_main";
      metas.push({
        route: routesForStage(recovery, stage),
        stageLabel: STAGE_LABEL[stage],
        live: bucketWasLive(recovery, retrieved, stage),
        web: bucketWasWeb(recovery, retrieved, stage),
      });
    }
  } else {
    for (let i = 0; i < plan.searches.length; i++) {
      const leg = plan.searches[i];
      if (leg.product !== "FLIGHT") continue;
      metas.push({
        route: `${leg.query.origin} → ${leg.query.destination}`,
        live: retrieved.legLive?.[i] ?? false,
        web: retrieved.legWeb?.[i] ?? false,
      });
    }
  }

  return buckets.map((bucket, i) => {
    const prepared = prepareOffers(bucket.filter(isFlight));
    const scored = rank(priceAll(prepared));
    const offers = scored.slice(0, 12).map((s) => toOfferCard(s, moneyLocale));
    const meta = metas[i];
    const route =
      meta?.route ||
      (() => {
        const f = bucket.find(isFlight);
        return f ? `${f.originCode} → ${f.destinationCode}` : `Leg ${i + 1}`;
      })();
    const live = meta?.live ?? bucket.some((o) => isFlight(o) && o.tags.includes("live"));
    const web =
      meta?.web ?? bucket.some((o) => isFlight(o) && o.tags.includes("web-meta"));

    return {
      legRoute: route,
      stageLabel: meta?.stageLabel,
      offers,
      totalCount: prepared.length,
      live,
      web,
      emptyMessage:
        prepared.length === 0 ? `No GDS fares for ${route} on these dates` : undefined,
    };
  });
}

function dedupeScored(scored: ScoredOffer[]): ScoredOffer[] {
  const seen = new Set<string>();
  const out: ScoredOffer[] = [];
  for (const s of scored.sort((a, b) => b.score - a.score)) {
    if (seen.has(s.priced.offer.id)) continue;
    seen.add(s.priced.offer.id);
    out.push(s);
  }
  return out;
}

export interface MultiCityExecuteResult {
  fullScored: ScoredOffer[];
  itineraries: ItinerarySummary[];
  liveFlights: boolean;
  liveHotels: boolean;
  panelExtras: Partial<SearchResultsPanel>;
  emptyReply?: string;
  partialReply?: string;
}

function tryOpenJawRecovery(
  plan: SearchPlan,
  message: string,
): OpenJawRecoveryResult | null {
  const planning = fromConsultantPlan(plan, message);
  if (!shouldReshapeOpenJaw(plan, planning)) return null;
  return buildOpenJawRecoveryPlan(plan, planning, message);
}

/** Human journey line — not the fan-out search list. */
function recoveryLegRoute(recovery: OpenJawRecoveryResult): string {
  const stop = recovery.stopoverAirports[0] || "LON";
  const originBit =
    recovery.plan.searches
      .filter((s, i) => recovery.searchStages[i] === "to_stopover" && s.product === "FLIGHT")
      .map((s) => (s.product === "FLIGHT" ? s.query.origin : ""))
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join("/") || "LHE";
  const positioningBit = recovery.positioningRoute ? ` → ${recovery.positioningRoute.replace("→", " → ")}` : "";
  return `${originBit} → ${stop} → ${recovery.mainDest}${positioningBit} · return ${recovery.returnOrigin} → ${recovery.home}`;
}

function processRetrievedLegs(
  retrieved: RetrieveResult,
  intent: ExtractedIntent,
  location: TravellerLocation | null,
  message: string,
  plan: SearchPlan,
  moneyLocale: string,
  recovery: OpenJawRecoveryResult | null,
): {
  fullScored: ScoredOffer[];
  itineraries: ItinerarySummary[];
} {
  const rawLegs = retrieved.legs;
  if (!rawLegs || rawLegs.length < 2) {
    return { fullScored: [], itineraries: [] };
  }

  let legs = rawLegs;
  let planning = fromConsultantPlan(plan, message);

  if (recovery) {
    legs = mergeRecoveryBuckets(recovery.plan.searches, rawLegs, recovery.searchStages);
    planning = planningPlanForOpenJawRecovery(recovery, message, planning);
  } else if (!isMultiCitySearch(plan) || !planning) {
    return { fullScored: [], itineraries: [] };
  }

  if (!planning || legs.length < 2) {
    return { fullScored: [], itineraries: [] };
  }

  const pipeline = runItineraryPipeline(planning, bucketsForGdsPipeline(legs));
  const itinerarySummaries = toItinerarySummaries(pipeline.itineraries, moneyLocale);
  const fromItins = offersFromItineraries(pipeline.itineraries, RAIL_MAX);
  if (fromItins.length > 0) {
    return { fullScored: rank(fromItins), itineraries: itinerarySummaries };
  }

  return { fullScored: [], itineraries: itinerarySummaries };
}

async function executeSinglePlan(args: {
  plan: SearchPlan;
  intent: ExtractedIntent;
  location: TravellerLocation | null;
  message: string;
  moneyLocale: string;
  recovery: OpenJawRecoveryResult | null;
  prepareLegOffers: (offers: Offer[]) => Offer[];
  processRetrieved: (
    retrieved: RetrieveResult,
    intent: ExtractedIntent,
    location: TravellerLocation | null,
  ) => {
    fullScored: ScoredOffer[];
    liveFlights: boolean;
    liveHotels: boolean;
    curated?: ScoredOffer[];
    searchNote?: string;
  };
}): Promise<{
  fullScored: ScoredOffer[];
  itineraries: ItinerarySummary[];
  liveFlights: boolean;
  liveHotels: boolean;
  offers: ReturnType<typeof toOfferCard>[];
  totalCount: number;
  legPanels: LegSearchPanel[];
  partialReply?: string;
}> {
  const retrieved = await retrieveFromPlan(args.plan, args.intent, args.location);
  const processed = args.processRetrieved(retrieved, args.intent, args.location);
  const piped = processRetrievedLegs(
    retrieved,
    args.intent,
    args.location,
    args.message,
    args.plan,
    args.moneyLocale,
    args.recovery,
  );

  const legPanels = buildLegPanels({
    retrieved,
    plan: args.plan,
    recovery: args.recovery,
    moneyLocale: args.moneyLocale,
    prepareOffers: args.prepareLegOffers,
  });

  let fullScored = piped.fullScored.length > 0 ? piped.fullScored : processed.fullScored;

  if (fullScored.length === 0) {
    const flatPrepared = journeyBuckets(retrieved, args.plan, args.recovery).flatMap((b) =>
      args.prepareLegOffers(b.filter(isFlight)),
    );
    if (flatPrepared.length > 0) {
      fullScored = rank(priceAll(flatPrepared));
    }
  }

  const partialReply =
    piped.itineraries.length === 0 && legPanels.length > 0
      ? buildLegGdsDiagnostics(legPanels)
      : undefined;

  const panelOffers = fullScored.slice(0, RAIL_MAX).map((s) => toOfferCard(s, args.moneyLocale));

  return {
    fullScored,
    itineraries: piped.itineraries,
    liveFlights: processed.liveFlights,
    liveHotels: processed.liveHotels,
    offers: panelOffers,
    totalCount: fullScored.length,
    legPanels,
    partialReply,
  };
}

export async function executeMultiCitySearch(args: {
  plan: SearchPlan;
  intent: ExtractedIntent;
  location: TravellerLocation | null;
  message: string;
  moneyLocale: string;
  prepareLegOffers: (offers: Offer[]) => Offer[];
  processRetrieved: (
    retrieved: RetrieveResult,
    intent: ExtractedIntent,
    location: TravellerLocation | null,
  ) => {
    fullScored: ScoredOffer[];
    liveFlights: boolean;
    liveHotels: boolean;
    curated?: ScoredOffer[];
    searchNote?: string;
  };
}): Promise<MultiCityExecuteResult> {
  const recovery = tryOpenJawRecovery(args.plan, args.message);
  const searchPlan = recovery?.plan ?? args.plan;
  const multiCity = isMultiCitySearch(searchPlan) || Boolean(recovery);

  // Recovery already fans out LHE/ISB as parallel to_stopover searches — cloning
  // again rewrites searches[0] (often the return leg) into same-airport junk.
  const recoveryHasDualPkOrigin =
    Boolean(recovery) &&
    recovery!.searchStages.filter((s) => s === "to_stopover").length >= 2;
  const origins = recoveryHasDualPkOrigin ? null : dualOriginTargets(args.message);

  const panelExtras: Partial<SearchResultsPanel> = {
    multiCity,
    tripTitle: buildTripTitle(searchPlan, args.message),
    dateSpan: buildDateSpan(args.plan),
    legRoute: recovery ? recoveryLegRoute(recovery) : buildLegRoute(searchPlan),
    queryLabel: buildMultiCityParams(args.plan, args.intent.passengers),
  };

  if (origins && multiCity && !recovery) {
    const variants: OriginVariantPanel[] = [];
    let combinedItins: ItinerarySummary[] = [];
    let liveFlights = false;
    let liveHotels = false;
    const allScored: ScoredOffer[] = [];
    for (const originIata of origins) {
      const variantPlan = clonePlanWithOrigin(searchPlan, originIata);
      const result = await executeSinglePlan({
        ...args,
        plan: variantPlan,
        recovery: null,
      });
      liveFlights = liveFlights || result.liveFlights;
      liveHotels = liveHotels || result.liveHotels;
      allScored.push(...result.fullScored);
      combinedItins = [...combinedItins, ...result.itineraries];

      variants.push({
        originIata,
        originLabel: originLabel(originIata),
        legRoute: buildLegRoute(variantPlan, originIata),
        offers: result.offers,
        totalCount: result.totalCount,
        emptyMessage:
          result.totalCount === 0
            ? `No fares on these dates for ${originLabel(originIata)}.`
            : undefined,
      });
    }

    const deduped = dedupeScored(allScored).slice(0, RAIL_MAX);
    const primary = variants[0];
    const allEmpty = variants.every((v) => v.totalCount === 0);
    panelExtras.originVariants = variants;
    panelExtras.legRoute = primary?.legRoute;
    panelExtras.queryLabel = buildMultiCityParams(searchPlan, args.intent.passengers);

    return {
      fullScored: deduped,
      itineraries: combinedItins.slice(0, 6),
      liveFlights,
      liveHotels,
      panelExtras,
      emptyReply: allEmpty
        ? buildMultiCityEmptyReply(
            variants.map((v) => ({ legRoute: v.legRoute, originLabel: v.originLabel })),
          )
        : undefined,
    };
  }

  const result = await executeSinglePlan({
    ...args,
    plan: searchPlan,
    recovery,
  });
  const allEmpty = result.totalCount === 0;
  panelExtras.legPanels = result.legPanels.length > 0 ? result.legPanels : undefined;

  return {
    fullScored: result.fullScored,
    itineraries: result.itineraries,
    liveFlights: result.liveFlights,
    liveHotels: result.liveHotels,
    panelExtras,
    partialReply: result.partialReply,
    emptyReply:
      allEmpty && multiCity
        ? buildMultiCityEmptyReply([
            {
              legRoute: panelExtras.legRoute || buildLegRoute(searchPlan),
              originLabel: originLabel(
                searchPlan.searches.find((s) => s.product === "FLIGHT")?.query.origin ??
                  "LHE",
              ),
            },
          ])
        : undefined,
  };
}

/** Type guard for search plans passed into multi-city execution. */
export function asSearchPlan(plan: TravelPlan): SearchPlan | null {
  return plan.action === "search" ? plan : null;
}
