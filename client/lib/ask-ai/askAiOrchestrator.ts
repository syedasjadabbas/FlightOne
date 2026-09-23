/**
 * KAYAK-style Ask AI orchestrator — NL search + live results rail + brief chat reply.
 * No Ava sales cards, WhatsApp handoff, itinerary pipeline, or Google/comps enrichment.
 */
import { collapseMetroLookalikeFlights } from "@/lib/comps/collapseMetroLookalikes";
import { convertOffersToCurrency } from "@/lib/geo/fx";
import { localeForCurrency } from "@/lib/geo/currency";
import type { TravellerLocation } from "@/lib/geo/types";
import {
  DEFAULT_ORIGIN_IATA,
  DEFAULT_ORIGIN_PLACE,
  daysFromToday,
  placeToIata,
} from "@/lib/inventory/places";
import { isFlight, type Offer } from "@/lib/inventory/types";
import { priceAll, type PricedOffer } from "@/lib/pricing/pricing";
import { rank, type ScoredOffer } from "@/lib/recommendation/recommendation";
import { complete, completeStream, type ChatTurn } from "@/lib/llm";
import { buildSearchResultsPanel, RAIL_MAX } from "@/lib/ask-ai/buildSearchPanel";
import type { SearchResultsPanel } from "@/lib/ask-ai/types";
import {
  askAiTemplateReply,
  askAiWelcome,
  buildAskAiSearchContext,
  buildAskAiSystemPrompt,
} from "@/lib/ask-ai/prompt";
import { extractTravelPlan } from "@/lib/consultant/extractTravelPlan";
import { isDemoInventoryEnabled } from "@/lib/demo/demoInventory";
import { demoTravelPlan } from "@/lib/demo/demoPlan";
import { extractIntent, looksComplexForHeuristic } from "@/lib/consultant/intent";
import {
  askAiServiceErrorReply,
  isGreetingOnly,
  llmUnavailableReply,
} from "@/lib/consultant/serviceMessages";
import type { ConsultantStreamEvent, ConsultantStreamSink } from "@/lib/consultant/streamTypes";
import {
  applyIntentFilters,
  guardPlanPassengers,
  intentFromPlan,
  preferAirlineOffers,
  preferNonstopOffers,
  type TravelPlan,
} from "@/lib/consultant/travelPlan";
import type { ConsultantRequest, ConsultantResponse, ExtractedIntent } from "@/lib/consultant/types";
import { retrieveFromPlan, retrieveSeedPackages, type RetrieveResult } from "@/lib/ask-ai/retrieve";
import { toOfferCard } from "@/lib/ask-ai/offerCard";
import {
  buildFollowUpSuggestions,
  buildMultiCityDateClarify,
  cheapestDatePatternReply,
  detectScopeConflict,
  hasExplicitSegmentDates,
  isCheapestDatePatternRequest,
  isMultiCitySearch,
  needsMultiCityDates,
} from "@/lib/ask-ai/multiCity";
import { executeMultiCitySearch } from "@/lib/ask-ai/multiCitySearch";
import type { ItinerarySummary } from "@/lib/consultant/types";

function coercePlanToUserProduct(
  plan: TravelPlan,
  message: string,
  defaultOriginIata: string,
): TravelPlan {
  if (plan.action !== "search") return plan;
  const lower = message.toLowerCase();
  const flightAsk = /\b(flight|flights|fly|airfare|ticket|tickets|non[-\s]?stop|direct)\b/.test(
    lower,
  );
  const hotelAsk = /\b(hotel|hotels|stay|stays|room|rooms|accommodation)\b/.test(lower);
  if (!flightAsk || hotelAsk) return plan;

  const flights = plan.searches.filter((s) => s.product === "FLIGHT");
  if (flights.length > 0) {
    return { ...plan, searches: flights, includePackages: undefined };
  }

  const rebuilt = plan.searches
    .filter((s) => s.product === "HOTEL")
    .map((s) => {
      const dest = s.query.cityCode.slice(0, 3).toUpperCase();
      return {
        product: "FLIGHT" as const,
        query: {
          origin: defaultOriginIata,
          destination: dest,
          departureDate: s.query.checkInDate,
          passengers: Math.min(9, Math.max(1, s.query.guests ?? 1)),
          cabinClass: "ECONOMY" as const,
        },
      };
    })
    .filter((s) => s.query.origin !== s.query.destination);

  if (rebuilt.length === 0) return plan;
  return {
    action: "search",
    searches: rebuilt,
    datesAssumed: plan.datesAssumed,
    filters: plan.filters ?? {
      ...(/(non[-\s]?stop|direct)/.test(lower) ? { nonstopOnly: true } : {}),
    },
  };
}

