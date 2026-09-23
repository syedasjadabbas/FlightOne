import type { TravelPlan } from "@/lib/consultant/travelPlan";

export type QueryComplexityCategory =
  | "simple"
  | "travel"
  | "flight_search"
  | "complex_multicity";

export interface ProcessingSchedule {
  totalDurationMs: number;
  category: QueryComplexityCategory;
  extractUntilMs: number;
  searchUntilMs: number;
  replyUntilMs: number;
}

const GREETING_RE =
  /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|salam|assalam|hola|bonjour)(\s+ava|\s+there|\s+flightone|[!.,?])?$/i;

const SIMPLE_QUESTION_RE =
  /\b(who are you|what can you do|how does this work|what is flightone|help|support|contact|customer service|refund policy|baggage allowance|visa requirement|how to book)\b/i;

const MULTI_CITY_KEYWORDS_RE =
  /\b(multi-?city|open-?jaw|stopover|layover|then go to|after that|next stop|then visit|via|round trip with stop)\b/i;

const FLIGHT_KEYWORDS_RE =
  /\b(flights?|fly|flying|fares?|tickets?|airline|non-?stop|direct flight|cheapest|business class|economy|premium economy|return ticket|departure|one-?way|round-?trip)\b/i;

const AIRPORT_CODE_RE = /\b[A-Z]{3}\b/g;

const DATE_WORDS_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|tomorrow|next week|next month|\d{4}-\d{2}-\d{2})\b/i;

const ROUTE_ARROW_RE = /→|->|-->|to\s+[a-z\s]+to\s+[a-z\s]+/i;

/**
 * Deterministically hash a string to a normalized 0..1 number for consistent
 * duration variance across rerenders without random jitter.
 */
function deterministicHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash % 1000) / 1000;
}

/**
 * Classify a user query into a complexity category to determine realistic,
 * bounded processing times.
 */
export function classifyQueryComplexity(
  query: string,
  options?: {
    hasRoute?: boolean;
    previousPlan?: TravelPlan | null;
  },
): QueryComplexityCategory {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // 1. Complex / Multi-city queries:
  // Explicit multi-city keywords, multiple hop arrows, or 3+ airport codes/cities
  const airportMatches = trimmed.match(AIRPORT_CODE_RE) || [];
  const hasMultiCityKeywords = MULTI_CITY_KEYWORDS_RE.test(lower);
  const hasMultipleHops = (trimmed.match(/→|->/g) || []).length >= 2;
  const hasMultiCityStructure =
    hasMultiCityKeywords ||
    hasMultipleHops ||
    airportMatches.length >= 3 ||
    (lower.includes("then") && (lower.includes("fly") || lower.includes("to")));

  if (hasMultiCityStructure) {
    return "complex_multicity";
  }

  // 2. Flight search queries:
  // Origin-to-destination pattern, flight keywords, airport codes, or date-based travel searches
  const hasFlightKeywords = FLIGHT_KEYWORDS_RE.test(lower);
  const hasDates = DATE_WORDS_RE.test(lower);
  const hasRouteArrow = ROUTE_ARROW_RE.test(trimmed);
  const isFlightSearch =
    options?.hasRoute ||
    hasFlightKeywords ||
    (airportMatches.length >= 2 && (hasDates || hasFlightKeywords || hasRouteArrow)) ||
    (lower.includes("from ") && lower.includes("to "));

  if (isFlightSearch) {
    return "flight_search";
  }

  // 3. Simple queries:
  // Greetings, short FAQ inquiries, simple capability questions
  const isGreeting = GREETING_RE.test(trimmed);
  const isSimpleFaq = SIMPLE_QUESTION_RE.test(trimmed);
  const isShortNonTravel = trimmed.length < 35 && !hasDates && airportMatches.length === 0;

  if (isGreeting || (isSimpleFaq && isShortNonTravel) || isShortNonTravel) {
    return "simple";
  }

  // 4. Normal travel queries:
  // General destination recommendations, hotel inquiries, itineraries
  return "travel";
}

/**
 * Estimate perceived processing duration (ms) bounded strictly between 3s and 28s.
 * Simple: ~3–7s
 * Travel: ~7–15s
 * Flight search: ~10–20s
 * Complex/Multi-city: ~15–28s (NEVER > 30s)
 */
export function estimateProcessingDuration(
  query: string,
  options?: {
    hasRoute?: boolean;
    previousPlan?: TravelPlan | null;
  },
): number {
  const category = classifyQueryComplexity(query, options);
  const variance = deterministicHash(query.trim().toLowerCase());

  let baseMin = 3500;
  let baseMax = 6500;

  switch (category) {
    case "simple":
      baseMin = 3500;
      baseMax = 6500;
      break;
    case "travel":
      baseMin = 7500;
      baseMax = 13500;
      break;
    case "flight_search":
      baseMin = 11000;
      baseMax = 18000;
      break;
    case "complex_multicity":
      baseMin = 16000;
      baseMax = 26000;
      break;
  }

  const duration = Math.round(baseMin + variance * (baseMax - baseMin));

  // Hard boundaries: strictly >= 3,000ms and <= 28,000ms (well under 30s upper limit)
  return Math.max(3000, Math.min(28000, duration));
}

/**
 * Break down total duration into natural processing phase milestones:
 * Phase 1 ("extract" - Reading request): 0% to 30% of total duration
 * Phase 2 ("search" - Reviewing options): 30% to 75% of total duration
 * Phase 3 ("reply" - Preparing answer): 75% to 100% of total duration
 */
export function getPhaseSchedule(
  query: string,
  options?: {
    hasRoute?: boolean;
    previousPlan?: TravelPlan | null;
  },
): ProcessingSchedule {
  const category = classifyQueryComplexity(query, options);
  const totalDurationMs = estimateProcessingDuration(query, options);

  const extractUntilMs = Math.round(totalDurationMs * 0.3);
  const searchUntilMs = Math.round(totalDurationMs * 0.75);
  const replyUntilMs = totalDurationMs;

  return {
    totalDurationMs,
    category,
    extractUntilMs,
    searchUntilMs,
    replyUntilMs,
  };
}
