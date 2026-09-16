/**
 * Detect explicit origin / destination / date overrides in the *latest* user message.
 * Latest explicit slots beat previousTravelPlan — used by mergeTravelPlan.
 */
import { resolvePlaceOrIata, isKnownIata } from "@/lib/inventory/places";
import { extractFlightRouteFromMessage } from "./extractFlightRoute";
import { parseFlightDatesFromMessage } from "./parseFlightDates";

export type ExplicitSlotOverrides = {
  /** Resolved IATA when the user named a known city/airport. */
  origin?: string;
  destination?: string;
  /**
   * Free-text destination that is too broad for Travelport (e.g. "China").
   * Caller must clear the previous destination and clarify — never invent an airport.
   */
  destinationUnresolved?: string;
  /** Clarify question for an unresolved destination. */
  destinationClarifyAsk?: string;
  departureDate?: string;
  returnDate?: string;
  /** True when latest message clearly replaces departure (or sets a new outbound date). */
  departureDateExplicit?: boolean;
  originChanged: boolean;
  destinationChanged: boolean;
  dateChanged: boolean;
};

const DEST_REPLACE =
  /\b(instead|rather|actually|switch(?:ing)?\s+to|change(?:\s+(?:the|my))?\s+destination|not\s+(?:dubai|dxb|london|istanbul)|wanna\s+go\s+to|want\s+to\s+go\s+to|want\s+to\s+fly\s+to|go(?:ing)?\s+to|fly(?:ing)?\s+to|destination\s+(?:is|to)|make\s+it)\b/i;

const ORIGIN_REPLACE =
  /\b(from\s+[a-z][a-z\s.'-]{1,40}\s+instead|instead\s+from|actually\s+from|not\s+(?:lahore|karachi|islamabad|lhe|khi|isb)|from\s+[a-z][a-z\s.'-]{1,40}\s+to|depart(?:ing)?\s+from|leaving\s+from)\b/i;