function softFilterOffers(
  offers: Offer[],
  filters: ExtractedIntent["filters"],
  want?: ExtractedIntent["type"],
): Offer[] {
  const scoped = want ? offers.filter((o) => o.type === want) : offers;
  const source = want ? scoped : offers;
  if (!filters || source.length === 0) return source;
  if (filters.airlinesOnly?.length) {
    const airlineOnly = applyIntentFilters(source, { airlinesOnly: filters.airlinesOnly });
    if (airlineOnly.length === 0) return [];
    const rest = applyIntentFilters(airlineOnly, { ...filters, airlinesOnly: undefined });
    return rest.length > 0 ? rest : airlineOnly;
  }
  const filtered = applyIntentFilters(source, filters);
  return filtered.length > 0 ? filtered : scoped;
}

function lockCategory(
  priced: ReturnType<typeof priceAll>,
  want?: ExtractedIntent["type"],
): ReturnType<typeof priceAll> {
  if (!want) return priced;
  return priced.filter((p) => p.offer.type === want);
}

function dedupePriced(pool: PricedOffer[]): PricedOffer[] {
  const seen = new Set<string>();
  return pool.filter((p) => {
    if (seen.has(p.offer.id)) return false;
    seen.add(p.offer.id);
    return true;
  });
}

function buildFullScoredPool(args: {
  exactSame: PricedOffer[];
  altSame: PricedOffer[];
  legs?: Offer[][];
}): ScoredOffer[] {
  if (args.legs && args.legs.length > 1) {
    const flat = args.legs.flat();
    if (flat.length === 0) return [];
    return rank(dedupePriced(priceAll(flat)));
  }
  const pool = dedupePriced([...args.exactSame, ...args.altSame]);
  return pool.length > 0 ? rank(pool) : [];
}

function prepareLegOffers(
  leg: Offer[],
  filters: ExtractedIntent["filters"],
  want: ExtractedIntent["type"],
  intent: ExtractedIntent,
  displayCurrency: string,
): Offer[] {
  const filtered = softFilterOffers(leg, filters, want);
  const flight = filtered.find(isFlight);
  const destHint = flight?.destinationCode || placeToIata(intent.destination) || undefined;
  const originHint = flight?.originCode || placeToIata(intent.origin) || undefined;
  return preferNonstopOffers(
    preferAirlineOffers(
      convertOffersToCurrency(
        collapseMetroLookalikeFlights(filtered, destHint, originHint),
        displayCurrency,
      ),
      filters?.preferredAirlines,
    ),
  );
}

function processRetrieved(
  retrieved: RetrieveResult,
  intent: ExtractedIntent,
  location: TravellerLocation | null,
): { fullScored: ScoredOffer[]; liveFlights: boolean; liveHotels: boolean } {
  const displayCurrency = (location?.currency || "PKR").toUpperCase();
  const want = intent.type;
  const filters = intent.filters;

  const exactRaw = softFilterOffers(retrieved.exact, filters, want);
  const altRaw = softFilterOffers(retrieved.alternatives, filters, want);

  const exact = preferNonstopOffers(
    preferAirlineOffers(
      convertOffersToCurrency(
        collapseMetroLookalikeFlights(
          exactRaw,
          placeToIata(intent.destination) || undefined,
          placeToIata(intent.origin) || undefined,
        ),
        displayCurrency,
      ),
      filters?.preferredAirlines,
    ),
  );
  const alternatives = preferNonstopOffers(
    preferAirlineOffers(
      convertOffersToCurrency(
        collapseMetroLookalikeFlights(
          altRaw,
          placeToIata(intent.destination) || undefined,
          placeToIata(intent.origin) || undefined,
        ),
        displayCurrency,
      ),
      filters?.preferredAirlines,
    ),
  );

  const legs = retrieved.legs?.map((leg) =>
    prepareLegOffers(leg, filters, want, intent, displayCurrency),
  );

  const exactSame = lockCategory(priceAll(exact), want);
  const altSame = lockCategory(priceAll(alternatives), want);
  const fullScored = buildFullScoredPool({ exactSame, altSame, legs });

  return {
    fullScored,
    liveFlights: retrieved.liveFlights,
    liveHotels: retrieved.liveHotels,
  };
}

