/**
 * Deterministic travel-plan extraction for demo mode.
 *
 * The LLM path (`extractTravelPlan`) is the only thing that understands
 * multi-city asks, so with `LLM_PROVIDER=off` every multi-leg query fell to
 * `looksComplexForHeuristic` and returned "trip planning AI is temporarily
 * unreachable". The corpus already knows these journeys — this parses the ask
 * against it directly, so demo mode never needs a provider.
 *
 * Only used when DEMO_FLIGHT_INVENTORY=true; the live path is untouched.
 */
import corpus from "./galileo-fares.json";
import { placeToIata } from "@/lib/inventory/places";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import type { CabinClass } from "@/lib/inventory/supplierSearch";

type Journey = {
  id: string;
  query: string;
  cabin: string;
  legs: { origin: string; destination: string; departureDate: string }[];
};

const JOURNEYS = corpus.journeys as Journey[];

type SearchPlan = Extract<TravelPlan, { action: "search" }>;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Default year for a bare "5 November" — the corpus lives in 2026. */
const CORPUS_YEAR = 2026;

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Exact-ish match against a canned journey, ignoring punctuation and case. */
function matchKnownJourney(message: string): Journey | null {
  const m = normalise(message);
  if (!m) return null;
  for (const j of JOURNEYS) {
    const q = normalise(j.query);
    if (m === q || m.includes(q) || q.includes(m)) return j;
  }
  return null;
}

function cabinFromText(text: string): CabinClass | undefined {
  if (/\bfirst\s+class\b/i.test(text)) return "FIRST";
  if (/\bbusiness\b/i.test(text)) return "BUSINESS";
  if (/\bpremium\s+economy\b/i.test(text)) return "PREMIUM_ECONOMY";
  if (/\beconomy\b/i.test(text)) return "ECONOMY";
  return undefined;
}

function passengersFromText(text: string): number {
  const m = text.match(/\b(\d{1,2})\s*(?:adults?|passengers?|people|pax|travell?ers?)\b/i);
  const n = m ? Number(m[1]) : 1;
  return Math.min(9, Math.max(1, Number.isFinite(n) ? n : 1));
}

/** "5 November" / "November 5" / "5 Nov 2026" → ISO. Null when unparseable. */
function parseDate(dayRaw: string, monthRaw: string, yearRaw?: string): string | null {
  const day = Number(dayRaw);
  const month = MONTHS[monthRaw.toLowerCase()];
  if (!month || !Number.isFinite(day) || day < 1 || day > 31) return null;
  const year = yearRaw ? Number(yearRaw) : CORPUS_YEAR;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DATE_RE =
  /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{4}))?|\b([a-z]+)\s+(\d{1,2})\s*(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/gi;

/** Every date mentioned, in order of appearance. */
function datesInOrder(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const iso = m[2]
      ? parseDate(m[1], m[2], m[3])
      : m[4] && m[5]
        ? parseDate(m[5], m[4], m[6])
        : null;
    if (iso) out.push(iso);
  }
  return out;
}

/**
 * City / IATA mentions in order of appearance.
 *
 * Matched against the longest names first so "New York" is not shadowed by a
 * shorter substring, and bare 3-letter codes are only accepted when they
 * resolve to a known airport.
 */
function placesInOrder(text: string): { code: string; index: number }[] {
  const hits: { code: string; index: number; len: number }[] = [];
  const lower = text.toLowerCase();

  // City names — scan every occurrence, not just the first.
  for (const name of CITY_NAMES) {
    const needle = name.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const before = idx === 0 ? " " : lower[idx - 1];
      const after = lower[idx + needle.length] ?? " ";
      if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) {
        const code = placeToIata(name);
        if (code) hits.push({ code, index: idx, len: needle.length });
      }
      from = idx + needle.length;
    }
  }

  // Bare IATA codes.
  for (const m of text.matchAll(/\b([A-Z]{3})\b/g)) {
    const code = placeToIata(m[1]);
    if (code && m.index != null) hits.push({ code, index: m.index, len: 3 });
  }

  // Longest match wins at any overlapping position.
  hits.sort((a, b) => a.index - b.index || b.len - a.len);
  const out: { code: string; index: number }[] = [];
  let consumedTo = -1;
  for (const h of hits) {
    if (h.index < consumedTo) continue;
    out.push({ code: h.code, index: h.index });
    consumedTo = h.index + h.len;
  }
  return out;
}

/**
 * City names to scan for. `places.ts` owns name → IATA but does not export its
 * key list, so this mirrors the names it maps; each is verified through
 * `placeToIata` below, and any that stops resolving is simply dropped.
 */
