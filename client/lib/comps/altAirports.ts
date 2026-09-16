/**
 * Nearby / substitute airports for the same metro — used to pitch cheaper GDS legs.
 * Primary code is first; alternatives are searched when price hunting.
 *
 * Callers should still filter with isKnownIata before live GDS probes — metro
 * lists may include codes not yet on the client allowlist (historically LGW/OAK/SJC).
 */
const METRO_AIRPORTS: Record<string, string[]> = {
  // Destination metros
  LHR: ["LHR", "LGW", "STN", "LTN", "LCY"],
  LON: ["LHR", "LGW", "STN", "LTN"],
  PAR: ["CDG", "ORY"],
  CDG: ["CDG", "ORY"],
  ORY: ["ORY", "CDG"],
  NYC: ["JFK", "EWR", "LGA"],
  JFK: ["JFK", "EWR", "LGA"],
  EWR: ["EWR", "JFK", "LGA"],
  LGA: ["LGA", "JFK", "EWR"],
  IST: ["IST", "SAW"],
  SAW: ["SAW", "IST"],
  DXB: ["DXB", "DWC", "SHJ", "AUH", "XNB"],
  AUH: ["AUH", "DXB"],
  MIL: ["MXP", "LIN", "BGY"],
  MXP: ["MXP", "LIN", "BGY"],
  ROM: ["FCO", "CIA"],
  FCO: ["FCO", "CIA"],
  TYO: ["NRT", "HND"],
  NRT: ["NRT", "HND"],
  HND: ["HND", "NRT"],
  SEL: ["ICN", "GMP"],
  ICN: ["ICN", "GMP"],
  BKK: ["BKK", "DMK"],
  DMK: ["BKK", "DMK"],
  // US East — Norfolk has no bookable O/D on many PCCs; serve via WAS gateways
  ORF: ["ORF", "IAD", "DCA", "BWI", "PHF"],
  PHF: ["PHF", "ORF", "IAD", "DCA", "BWI"],
  IAD: ["IAD", "DCA", "BWI"],
  DCA: ["DCA", "IAD", "BWI"],
  BWI: ["BWI", "IAD", "DCA"],
  WAS: ["IAD", "DCA", "BWI"],
  // Origin hubs (Pakistan / GCC leisure)
  LHE: ["LHE", "SKT", "ISB"],
  KHI: ["KHI"],
  ISB: ["ISB", "LHE"],
  SKT: ["SKT", "LHE"],
  JED: ["JED", "MED"],
  RUH: ["RUH", "DMM"],
  SFO: ["SFO", "OAK", "SJC"],
  OAK: ["OAK", "SFO", "SJC"],
  SJC: ["SJC", "SFO", "OAK"],
  PEK: ["PEK", "PKX"],
  PKX: ["PKX", "PEK"],
  PVG: ["PVG", "SHA"],
  SHA: ["SHA", "PVG"],
  MCO: ["MCO"],
  MIA: ["MIA", "FLL"],
  FLL: ["FLL", "MIA"],
};

/** Alt airports for an IATA code (includes primary first). */
export function airportsForMetro(iata: string): string[] {
  const code = iata.toUpperCase();
  const list = METRO_AIRPORTS[code];
  if (list?.length) return [...list];
  return [code];
}

/** Alternative airports excluding the primary. */
export function altAirports(iata: string, max = 2): string[] {
  return airportsForMetro(iata).slice(1, 1 + max);
}

/**
 * Canonical metro hub for a code. Some cluster members (e.g. IAD/DCA/BWI
 * around Norfolk, OAK/SJC around SFO, AUH around DXB) have their own
 * top-level METRO_AIRPORTS entry as well as appearing inside a bigger
 * neighbour's group. Picking whichever entry happens to match `code`
 * directly — the old behaviour — made canonicalization depend on which
 * code you started from: metroCanonical("IAD") returned "IAD" (IAD's own,
 * 3-member entry) while metroCanonical("ORF") returned "ORF" (ORF's own
 * 5-member entry, which lists IAD as a member) — so sameMetro("IAD","ORF")
 * was false even though ORF's own table row says they're the same metro.
 * Instead, always resolve to whichever group CONTAINING `code` has the most
 * members — the most complete definition of that metro — so every member of
 * a cluster canonicalizes to the same root regardless of lookup direction.
 */
export function metroCanonical(iata: string): string {
  const code = iata.toUpperCase();
  let best: string[] | null = null;
  for (const airports of Object.values(METRO_AIRPORTS)) {
    if (!airports.includes(code)) continue;
    if (!best || airports.length > best.length) best = airports;
  }
  return best ? best[0] : code;
}

export function sameMetro(a: string, b: string): boolean {
  return metroCanonical(a) === metroCanonical(b);
}