async function streamOrCompleteReply(
  req: {
    system: string;
    messages: ChatTurn[];
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  },
  onToken?: (delta: string) => void,
): Promise<{ text: string; provider: string } | null> {
  if (!onToken) return complete(req);

  let full = "";
  const gen = completeStream(req);
  try {
    while (true) {
      const next = await gen.next();
      if (next.done) {
        const result = next.value;
        if (result?.text) return result;
        if (full.trim()) return { text: full.trim(), provider: result?.provider ?? "stream" };
        return null;
      }
      full += next.value;
      onToken(next.value);
    }
  } catch {
    if (full.trim()) return { text: full.trim(), provider: "stream" };
    return complete(req);
  }
}

async function replyAskAi(
  req: ConsultantRequest,
  args: {
    intent: ExtractedIntent;
    fullScored: ScoredOffer[];
    liveFlights: boolean;
    liveHotels: boolean;
    moneyLocale: string;
    location: TravellerLocation | null;
    originPlace: string;
    querySource: "llm" | "heuristic";
    fixedReply?: string;
    sink?: ConsultantStreamSink;
    itineraries?: ItinerarySummary[];
    panelExtras?: Partial<SearchResultsPanel>;
    followUpSuggestions?: string[];
    /** UI/persistence shim — does not change reply generation. */
    travelPlan?: TravelPlan | null;
  },
): Promise<ConsultantResponse> {
  const panelOffers =
    args.panelExtras?.originVariants?.[0]?.offers?.length &&
    args.panelExtras.originVariants[0].offers.length > 0
      ? args.panelExtras.originVariants[0].offers
      : args.fullScored.slice(0, RAIL_MAX).map((s) => toOfferCard(s, args.moneyLocale));

  const totalCount =
    args.panelExtras?.originVariants?.[0]?.totalCount ?? args.fullScored.length;

  const followUpSuggestions =
    args.followUpSuggestions ??
    buildFollowUpSuggestions({
      multiCity: Boolean(args.panelExtras?.multiCity),
      hasResults: panelOffers.length > 0,
      dualOrigin: Boolean(args.panelExtras?.originVariants?.length),
      emptyAll: panelOffers.length === 0 && Boolean(args.panelExtras?.multiCity),
    });

  const searchPanel: SearchResultsPanel = buildSearchResultsPanel({
    offers: panelOffers,
    intent: args.intent,
    itineraries: args.itineraries,
    liveFlights: args.liveFlights,
    liveHotels: args.liveHotels,
    originPlace: args.originPlace,
    totalCount: totalCount,
    extras: {
      ...args.panelExtras,
      followUpSuggestions,
    },
  });

  const metaBase: ConsultantResponse["meta"] = {
    provider: "template",
    grounded: panelOffers.length > 0,
    liveFlights: args.liveFlights,
    liveHotels: args.liveHotels,
    originPlace: args.originPlace,
    locationSource: args.location?.source,
    querySource: args.querySource,
    ...(args.travelPlan !== undefined ? { travelPlan: args.travelPlan } : {}),
  };

  args.sink?.onSearchResults?.({
    panel: searchPanel,
    intent: args.intent,
    meta: metaBase,
  });

  args.sink?.onStatus?.("reply");

  let reply = args.fixedReply ?? "";
  let provider = "template";

  if (!reply) {
    const context = buildAskAiSearchContext(
      panelOffers,
      args.intent,
      args.moneyLocale,
      args.itineraries,
    );
    const system = `${buildAskAiSystemPrompt(args.location)}\n\n${context}`;
    const messages: ChatTurn[] = [...req.history, { role: "user", content: req.message }];

    // Demo mode is self-contained: skip the narration call entirely rather
    // than paying an HTTP round-trip to Express that can only fail, and fall
    // straight through to the deterministic template reply below.
    const llmResult = isDemoInventoryEnabled()
      ? null
      : await streamOrCompleteReply(
          { system, messages, temperature: 0.6, maxTokens: 280, timeoutMs: 120000 },
          args.sink?.onToken,
        );

    reply = llmResult?.text?.trim() ?? "";
    provider = llmResult?.provider ?? "template";

    if (!reply) {
      reply = askAiTemplateReply(
        panelOffers,
        args.intent,
        args.moneyLocale,
        args.originPlace,
        args.itineraries,
      );
      args.sink?.onToken?.(reply);
    }
  } else {
    args.sink?.onToken?.(reply);
  }

  const meta = { ...metaBase, provider };

  return {
    reply,
    offers: [],
    intent: args.intent,
    searchPanel,
    meta,
  };
}

function emitAskAi(result: ConsultantResponse, sink?: ConsultantStreamSink) {
  if (result.reply) sink?.onToken?.(result.reply);
  if (result.searchPanel) {
    sink?.onSearchResults?.({
      panel: result.searchPanel,
      intent: result.intent,
      meta: result.meta,
    });
  }
}

