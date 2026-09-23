/**
 * City / airport labels ↔ IATA codes for Travelport Search.
 * Seeded from inventory.data.json destinations FlightOne already markets.
 */

export const PLACE_TO_IATA: Record<string, string> = {
  London: "LHR",
  Paris: "CDG",
  Dubai: "DXB",
  // Sharjah was missing entirely — "find fare lhe-shj-lhe" (an exact reported
  // agent query) has no other way to resolve the word "Sharjah" to SHJ; the
  // bare 3-letter code still worked via placeToIata's regex passthrough, but
  // the CITY NAME did not.
  Sharjah: "SHJ",
  Islamabad: "ISB",
  Jeddah: "JED",
  Madinah: "MED",
  Medina: "MED",
  Karachi: "KHI",
  Lahore: "LHE",
  Istanbul: "IST",
  Bangkok: "BKK",
  "Don Mueang": "DMK",
  "Suvarnabhumi": "BKK",
  "New York": "JFK",
  Singapore: "SIN",
  Rome: "FCO",
  Amsterdam: "AMS",
  Barcelona: "BCN",
  "Kuala Lumpur": "KUL",
  Doha: "DOH",
  Maldives: "MLE",
  Male: "MLE",
  Bali: "DPS",
  Denpasar: "DPS",
  Indonesia: "DPS",
  "Sri Lanka": "CMB",
  Colombo: "CMB",
  Thailand: "BKK",
  Malaysia: "KUL",
  Turkey: "IST",
  Egypt: "CAI",
  Cairo: "CAI",
  Morocco: "CMN",
  Casablanca: "CMN",
  // Extra hubs for travellers outside Lahore POS
  Delhi: "DEL",
  Mumbai: "BOM",
  "Abu Dhabi": "AUH",
  Riyadh: "RUH",
  Toronto: "YYZ",
  Sydney: "SYD",
  "Los Angeles": "LAX",
  "San Francisco": "SFO",
  Beijing: "PEK",
  Shanghai: "PVG",
  Orlando: "MCO",
  Norfolk: "ORF",
  "Newport News": "PHF",
  Washington: "IAD",
  "Washington DC": "IAD",
  "Washington D.C.": "IAD",
  Dulles: "IAD",
  "Reagan National": "DCA",
  Baltimore: "BWI",
  Tokyo: "NRT",
  Seoul: "ICN",
  Hongkong: "HKG",
  "Hong Kong": "HKG",
  Frankfurt: "FRA",
  Munich: "MUC",
  Zurich: "ZRH",
  Manchester: "MAN",
  Birmingham: "BHX",
  Multan: "MUX",
  Peshawar: "PEW",
  Sialkot: "SKT",
  // Captured in the Galileo demo corpus (lib/demo/galileo-fares.json) but never
  // mapped — the city names "Boston" / "Milan" could not resolve to a code.
  Boston: "BOS",
  Milan: "MXP",
  // Multi-city demo journeys (see galileo-fares.json `journeys`). Without these
  // the city name in a leg query cannot resolve to an IATA code.
  Vienna: "VIE",
  Prague: "PRG",
  Athens: "ATH",
  Lisbon: "LIS",
  Edinburgh: "EDI",
  Dublin: "DUB",
  Chicago: "ORD",
  Vancouver: "YVR",
  Melbourne: "MEL",
  Auckland: "AKL",
  Johannesburg: "JNB",
  Nairobi: "NBO",
  "Cape Town": "CPT",
  "Las Vegas": "LAS",
  Seattle: "SEA",
  Miami: "MIA",
};

const IATA_TO_PLACE: Record<string, string> = Object.fromEntries(
  Object.entries(PLACE_TO_IATA).map(([place, code]) => [code, place]),
);

/** Default origin for Pakistan leisure POS when the customer only names a destination. */
export const DEFAULT_ORIGIN_PLACE = "Lahore";
export const DEFAULT_ORIGIN_IATA = "LHE";

/** Airport / terminal short name for cards (not the metro city). */
const AIRPORT_LABEL: Record<string, string> = {
  BKK: "Suvarnabhumi",
  DMK: "Don Mueang",
  LHR: "Heathrow",
  LGW: "Gatwick",
  STN: "Stansted",
  LTN: "Luton",
  LCY: "City",
  CDG: "Charles de Gaulle",
  ORY: "Orly",
  JFK: "JFK",
  EWR: "Newark",
  LGA: "LaGuardia",
  SFO: "San Francisco Intl",
  OAK: "Oakland",
  SJC: "San Jose",
  LAX: "Los Angeles Intl",
  MCO: "Orlando Intl",
  DXB: "Dubai Intl",
  DWC: "Al Maktoum",
  AUH: "Abu Dhabi",
  SHJ: "Sharjah",
  IST: "Istanbul",
  SAW: "Sabiha",
  DPS: "Ngurah Rai",
  LHE: "Allama Iqbal",
  ISB: "Islamabad",
  KHI: "Jinnah",
  DOH: "Hamad",
};

/**
 * Airport codes we accept for GDS search — includes metro alternates (LGW, OAK, SJC…)
 * that live in AIRPORT_LABEL but are not the PLACE_TO_IATA primary city code.
 * Built lazily so AIRPORT_LABEL (declared above) is included.
 */
let knownIataCodes: Set<string> | null = null;

function knownIataSet(): Set<string> {
  if (knownIataCodes) return knownIataCodes;
  knownIataCodes = new Set([
    ...Object.values(PLACE_TO_IATA).map((c) => c.toUpperCase()),
    ...Object.keys(AIRPORT_LABEL),
  ]);
  return knownIataCodes;
}

/** True when the code maps to a city/airport FlightOne supports for search. */
export function isKnownIata(code: string): boolean {
  return knownIataSet().has(code.toUpperCase());
}

/**
 * Resolve a city name or known IATA code — rejects unknown 3-letter codes
 * the LLM might invent (e.g. "XYZ").
 */
export function resolvePlaceOrIata(placeOrCode: string): string | null {
  const raw = placeOrCode.trim();
  if (!raw) return null;
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const code = raw.toUpperCase();
    return isKnownIata(code) ? code : null;
  }
  const direct = PLACE_TO_IATA[raw];
  if (direct) return direct;
  const lower = raw.toLowerCase();
  for (const [place, code] of Object.entries(PLACE_TO_IATA)) {
    if (place.toLowerCase() === lower) return code;
  }
  return null;
}

export function placeToIata(placeOrCode?: string | null): string | null {
  if (!placeOrCode) return null;
  return resolvePlaceOrIata(placeOrCode);
}

export function iataToPlace(code?: string | null): string {
  if (!code) return "Unknown";
  return IATA_TO_PLACE[code.toUpperCase()] || code.toUpperCase();
}

export function airportLabel(code?: string | null): string {
  if (!code) return "";
  const c = code.toUpperCase();
  return AIRPORT_LABEL[c] || iataToPlace(c);
}

/** ISO date N days from today (UTC date). */
export function daysFromToday(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Add calendar days to an ISO YYYY-MM-DD (UTC). */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
