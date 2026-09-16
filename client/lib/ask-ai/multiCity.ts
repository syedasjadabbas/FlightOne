import { iataToPlace } from "@/lib/inventory/places";
import type { IntentFilters } from "@/lib/consultant/types";
import type { TravelPlan } from "@/lib/consultant/travelPlan";

export const PK_COMPARE_ORIGINS = ["LHE", "ISB"] as const;

export type SearchPlan = Extract<TravelPlan, { action: "search" }>;

export function flightLegCount(plan: SearchPlan): number {
  return plan.searches.filter((s) => s.product === "FLIGHT").length;
}

export function isMultiCitySearch(plan: SearchPlan): boolean {
  return flightLegCount(plan) >= 3;
}

export function mentionsLheIsbCompare(message: string): boolean {
  const m = message.toLowerCase();
  const mentionsLhe = /\b(lhe|lahore)\b/.test(m);
  const mentionsIsb = /\b(isb|islamabad)\b/.test(m);
  const compareIntent = /\b(compare|versus|vs\.?|both|either)\b/.test(m);
  return (
    (mentionsLhe && mentionsIsb) ||
    (compareIntent && mentionsLhe && mentionsIsb) ||
    (compareIntent && /\b(pakistan|origin)\b/.test(m) && (mentionsLhe || mentionsIsb))
  );
}

export function mentionsAirlineCompare(message: string, filters?: IntentFilters): boolean {
  const m = message.toLowerCase();
  const airlineNamed =
    /\b(emirates|turkish|qatar|etihad|pia)\b.*\b(vs|versus|alternatives?|compare|cheapest|other)\b/.test(
      m,
    ) ||
    /\b(compare|versus|vs\.?)\b.*\b(emirates|turkish|qatar|etihad|pia)\b/.test(m);
  const filterAirline =
    Boolean(filters?.preferredAirlines?.length || filters?.airlinesOnly?.length) &&
    /\b(compare|versus|vs\.?|alternatives?)\b/.test(m);
  return airlineNamed || filterAirline;
}

/** KAYAK-style forced choice when origin and airline comparisons collide. */
export function detectScopeConflict(
  message: string,
  filters?: IntentFilters,
): { ask: string; suggestions: string[] } | null {
  const m = message.toLowerCase();
  const wantsOrigin =
    mentionsLheIsbCompare(message) ||
    (/\b(compare|versus|vs\.?)\b/.test(m) && /\b(isb|islamabad|lhe|lahore)\b/.test(m));
  const wantsAirline = mentionsAirlineCompare(message, filters);

  if (!wantsOrigin || !wantsAirline) {
    return null;
  }
  return {
    ask:
      "That's a lot to compare at once. Would you like to start with Lahore vs Islamabad as your origin, " +
      "or compare your preferred airline against other carriers first?",
    suggestions: [
      "Compare Lahore vs Islamabad first",
      "Compare Emirates vs other airlines first",
      "Search from Lahore with Emirates preference",
    ],
  };
}

export function isCheapestDatePatternRequest(message: string): boolean {
  return (
    /\b(cheapest|best)\s+date\s+pattern\b/i.test(message) ||
    /\bfind\s+the\s+cheapest\s+date\b/i.test(message) ||
    /\bcheapest\s+dates?\s+for\s+(each|every)\s+segment\b/i.test(message)
  );
}

export function cheapestDatePatternReply(): { ask: string; suggestions: string[] } {
  return {
    ask:
      "I can't infer the cheapest date pattern without explicit windows. " +
      "Share departure dates (or ±3 day flexibility) for each segment and I'll search live inventory.",
    suggestions: [
      "Use exact travel dates",
      "Use flexible ±3 day windows",
      "Early October from Lahore",
    ],
  };
}

export function hasExplicitSegmentDates(message: string): boolean {
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(message) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(message) ||
    /segment\s+\d/i.test(message) ||
    /\boct\s+\d{1,2}\b/i.test(message)
  );
}