export async function runAskAi(
  req: ConsultantRequest,
  sink?: ConsultantStreamSink,
): Promise<ConsultantResponse> {
  const location = req.location ?? null;
  const originPlace = location?.place || location?.city || DEFAULT_ORIGIN_PLACE;
  const moneyLocale = localeForCurrency(location?.currency || "PKR");
  const defaultOriginIata = placeToIata(originPlace) || DEFAULT_ORIGIN_IATA;
  const today = daysFromToday(0);
  const baseLoc = { originPlace, locationSource: location?.source };

  if (isGreetingOnly(req.message)) {
    const result: ConsultantResponse = {
      reply: askAiWelcome(originPlace),
      offers: [],
      intent: { offTopic: false },
      meta: { provider: "rules", grounded: false, querySource: "heuristic", ...baseLoc },
    };
    emitAskAi(result, sink);
    return result;
  }

  sink?.onStatus?.("extract");
  // Demo mode must never depend on an LLM: multi-city is the only shape the
  // heuristic extractor refuses, so with LLM_PROVIDER=off every multi-leg ask
  // returned "trip planning AI is temporarily unreachable". Parse it straight
  // from the corpus first; null falls through to the normal pipeline.
  const demoPlan = isDemoInventoryEnabled() ? demoTravelPlan(req.message) : null;
  const planRaw =
    demoPlan ??
    (await extractTravelPlan(req.message, req.history, {
      today,
      defaultOriginIata,
      defaultOriginPlace: originPlace,
      location,
      previousTravelPlan: req.previousTravelPlan ?? null,
    }));

  const plan = planRaw?.action === "close" ? null : planRaw;

  sink?.onStatus?.("search");

  if (!plan) {
    const complex = looksComplexForHeuristic(req.message);
    return replyAskAi(req, {
      intent: extractIntent(req.message, req.history, { defaultOrigin: originPlace }),
      fullScored: [],
      liveFlights: false,
      liveHotels: false,
      moneyLocale,
      location,
      originPlace,
      querySource: "heuristic",
      fixedReply: llmUnavailableReply({ complex }),
      travelPlan: plan,
      sink,
    });
  }

  const intent = intentFromPlan(plan);

  if (plan.action === "clarify") {
    const dateClarify =
      plan.missing.some((m) => /date/i.test(m)) ||
      /segment|multi[- ]city|each leg/i.test(plan.ask);
    const suggestions = dateClarify
      ? [
          "Early October dates",
          "Flexible ±3 day windows",
          "Search from Lahore only",
        ]
      : buildFollowUpSuggestions({ multiCity: false, hasResults: false, dualOrigin: false });

    return replyAskAi(req, {
      intent,
      fullScored: [],
      liveFlights: false,
      liveHotels: false,
      moneyLocale,
      location,
      originPlace,
      querySource: "llm",
      fixedReply: plan.ask,
      followUpSuggestions: suggestions,
      travelPlan: plan,
      sink,
    });
  }

  if (plan.action === "off_topic") {
    return replyAskAi(req, {
      intent: { ...intent, offTopic: true },
      fullScored: [],
      liveFlights: false,
      liveHotels: false,
      moneyLocale,
      location,
      originPlace,
      querySource: "llm",
      fixedReply:
        "I search flights, hotels, and trip packages. Name a destination or trip style and I'll load live options in the panel.",
      travelPlan: plan,
      sink,
    });
  }

  if (plan.action === "package") {
    const retrieved = await retrieveSeedPackages(intent, location);
    const { fullScored, liveFlights, liveHotels } = processRetrieved(retrieved, intent, location);
    return replyAskAi(req, {
      intent,
      fullScored,
      liveFlights,
      liveHotels,
      moneyLocale,
      location,
      originPlace,
      querySource: "llm",
      travelPlan: plan,
      sink,
    });
  }

  if (plan.action === "search") {
    const coerced = coercePlanToUserProduct(plan, req.message, defaultOriginIata);
    const guarded = guardPlanPassengers(coerced, req.message, req.history);
    if (guarded.action !== "search") {
      return replyAskAi(req, {
        intent: intentFromPlan(guarded),
        fullScored: [],
        liveFlights: false,
        liveHotels: false,
        moneyLocale,
        location,
        originPlace,
        querySource: "llm",
        fixedReply: "I need a bit more detail — where are you going and when?",
        travelPlan: guarded,
        sink,
      });
    }

    const scopeClarify = detectScopeConflict(req.message, guarded.filters);
    if (scopeClarify) {
      return replyAskAi(req, {
        intent: intentFromPlan(guarded),
        fullScored: [],
        liveFlights: false,
        liveHotels: false,
        moneyLocale,
        location,
        originPlace,
        querySource: "llm",
        fixedReply: scopeClarify.ask,
        followUpSuggestions: scopeClarify.suggestions,
        travelPlan: guarded,
        sink,
      });
    }

    if (isCheapestDatePatternRequest(req.message)) {
      const refusal = cheapestDatePatternReply();
      return replyAskAi(req, {
        intent: intentFromPlan(guarded),
        fullScored: [],
        liveFlights: false,
        liveHotels: false,
        moneyLocale,
        location,
        originPlace,
        querySource: "llm",
        fixedReply: refusal.ask,
        followUpSuggestions: refusal.suggestions,
        travelPlan: guarded,
        sink,
      });
    }

    if (
      isMultiCitySearch(guarded) &&
      needsMultiCityDates(guarded) &&
      !hasExplicitSegmentDates(req.message)
    ) {
      const dateAsk = buildMultiCityDateClarify(guarded, originPlace);
      return replyAskAi(req, {
        intent: intentFromPlan(guarded),
        fullScored: [],
        liveFlights: false,
        liveHotels: false,
        moneyLocale,
        location,
        originPlace,
        querySource: "llm",
        fixedReply: dateAsk.ask,
        followUpSuggestions: dateAsk.suggestions,
        panelExtras: {
          multiCity: true,
          legRoute: undefined,
        },
        travelPlan: guarded,
        sink,
      });
    }

    const searchIntent = intentFromPlan(guarded);

    if (isMultiCitySearch(guarded)) {
      const displayCurrency = (location?.currency || "PKR").toUpperCase();
      const multi = await executeMultiCitySearch({
        plan: guarded,
        intent: searchIntent,
        location,
        message: req.message,
        moneyLocale,
        prepareLegOffers: (offers) =>
          prepareLegOffers(
            offers,
            searchIntent.filters,
            searchIntent.type,
            searchIntent,
            displayCurrency,
          ),
        processRetrieved,
      });
      return replyAskAi(req, {
        intent: searchIntent,
        fullScored: multi.fullScored,
        liveFlights: multi.liveFlights,
        liveHotels: multi.liveHotels,
        moneyLocale,
        location,
        originPlace,
        querySource: "llm",
        itineraries: multi.itineraries,
        panelExtras: multi.panelExtras,
        fixedReply: multi.partialReply ?? multi.emptyReply,
        travelPlan: guarded,
        sink,
      });
    }

    const retrieved = await retrieveFromPlan(guarded, searchIntent, location);
    const { fullScored, liveFlights, liveHotels } = processRetrieved(
      retrieved,
      searchIntent,
      location,
    );
    return replyAskAi(req, {
      intent: searchIntent,
      fullScored,
      liveFlights,
      liveHotels,
      moneyLocale,
      location,
      originPlace,
      querySource: "llm",
      travelPlan: guarded,
      sink,
    });
  }

  return replyAskAi(req, {
    intent,
    fullScored: [],
    liveFlights: false,
    liveHotels: false,
    moneyLocale,
    location,
    originPlace,
    querySource: "heuristic",
    fixedReply: askAiWelcome(originPlace),
    travelPlan: plan,
    sink,
  });
}

export async function* runAskAiStream(
  req: ConsultantRequest,
): AsyncGenerator<ConsultantStreamEvent> {
  const queue: ConsultantStreamEvent[] = [];
  const waiters: Array<() => void> = [];
  let finished = false;

  const wake = () => {
    while (waiters.length > 0) waiters.shift()?.();
  };

  const push = (ev: ConsultantStreamEvent) => {
    queue.push(ev);
    wake();
  };

  const work = (async () => {
    try {
      push({ type: "status", phase: "extract" });
      const result = await runAskAi(req, {
        onStatus: (phase) => push({ type: "status", phase }),
        onSearchResults: (payload) => push({ type: "searchResults", ...payload }),
        onToken: (delta) => push({ type: "token", delta }),
      });
      push({ type: "status", phase: "done" });
      push({ type: "done", result });
    } catch (err) {
      console.error("[ask-ai-stream]", err);
      push({ type: "error", message: askAiServiceErrorReply() });
    } finally {
      finished = true;
      wake();
    }
  })();

  while (!finished || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => waiters.push(resolve));
      continue;
    }
    const next = queue.shift();
    if (next) yield next;
  }

  await work;
}