const DATE_REPLACE =
  /\b(make\s+it|change(?:\s+(?:the|my))?\s+date|instead\s+on|on\s+\d|on\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|september|october|november|december|january|february|march|april|june|july|august|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b/i;

const SOMEWHERE_ELSE =
  /\b(somewhere\s+else|different\s+(?:place|city|destination)|another\s+(?:city|destination|place)|change\s+(?:my\s+)?(?:mind|destination))\b/i;

/**
 * Country / region names that are not valid Travelport city airports.
 * Do NOT invent hubs here — clarify which city.
 */
const BROAD_DESTINATION_ASK: Record<string, string> = {
  china:
    "Which city in China would you like to fly to? Beijing, Shanghai, or another city?",
  europe: "Which city in Europe would you like to fly to?",
  asia: "Which city in Asia would you like to fly to?",
  india: "Which city in India would you like to fly to? Delhi, Mumbai, or another city?",
  usa: "Which city in the USA would you like to fly to?",
  america: "Which city would you like to fly to?",
  "united states": "Which city in the United States would you like to fly to?",
  "middle east": "Which city in the Middle East would you like to fly to?",
  gulf: "Which city in the Gulf would you like to fly to?",
  africa: "Which city in Africa would you like to fly to?",
};

function findBroadDestination(message: string): { key: string; ask: string } | null {
  const lower = message.toLowerCase();
  const keys = Object.keys(BROAD_DESTINATION_ASK).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (!re.test(lower)) continue;
    // If a known city in that country is also named, prefer the city (not broad).
    if (
      key === "china" &&
      /\b(beijing|shanghai|guangzhou|shenzhen|hong\s*kong|chengdu|xi'?an)\b/i.test(lower)
    ) {
      continue;
    }
    if (
      key === "india" &&
      /\b(delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata)\b/i.test(lower)
    ) {
      continue;
    }
    if (
      (key === "usa" || key === "america" || key === "united states") &&
      /\b(new\s+york|los\s+angeles|chicago|miami|san\s+francisco|boston|seattle|houston|dallas|atlanta)\b/i.test(
        lower,
      )
    ) {
      continue;
    }
    if (
      key === "europe" &&
      /\b(london|paris|amsterdam|frankfurt|rome|madrid|barcelona|istanbul|zurich|vienna)\b/i.test(
        lower,
      )
    ) {
      continue;
    }
    return { key, ask: BROAD_DESTINATION_ASK[key] };
  }
  return null;
}

function stripNoisePlace(raw: string): string {
  return raw
    .replace(/\s+(on|from|depart(?:ure)?|return(?:ing)?|and|via|through|in|instead)\b.*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

/**
 * "to China from Lahore" / "go to Istanbul from Karachi"
 * Avoid matching "want to fly from X to Y" (destination would falsely be "fly").
 */
function extractToFrom(message: string): { origin: string; destinationRaw: string } | null {
  const m = message.match(
    /\b(?:go(?:ing)?|fly(?:ing)?|travel(?:ing|ling)?|wanna\s+go|want\s+to\s+go|need\s+to\s+go)\s+to\s+([a-z0-9 ,.'-]+?)\s+from\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|in|,|\.|$)|$)/i,
  );
  if (!m) {
    const alt = message.match(
      /\bto\s+([a-z0-9 ,.'-]+?)\s+from\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|in|,|\.|$)|$)/i,
    );
    if (!alt) return null;
    const dest = stripNoisePlace(alt[1]);
    if (/^(fly|flying|go|going|travel|travelling|traveling)$/i.test(dest)) return null;
    return { destinationRaw: dest, origin: stripNoisePlace(alt[2]) };
  }
  const dest = stripNoisePlace(m[1]);
  if (/^(fly|flying|go|going|travel|travelling|traveling)$/i.test(dest)) return null;
  return { destinationRaw: dest, origin: stripNoisePlace(m[2]) };
}

/**
 * "from Karachi instead" / "Actually from Islamabad" / "Actually from Karachi."
 */
function extractOriginOnlyChange(message: string): string | null {
  const m =
    message.match(/\b(?:actually\s+)?from\s+([a-z0-9 ,.'-]+?)\s+instead\b/i) ||
    message.match(/\binstead\s+from\s+([a-z0-9 ,.'-]+?)(?=\s|$|,|\.)/i) ||
    message.match(/\bnot\s+(?:from\s+)?([a-z0-9 ,.'-]+).*\bfrom\s+([a-z0-9 ,.'-]+)\b/i);
  if (m) {
    const frag = stripNoisePlace(m[2] ?? m[1]);
    return resolvePlaceOrIata(frag);
  }
  // Short origin-only correction without "to …" ("Actually from Karachi.")
  if (
    /\b(?:actually\s+)?from\s+[a-z]/i.test(message) &&
    !/\bto\b/i.test(message) &&
    message.length < 80
  ) {
    const bare = message.match(/\b(?:actually\s+)?from\s+([a-z0-9 ,.'-]+?)\s*\.?\s*$/i);
    if (bare) {
      return resolvePlaceOrIata(stripNoisePlace(bare[1]));
    }
  }
  return null;
}

/**
 * "Istanbul instead" / "Actually London" / "change destination to London"
 */
function extractDestinationOnlyChange(message: string): string | null {
  // Origin-only corrections must not be treated as destination ("from Karachi instead").
  if (
    /\bfrom\s+[a-z0-9 ,.'-]+?\s+instead\b/i.test(message) &&
    !/\b(?:to|destination)\b/i.test(message)
  ) {
    return null;
  }
  const m =
    message.match(
      /\b(?:change(?:\s+(?:the|my))?\s+destination\s+to|destination\s+(?:is|to)|switch(?:ing)?\s+to|make\s+it)\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|from|instead|,|\.|$)|$)/i,
    ) ||
    message.match(/\b(?:I\s+)?want\s+([a-z0-9 ,.'-]+?)\s+instead\b/i) ||
    message.match(/\b(?:actually|rather)\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|from|instead|,|\.|$)|$)/i) ||
    message.match(/\b(?:no,?\s+)?([a-z0-9 ,.'-]+?)\s+instead\b/i);
  if (!m) return null;
  const frag = stripNoisePlace(m[1]);
  // Avoid treating "from Karachi instead" as destination
  if (/^from\b/i.test(frag)) return null;
  // Avoid month/date fragments ("make it Sep 15")
  if (
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|september|october|november|december|january|february|march|april|june|july|august|\d)/i.test(
      frag,
    )
  ) {
    return null;
  }
  return resolvePlaceOrIata(frag);
}

/**
 * Clarification / short replies: "beijing on 10 sept", "Shanghai", "Istanbul Sep 15".
 * Leading known city is the destination — must beat a stale previousTravelPlan.destination.
 */
export function extractLeadingCityDestination(message: string): string | null {
  const text = message.trim();
  if (!text || text.length > 80) return null;
  if (/\bfrom\b/i.test(text) && /\bto\b/i.test(text)) return null;

  const direct = resolvePlaceOrIata(text);
  if (direct) return direct;

  const beforeOn = text.match(
    /^([a-z][a-z\s.'-]{1,40}?)(?=\s+on\b|\s*,\s*|\s+\d{1,2}(?:st|nd|rd|th)?\b)/i,
  );
  if (beforeOn) {
    const iata = resolvePlaceOrIata(stripNoisePlace(beforeOn[1]));
    if (iata) return iata;
  }

  // First token / short phrase before a month name
  const beforeMonth = text.match(
    /^([a-z][a-z\s.'-]{1,40}?)(?=\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b)/i,
  );
  if (beforeMonth) {
    const iata = resolvePlaceOrIata(stripNoisePlace(beforeMonth[1]));
    if (iata) return iata;
  }

  return null;
}

export function extractExplicitSlotOverrides(
  message: string,
  opts: {
    today: string;
    defaultOriginIata: string;
    defaultOriginPlace: string;
    previousOrigin?: string | null;
    previousDestination?: string | null;
  },
): ExplicitSlotOverrides {
  const text = message.trim();
  const empty: ExplicitSlotOverrides = {
    originChanged: false,
    destinationChanged: false,
    dateChanged: false,
  };
  if (!text) return empty;

  const out: ExplicitSlotOverrides = { ...empty };

  if (SOMEWHERE_ELSE.test(text) && !extractFlightRouteFromMessage(text, opts)) {
    out.destinationChanged = true;
    out.destinationUnresolved = "somewhere else";
    out.destinationClarifyAsk = "Where would you like to go instead?";
  }

  const broad = findBroadDestination(text);
  if (broad) {
    out.destinationChanged = true;
    out.destinationUnresolved = broad.key;
    out.destinationClarifyAsk = broad.ask;
  }

  const toFrom = extractToFrom(text);
  if (toFrom) {
    const originIata = resolvePlaceOrIata(toFrom.origin);
    if (originIata) {
      out.origin = originIata;
      out.originChanged = !opts.previousOrigin || opts.previousOrigin !== originIata;
    }
    if (!broad) {
      const destIata = resolvePlaceOrIata(toFrom.destinationRaw);
      if (destIata) {
        out.destination = destIata;
        out.destinationChanged =
          !opts.previousDestination || opts.previousDestination !== destIata;
      } else if (!out.destinationUnresolved) {
        out.destinationChanged = true;
        out.destinationUnresolved = toFrom.destinationRaw;
        out.destinationClarifyAsk = `I couldn't match "${toFrom.destinationRaw}" to an airport. Which city would you like to fly to?`;
      }
    }
  }

  const route = extractFlightRouteFromMessage(text, {
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
  });
  const originExplicitInMessage =
    ORIGIN_REPLACE.test(text) || (/\bfrom\b/i.test(text) && /\bto\b/i.test(text));
  const destOnlyInMessage =
    /\binstead\b/i.test(text) &&
    !/\bfrom\s+[a-z]/i.test(text) &&
    extractDestinationOnlyChange(text) != null;

  if (route && !broad) {
    const looksExplicit =
      /\bfrom\b/i.test(text) ||
      /\bto\b/i.test(text) ||
      DEST_REPLACE.test(text) ||
      ORIGIN_REPLACE.test(text) ||
      /[A-Za-z]{3}\s*(?:→|->)/.test(text);
    if (looksExplicit) {
      // Never clobber origin on destination-only corrections ("I want Dubai instead").
      if (
        route.origin &&
        isKnownIata(route.origin) &&
        originExplicitInMessage &&
        !destOnlyInMessage
      ) {
        out.origin = route.origin;
        out.originChanged = !opts.previousOrigin || opts.previousOrigin !== route.origin;
      }
      if (route.destination && isKnownIata(route.destination)) {
        out.destination = route.destination;
        out.destinationChanged =
          !opts.previousDestination || opts.previousDestination !== route.destination;
      }
    }
  }

  if (DEST_REPLACE.test(text) || (!out.destination && !out.destinationUnresolved)) {
    const destOnly = extractDestinationOnlyChange(text);
    if (destOnly && !broad) {
      out.destination = destOnly;
      out.destinationChanged =
        !opts.previousDestination || opts.previousDestination !== destOnly;
    }
  }

  // "beijing on 10 sept" after a China clarify — leading city beats stale DXB.
  if (!broad && !out.destinationUnresolved) {
    const leading = extractLeadingCityDestination(text);
    if (leading) {
      out.destination = leading;
      out.destinationChanged =
        !opts.previousDestination || opts.previousDestination !== leading;
    }
  }

  if (ORIGIN_REPLACE.test(text) || /\bfrom\b/i.test(text)) {
    const originOnly = extractOriginOnlyChange(text);
    if (originOnly) {
      out.origin = originOnly;
      out.originChanged = !opts.previousOrigin || opts.previousOrigin !== originOnly;
    }
  }

  const dates = parseFlightDatesFromMessage(text, opts.today);
  if (dates?.departureDate || dates?.returnDate) {
    const explicitDate =
      DATE_REPLACE.test(text) ||
      out.destinationChanged ||
      out.originChanged ||
      /\bon\b/i.test(text) ||
      Boolean(dates.departureDate);
    if (explicitDate && dates.departureDate) {
      out.departureDate = dates.departureDate;
      out.departureDateExplicit = true;
      out.dateChanged = true;
    }
    if (dates.returnDate) {
      out.returnDate = dates.returnDate;
      out.dateChanged = true;
    }
  }

  // Resolved city/airport always wins over a false-positive unresolved fragment.
  if (out.destination && out.destinationUnresolved) {
    delete out.destinationUnresolved;
    delete out.destinationClarifyAsk;
  }

  return out;
}

/** Dev-only structured logging for travel-plan debugging. */
export function logTravelPlanDebug(label: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[travel-plan] ${label}`, payload);
}