export function needsMultiCityDates(plan: SearchPlan): boolean {
  if (!isMultiCitySearch(plan)) return false;
  // Search when every flight has a date — including LLM-assumed dates from stay
  // nights (e.g. "2 nights London, 15 days SFO"). Only block when a leg is blank.
  return plan.searches.some(
    (s) => s.product === "FLIGHT" && !s.query.departureDate,
  );
}

export function buildMultiCityDateClarify(
  plan: SearchPlan,
  originPlace: string,
): { ask: string; suggestions: string[] } {
  const flights = plan.searches.filter((s) => s.product === "FLIGHT");
  const lines = flights.map((f, i) => {
    const q = f.query;
    const window = q.departureDate ? ` (${q.departureDate}, ±3 days)` : " — date needed (±3 days ok)";
    return `Segment ${i + 1}: ${q.origin} → ${q.destination}${window}`;
  });
  return {
    ask:
      `To search this multi-city trip from ${originPlace}, I need a departure date for each segment:\n` +
      `${lines.join("\n")}\n` +
      `Share exact dates or flexible windows and I'll load live fares in the panel.`,
    suggestions: [
      "Early October dates",
      "Use flexible ±3 day windows",
      "Search from Lahore only first",
    ],
  };
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function buildDateSpan(plan: SearchPlan): string | undefined {
  const dates = plan.searches
    .filter((s) => s.product === "FLIGHT")
    .map((s) => s.query.departureDate)
    .filter((d): d is string => Boolean(d));
  if (dates.length === 0) return undefined;
  const sorted = [...dates].sort();
  if (sorted.length === 1) return formatShortDate(sorted[0]);
  return `${formatShortDate(sorted[0])} – ${formatShortDate(sorted[sorted.length - 1])}`;
}

export function buildLegRoute(plan: SearchPlan, originOverride?: string): string {
  const flights = plan.searches.filter((s) => s.product === "FLIGHT");
  if (flights.length === 0) return "";
  const chain: string[] = [originOverride ?? flights[0].query.origin];
  for (const f of flights) {
    chain.push(f.query.destination);
  }
  return chain.join(" → ");
}

export function buildTripTitle(plan: SearchPlan, message: string): string {
  if (mentionsLheIsbCompare(message)) return "Multi-City Fare Compare";
  if (isMultiCitySearch(plan)) return "Multi-City Trip";
  return "Trip Search";
}

export function buildMultiCityParams(plan: SearchPlan, passengers?: number): string {
  const dates = plan.searches
    .filter((s) => s.product === "FLIGHT")
    .map((s) => formatShortDate(s.query.departureDate))
    .join(", ");
  const pax = passengers ?? plan.searches.find((s) => s.product === "FLIGHT")?.query.passengers ?? 1;
  const paxLabel = pax === 1 ? "1 adult" : `${pax} travellers`;
  return dates ? `Multi-city · ${dates} · ${paxLabel}` : `Multi-city · ${paxLabel}`;
}

export function clonePlanWithOrigin(plan: SearchPlan, originIata: string): SearchPlan {
  const flights = plan.searches.filter((s) => s.product === "FLIGHT");
  if (flights.length === 0) return plan;
  const first = flights[0];
  const last = flights[flights.length - 1];

  const searches = plan.searches.map((leg) => {
    if (leg.product !== "FLIGHT") return leg;
    const query = { ...leg.query };
    if (leg === first) query.origin = originIata;
    if (leg === last) query.destination = originIata;
    // Never invent same-airport legs (happens if return was stored first).
    if (query.origin === query.destination) return leg;
    return { ...leg, query };
  });
  return { ...plan, searches };
}

export function dualOriginTargets(message: string): readonly string[] | null {
  if (!mentionsLheIsbCompare(message)) return null;
  return PK_COMPARE_ORIGINS;
}

export function originLabel(iata: string): string {
  return iataToPlace(iata) || iata;
}

export function buildFollowUpSuggestions(args: {
  multiCity: boolean;
  hasResults: boolean;
  dualOrigin: boolean;
  datesAssumed?: boolean;
  emptyAll?: boolean;
}): string[] {
  if (args.emptyAll) {
    return [
      "Dates within the next 90 days",
      "Search from Lahore only",
      "Remove airline filters",
    ];
  }
  if (args.datesAssumed && args.multiCity) {
    return [
      "Early October dates",
      "Flexible ±3 day windows",
      "Compare Lahore vs Islamabad",
    ];
  }
  if (args.dualOrigin && args.hasResults) {
    return [
      "Show Islamabad origin instead",
      "Filter to nonstop only",
      "Sort by cheapest total",
    ];
  }
  if (args.multiCity && args.hasResults) {
    return [
      "Sort by cheapest total trip",
      "Show only single-ticket options",
      "Adjust stopover nights in London",
    ];
  }
  if (args.multiCity && !args.hasResults) {
    return [
      "Nearer departure dates",
      "Compare Lahore vs Islamabad",
      "Remove filters",
    ];
  }
  return ["Flexible dates", "Add a hotel stay", "Nonstop only"];
}

export function buildMultiCityEmptyReply(
  variants: { legRoute: string; originLabel: string }[],
): string {
  if (variants.length === 0) {
    return "No bookable fares matched these dates. Try nearer dates or loosen filters — results will update in the panel.";
  }
  const lines = variants.map(
    (v) => `${v.legRoute}: no fares on these dates for ${v.originLabel}.`,
  );
  return `${lines.join(" ")} Try dates within the next 90 days or adjust your route.`;
}

/** Explain partial GDS coverage when some legs have inventory and others do not. */
export function buildLegGdsDiagnostics(
  legPanels: { legRoute: string; totalCount: number; live: boolean; web?: boolean }[],
): string {
  if (legPanels.length === 0) {
    return "Travelport returned no inventory for this multi-city search on these dates.";
  }

  const lines = legPanels.map((p) => {
    if (p.totalCount > 0 && p.live) {
      return `${p.legRoute}: ${p.totalCount} live GDS fare${p.totalCount === 1 ? "" : "s"}`;
    }
    if (p.totalCount > 0 && p.web) {
      return `${p.legRoute}: ${p.totalCount} market option${p.totalCount === 1 ? "" : "s"} (Google Flights reference — not bookable here)`;
    }
    if (p.totalCount > 0) {
      return `${p.legRoute}: ${p.totalCount} option${p.totalCount === 1 ? "" : "s"} (not live GDS)`;
    }
    return `${p.legRoute}: no GDS inventory on these dates`;
  });

  const liveLegs = legPanels.filter((p) => p.live && p.totalCount > 0);
  const webLegs = legPanels.filter((p) => p.web && p.totalCount > 0);
  const emptyLegs = legPanels.filter((p) => p.totalCount === 0);

  if (liveLegs.length > 0 && (emptyLegs.length > 0 || webLegs.length > 0)) {
    const gapNote =
      webLegs.length > 0 && emptyLegs.length === 0
        ? "Later legs show Google Flights market reference only — not bookable here."
        : "A full connected itinerary could not be built because later legs are missing from GDS.";
    return (
      `Travelport returned partial inventory only — ${lines.join("; ")}. ` +
      `${gapNote} ` +
      `Browse each leg in the panel, or try different dates / nearby airports (IAD, DCA, FLL).`
    );
  }

  if (liveLegs.length === 0 && webLegs.length > 0) {
    return (
      `${lines.join("; ")}. These are market references from Google Flights — not bookable here. ` +
      `Try dates within the next 90 days or a simpler route first.`
    );
  }

  if (liveLegs.length === 0) {
    return `${lines.join("; ")}. Try dates within the next 90 days or a simpler route first.`;
  }

  return lines.join("; ");
}