const KNOWN_PLACE_NAMES: string[] = [
  "London", "Paris", "Dubai", "Sharjah", "Islamabad", "Jeddah", "Madinah",
  "Medina", "Karachi", "Lahore", "Istanbul", "Bangkok", "New York",
  "Singapore", "Rome", "Amsterdam", "Barcelona", "Kuala Lumpur", "Doha",
  "Maldives", "Male", "Bali", "Denpasar", "Colombo", "Delhi", "Mumbai",
  "Abu Dhabi", "Riyadh", "Toronto", "Sydney", "Los Angeles", "San Francisco",
  "Beijing", "Shanghai", "Orlando", "Washington", "Washington DC", "Tokyo",
  "Seoul", "Hong Kong", "Frankfurt", "Munich", "Zurich", "Manchester",
  "Birmingham", "Multan", "Peshawar", "Sialkot", "Boston", "Milan", "Vienna",
  "Prague", "Athens", "Lisbon", "Edinburgh", "Dublin", "Chicago", "Vancouver",
  "Melbourne", "Auckland", "Johannesburg", "Nairobi", "Cape Town",
  "Las Vegas", "Seattle", "Miami", "Cairo", "Casablanca",
];

/** City names the corpus can resolve, longest first. */
const CITY_NAMES: string[] = (() => {
  const codes = new Set<string>();
  for (const o of corpus.systemOffers as { originCode: string; destinationCode: string }[]) {
    codes.add(o.originCode);
    codes.add(o.destinationCode);
  }
  const names = new Set<string>();
  for (const [name, code] of Object.entries(
    (corpus.airports ?? {}) as Record<string, { city?: string }>,
  )) {
    if (codes.has(name) && code?.city) names.add(code.city);
  }
  // `places.ts` is the authority for name → IATA; take its keys that resolve
  // to a city this corpus actually prices.
  for (const name of KNOWN_PLACE_NAMES) {
    const code = placeToIata(name);
    if (code && codes.has(code)) names.add(name);
  }
  return [...names].sort((a, b) => b.length - a.length);
})();

function legPlan(
  origin: string,
  destination: string,
  departureDate: string,
  passengers: number,
  cabinClass?: CabinClass,
) {
  return {
    product: "FLIGHT" as const,
    query: {
      origin,
      destination,
      departureDate,
      passengers,
      ...(cabinClass ? { cabinClass } : {}),
    },
  };
}

/**
 * Parse a multi-leg ask straight from the text.
 *
 * Pairs the Nth place transition with the Nth date: "A to B on D1, B to C on
 * D2" yields two legs. Requires at least 3 distinct stops and one date per
 * leg — anything looser is left to the normal single-leg heuristic.
 */
function parseMultiCity(
  message: string,
  passengers: number,
  cabinClass?: CabinClass,
): SearchPlan | null {
  const places = placesInOrder(message);
  const dates = datesInOrder(message);
  if (places.length < 3 || dates.length === 0) return null;

  // Collapse an immediate repeat ("... to London, London to Paris").
  const stops: string[] = [];
  for (const p of places) {
    if (stops[stops.length - 1] !== p.code) stops.push(p.code);
  }
  if (stops.length < 3) return null;

  const legCount = stops.length - 1;
  // One date per leg is the unambiguous case. Fewer dates means we would have
  // to invent travel days, which is exactly what the LLM path is for.
  if (dates.length < legCount) return null;

  const searches = [];
  for (let i = 0; i < legCount; i++) {
    searches.push(legPlan(stops[i], stops[i + 1], dates[i], passengers, cabinClass));
  }
  return { action: "search", searches };
}

/** Open jaw: "fly A to B on D1 and return from C on D2" — 3 stops, 2 dates. */
function parseOpenJaw(
  message: string,
  passengers: number,
  cabinClass?: CabinClass,
): SearchPlan | null {
  if (!/\bopen\s*jaw\b|\breturn(?:ing)?\s+from\b/i.test(message)) return null;
  const places = placesInOrder(message);
  const dates = datesInOrder(message);
  if (places.length < 3 || dates.length < 2) return null;

  const [a, b, c] = places.map((p) => p.code);
  return {
    action: "search",
    searches: [
      legPlan(a, b, dates[0], passengers, cabinClass),
      // Returns to the original origin from a DIFFERENT city — that is what
      // makes it an open jaw rather than a round trip.
      legPlan(c, a, dates[1], passengers, cabinClass),
    ],
  };
}

/**
 * A search plan for demo mode, or null to let the normal pipeline handle it.
 * Never calls an LLM.
 */
export function demoTravelPlan(message: string): TravelPlan | null {
  const text = message.trim();
  if (!text) return null;

  const passengers = passengersFromText(text);
  const cabinClass = cabinFromText(text);

  // 1. Exactly one of the advertised demo journeys — use its known legs.
  const known = matchKnownJourney(text);
  if (known) {
    return {
      action: "search",
      searches: known.legs.map((l) =>
        legPlan(
          l.origin,
          l.destination,
          l.departureDate,
          passengers,
          cabinClass ?? (known.cabin === "business" ? "BUSINESS" : undefined),
        ),
      ),
    };
  }

  // 2. Open jaw, then generic multi-city, parsed from the text itself.
  return (
    parseOpenJaw(text, passengers, cabinClass) ??
    parseMultiCity(text, passengers, cabinClass)
  );
}
