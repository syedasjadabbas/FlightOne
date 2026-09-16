/**
 * Deterministic origin/destination extraction for simple flight requests.
 * Builds on place resolution — not a hardcoded sentence list.
 */
import { PLACE_TO_IATA, isKnownIata, resolvePlaceOrIata } from "@/lib/inventory/places";
import { extractIntent } from "./intent";

export type ExtractedRoute = {
  origin: string;
  destination: string;
};

/** Places sorted longest-first so "New York" wins over "York". */
const PLACES_BY_LENGTH = Object.keys(PLACE_TO_IATA).sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

const IATA_PAIR =
  /\b([A-Za-z]{3})\s*(?:→|->|—|–|-|\bto\b)\s*([A-Za-z]{3})\b/g;

const FROM_TO =
  /\b(?:fly(?:ing)?|flight|return\s+flight|travel(?:ing)?|need\s+a)?\s*from\s+([a-z0-9 ,.'-]+?)\s+to\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|from|depart|return|and|in|,|\.|$)|$)/i;

const BARE_TO =
  /\b(?:fly(?:ing)?|flight)\s+(?:from\s+)?([a-z0-9 ,.'-]+?)\s+to\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|from|depart|return|and|in|,|\.|$)|$)/i;

/** "go to Istanbul from Lahore" / "to China from Karachi" — not "want to fly from". */
const TO_FROM =
  /\b(?:go(?:ing)?|fly(?:ing)?|travel(?:ing|ling)?|wanna\s+go|want\s+to\s+go|need\s+to\s+go)\s+to\s+([a-z0-9 ,.'-]+?)\s+from\s+([a-z0-9 ,.'-]+?)(?=\s+(?:on|in|,|\.|$)|$)/i;


/** Strip trailing date / noise from a captured place fragment. */
function cleanPlaceFragment(raw: string): string {
  return raw
    .replace(/\s+(on|from|depart(?:ure)?|return(?:ing)?|and|via|through|in)\b.*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function resolvePlaceFragment(fragment: string): string | null {
  const clean = cleanPlaceFragment(fragment);
  if (!clean) return null;

  const direct = resolvePlaceOrIata(clean);
  if (direct) return direct;

  const lower = clean.toLowerCase();
  for (const place of PLACES_BY_LENGTH) {
    const p = place.toLowerCase();
    if (lower === p || lower.startsWith(`${p} `) || lower.includes(` ${p}`)) {
      return PLACE_TO_IATA[place] ?? null;
    }
  }

  const iataLead = clean.match(/^([A-Za-z]{3})\b/);
  if (iataLead) {
    const code = iataLead[1].toUpperCase();
    if (isKnownIata(code)) return code;
  }

  return null;
}

function extractIataPair(message: string): ExtractedRoute | null {
  for (const m of message.matchAll(IATA_PAIR)) {
    const a = m[1].toUpperCase();
    const b = m[2].toUpperCase();
    if (!isKnownIata(a) || !isKnownIata(b) || a === b) continue;
    return { origin: a, destination: b };
  }
  return null;
}

function extractFromTo(message: string): ExtractedRoute | null {
  const m = message.match(FROM_TO) ?? message.match(BARE_TO);
  if (!m) return null;
  const origin = resolvePlaceFragment(m[1]);
  const destination = resolvePlaceFragment(m[2]);
  if (!origin || !destination || origin === destination) return null;
  return { origin, destination };
}

function extractToFrom(message: string): ExtractedRoute | null {
  const m = message.match(TO_FROM);
  if (!m) return null;
  const destination = resolvePlaceFragment(m[1]);
  const origin = resolvePlaceFragment(m[2]);
  if (!origin || !destination || origin === destination) return null;
  return { origin, destination };
}

/**
 * Extract origin/destination IATA codes when the message clearly names a route.
 * Returns null when route cannot be determined confidently.
 */
export function extractFlightRouteFromMessage(
  message: string,
  opts: { defaultOriginIata: string; defaultOriginPlace: string },
): ExtractedRoute | null {
  const iata = extractIataPair(message);
  if (iata) return iata;

  const explicit = extractFromTo(message);
  if (explicit) return explicit;

  const flipped = extractToFrom(message);
  if (flipped) return flipped;

  const intent = extractIntent(message, [], { defaultOrigin: opts.defaultOriginPlace });
  if (intent.type && intent.type !== "flight") return null;

  const destination = intent.destination ? resolvePlaceFragment(intent.destination) : null;
  if (!destination) return null;

  let origin = intent.origin ? resolvePlaceFragment(intent.origin) : null;
  if (!origin) origin = opts.defaultOriginIata;
  if (!isKnownIata(origin) || origin === destination) return null;

  return { origin, destination };
}
