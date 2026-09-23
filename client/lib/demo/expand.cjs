/**
 * Expands galileo-fares.json with 30 additional generated searches and emits a
 * `systemOffers[]` array in the EXACT `FlightOffer` shape the app consumes
 * (lib/inventory/types.ts), plus one English `query` per search.
 *
 * Everything generated here is SYNTHETIC — see `$meta.provenance`. Only the
 * original 5 searches are terminal captures. Durations are computed from local
 * times + UTC offsets (same method as enrich.cjs), never invented.
 *
 * Run: node lib/demo/expand.cjs
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "galileo-fares.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf8"));

/** UTC offsets valid for Oct–Dec 2026 (post-DST for EU/US). Extends enrich.cjs. */
const TZ = {
  LHE: 5, KHI: 5, ISB: 5, SKT: 5, MUX: 5, PEW: 5, TAS: 5,
  AUH: 4, DXB: 4, SHJ: 4, DOH: 3, BAH: 3, RUH: 3, JED: 3, MED: 3,
  IST: 3, CAI: 2, CMN: 1, CDG: 2, MXP: 2, FCO: 2, AMS: 2, BCN: 2,
  FRA: 2, MUC: 2, ZRH: 2, LHR: 1, LGW: 1, MAN: 1, BHX: 1,
  JFK: -5, EWR: -5, BOS: -5, MIA: -5, MCO: -5, IAD: -5, ORD: -6,
  YYZ: -5, SFO: -8, OAK: -8, SEA: -8, LAX: -8,
  BKK: 7, KUL: 8, SIN: 8, HKG: 8, PEK: 8, PVG: 8, NRT: 9, ICN: 9,
  DPS: 8, CMB: 5.5, MLE: 5, DEL: 5.5, BOM: 5.5, SYD: 11,
};

const AIRPORT_META = {
  ISB: { city: "Islamabad", country: "PK" }, SKT: { city: "Sialkot", country: "PK" },
  KHI: { city: "Karachi", country: "PK" }, MUX: { city: "Multan", country: "PK" },
  PEW: { city: "Peshawar", country: "PK" }, SHJ: { city: "Sharjah", country: "AE" },
  MED: { city: "Madinah", country: "SA" }, CAI: { city: "Cairo", country: "EG" },
  CMN: { city: "Casablanca", country: "MA" }, FCO: { city: "Rome", country: "IT" },
  AMS: { city: "Amsterdam", country: "NL" }, BCN: { city: "Barcelona", country: "ES" },
  FRA: { city: "Frankfurt", country: "DE" }, MUC: { city: "Munich", country: "DE" },
  ZRH: { city: "Zurich", country: "CH" }, LHR: { city: "London", country: "GB" },
  MAN: { city: "Manchester", country: "GB" }, BHX: { city: "Birmingham", country: "GB" },
  MCO: { city: "Orlando", country: "US" }, IAD: { city: "Washington", country: "US" },
  LAX: { city: "Los Angeles", country: "US" }, BKK: { city: "Bangkok", country: "TH" },
  KUL: { city: "Kuala Lumpur", country: "MY" }, SIN: { city: "Singapore", country: "SG" },
  HKG: { city: "Hong Kong", country: "HK" }, PEK: { city: "Beijing", country: "CN" },
  NRT: { city: "Tokyo", country: "JP" }, ICN: { city: "Seoul", country: "KR" },
  DPS: { city: "Bali", country: "ID" }, CMB: { city: "Colombo", country: "LK" },
  MLE: { city: "Maldives", country: "MV" }, DEL: { city: "Delhi", country: "IN" },
  BOM: { city: "Mumbai", country: "IN" }, SYD: { city: "Sydney", country: "AU" },
  YYZ: { city: "Toronto", country: "CA" },
};

/** Carrier code → the display label `airlineDisplayName` resolves to. */
const CARRIERS = {
  EK: "Emirates", EY: "Etihad", QR: "Qatar Airways", TK: "Turkish Airlines",
  SV: "Saudia", PK: "PIA", GF: "Gulf Air", TG: "Thai Airways",
  SQ: "Singapore Airlines", MH: "Malaysia Airlines", CX: "Cathay Pacific",
  UL: "SriLankan", WY: "Oman Air", BA: "British Airways",
};

/** Hub each carrier connects through — keeps generated routings plausible. */
const HUB = {
  EK: "DXB", EY: "AUH", QR: "DOH", TK: "IST", SV: "JED", GF: "BAH",
  TG: "BKK", SQ: "SIN", MH: "KUL", CX: "HKG", UL: "CMB", WY: "MCT",
  PK: null, BA: "LHR",
};

const utc = (dateISO, hhmm, iata) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Date.parse(`${dateISO}T00:00:00Z`) + (h * 60 + m - TZ[iata] * 60) * 60000;
};

const addDays = (iso, n) => {
  const t = Date.parse(`${iso}T00:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};

const hhmm = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Deterministic PRNG so re-runs produce identical data (diff-able output). */
function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/**
 * Build one segment and return it plus the arrival instant, so the next
 * segment's departure can be derived rather than guessed.
 */
function makeSegment(seq, carrier, flightNumber, bookingClass, from, to, depDateISO, depHHMM, flightMinutes, aircraft) {
  const depUtc = utc(depDateISO, depHHMM, from);
  const arrUtc = depUtc + flightMinutes * 60000;
  const arrLocalMs = arrUtc + TZ[to] * 3600000;
  const arrDate = new Date(arrLocalMs).toISOString().slice(0, 10);
  const arrHHMM = new Date(arrLocalMs).toISOString().slice(11, 16);
  return {
    seg: {
      seq,
      carrier,
      flightNumber,
      bookingClass,
      departureDate: depDateISO,
      originCode: from,
      destinationCode: to,
      departTimeLocal: depHHMM,
      arriveTimeLocal: arrHHMM,
      ...(arrDate !== depDateISO ? { arrivesNextDay: true } : {}),
      aircraft,
      arrivalDate: arrDate,
      durationMinutes: flightMinutes,
    },
    arrUtc,
  };
}

const FLEET = ["77W", "788", "789", "32A", "321", "359", "35K", "773", "738", "333"];
const RBD_ECON = ["T", "L", "V", "Q", "K", "H", "N"];
const RBD_BIZ = ["J", "C", "D", "I"];

/**
 * Nominal sector minutes between two airports. Derived from great-circle-ish
 * constants rather than random, so LHE→DXB is always ~200m on every rerun.
 */
const SECTOR = {
  "LHE-DXB": 200, "LHE-AUH": 200, "LHE-DOH": 215, "LHE-IST": 375, "LHE-JED": 285,
  "LHE-BKK": 260, "LHE-KUL": 350, "LHE-CMB": 230, "LHE-BAH": 225, "LHE-RUH": 250,
  "ISB-DXB": 185, "ISB-AUH": 190, "ISB-DOH": 205, "ISB-IST": 350, "ISB-JED": 275,
  "KHI-DXB": 140, "KHI-AUH": 145, "KHI-DOH": 155, "KHI-IST": 330, "KHI-JED": 225,
  "SKT-DXB": 195, "SKT-AUH": 195, "SKT-DOH": 210,
  "MUX-DXB": 170, "PEW-DXB": 185, "PEW-AUH": 190,
  "DXB-LHR": 470, "DXB-JFK": 855, "DXB-MAN": 465, "DXB-CDG": 440, "DXB-FRA": 425,
  "DXB-BKK": 380, "DXB-KUL": 445, "DXB-SIN": 450, "DXB-SYD": 830, "DXB-YYZ": 825,
  "DXB-IAD": 855, "DXB-MXP": 400, "DXB-BCN": 450, "DXB-AMS": 445, "DXB-MUC": 410,
  "DXB-ZRH": 415, "DXB-FCO": 400, "DXB-DPS": 545, "DXB-MLE": 255, "DXB-NRT": 570,
  "DXB-ICN": 520, "DXB-LAX": 985, "DXB-SFO": 950, "DXB-BOS": 800, "DXB-MCO": 900,
  "AUH-LHR": 475, "AUH-JFK": 860, "AUH-CDG": 445, "AUH-MAN": 470, "AUH-BKK": 375,
  "AUH-SIN": 445, "AUH-KUL": 440, "AUH-SYD": 825, "AUH-YYZ": 830, "AUH-FRA": 430,
  "AUH-MXP": 405, "AUH-DPS": 540, "AUH-MLE": 250, "AUH-NRT": 565, "AUH-ICN": 515,
  "DOH-LHR": 445, "DOH-JFK": 830, "DOH-CDG": 420, "DOH-MAN": 440, "DOH-BKK": 400,
  "DOH-SIN": 465, "DOH-KUL": 460, "DOH-SYD": 850, "DOH-YYZ": 800, "DOH-FRA": 400,
  "DOH-MXP": 380, "DOH-BCN": 425, "DOH-AMS": 420, "DOH-ZRH": 390, "DOH-FCO": 375,
  "DOH-DPS": 560, "DOH-MLE": 275, "DOH-NRT": 590, "DOH-ICN": 540, "DOH-IAD": 830,
  "DOH-LAX": 960, "DOH-MUC": 385, "DOH-BHX": 450, "DOH-MCO": 880,
  "IST-LHR": 240, "IST-JFK": 620, "IST-CDG": 205, "IST-FRA": 185, "IST-MAN": 250,
  "IST-BCN": 215, "IST-AMS": 220, "IST-MXP": 175, "IST-FCO": 160, "IST-MUC": 165,
  "IST-ZRH": 175, "IST-YYZ": 630, "IST-IAD": 640, "IST-SFO": 800, "IST-LAX": 810,
  "IST-BKK": 560, "IST-ICN": 640, "IST-NRT": 700, "IST-BHX": 250, "IST-MCO": 675,
  "JED-LHR": 380, "JED-CDG": 350, "JED-MAN": 390, "JED-IST": 215, "JED-KUL": 500,
  "BAH-LHR": 450, "BAH-CDG": 425, "BAH-BKK": 395,
  "BKK-SYD": 555, "BKK-NRT": 355, "BKK-ICN": 320, "BKK-DPS": 265, "BKK-HKG": 170,
  "KUL-SYD": 500, "KUL-DPS": 185, "KUL-NRT": 420, "KUL-HKG": 235,
  "SIN-SYD": 470, "SIN-DPS": 160, "SIN-NRT": 420, "SIN-HKG": 230,
  "CMB-LHR": 660, "CMB-BKK": 210, "CMB-SIN": 260, "CMB-MLE": 90,
  "LHR-JFK": 445, "LHR-YYZ": 455, "LHR-IAD": 470,
};

const sectorMinutes = (a, b) => SECTOR[`${a}-${b}`] || SECTOR[`${b}-${a}`] || 300;

/**
 * 30 generated searches. Each is a real market a Pakistani POS agency sells,
 * with the carriers that actually serve it. Prices are plausible PKR ranges
 * for the cabin, NOT supplier quotes.
 */
const SPECS = [
  // --- Pakistan → Europe ---
  { o: "LHE", d: "LHR", date: "2026-10-18", cabin: "economy", carriers: ["EK", "QR", "TK", "EY"], lo: 17500000, hi: 26000000, q: "Find me economy flights from Lahore to London on 18 October" },
  { o: "ISB", d: "LHR", date: "2026-10-20", cabin: "economy", carriers: ["EK", "QR", "TK"], lo: 17000000, hi: 25000000, q: "Islamabad to London on 20 October, cheapest economy please" },
  { o: "KHI", d: "LHR", date: "2026-10-22", cabin: "economy", carriers: ["EK", "QR", "EY"], lo: 16500000, hi: 24500000, q: "I need a flight from Karachi to London on 22 October" },
  { o: "LHE", d: "MAN", date: "2026-10-19", cabin: "economy", carriers: ["EK", "QR", "EY"], lo: 18000000, hi: 26500000, q: "Lahore to Manchester on 19 October for one adult" },
  { o: "SKT", d: "LHR", date: "2026-10-25", cabin: "economy", carriers: ["EK", "QR"], lo: 18500000, hi: 27000000, q: "Show me flights from Sialkot to London on 25 October" },
  { o: "LHE", d: "FRA", date: "2026-10-21", cabin: "economy", carriers: ["EK", "QR", "TK"], lo: 17000000, hi: 25500000, q: "Lahore to Frankfurt on 21 October" },
  { o: "LHE", d: "BCN", date: "2026-10-23", cabin: "economy", carriers: ["QR", "TK", "EK"], lo: 18000000, hi: 26500000, q: "Find flights Lahore to Barcelona departing 23 October" },
  { o: "ISB", d: "AMS", date: "2026-10-24", cabin: "economy", carriers: ["EK", "TK", "QR"], lo: 17500000, hi: 26000000, q: "Islamabad to Amsterdam on 24 October, economy" },
  { o: "LHE", d: "FCO", date: "2026-10-26", cabin: "economy", carriers: ["QR", "TK", "EK"], lo: 17000000, hi: 25000000, q: "I want to fly from Lahore to Rome on 26 October" },
  { o: "LHE", d: "ZRH", date: "2026-10-27", cabin: "economy", carriers: ["TK", "QR", "EK"], lo: 18500000, hi: 27500000, q: "Lahore to Zurich on 27 October" },

  // --- Pakistan → North America ---
  { o: "ISB", d: "JFK", date: "2026-10-16", cabin: "economy", carriers: ["QR", "TK", "EK"], lo: 24000000, hi: 36000000, q: "Islamabad to New York on 16 October" },
  { o: "KHI", d: "JFK", date: "2026-10-17", cabin: "economy", carriers: ["EK", "QR", "EY"], lo: 23500000, hi: 35000000, q: "Karachi to New York economy on 17 October" },
  { o: "LHE", d: "YYZ", date: "2026-10-18", cabin: "economy", carriers: ["QR", "TK", "EK"], lo: 25000000, hi: 37000000, q: "Find me flights from Lahore to Toronto on 18 October" },
  { o: "LHE", d: "IAD", date: "2026-10-19", cabin: "economy", carriers: ["QR", "TK", "EK"], lo: 25500000, hi: 38000000, q: "Lahore to Washington DC departing 19 October" },
  { o: "LHE", d: "LAX", date: "2026-10-20", cabin: "economy", carriers: ["QR", "EK", "TK"], lo: 27000000, hi: 40000000, q: "Show me Lahore to Los Angeles flights on 20 October" },
  { o: "ISB", d: "YYZ", date: "2026-10-21", cabin: "economy", carriers: ["QR", "TK"], lo: 25000000, hi: 36500000, q: "Islamabad to Toronto on 21 October" },
  { o: "LHE", d: "MCO", date: "2026-10-22", cabin: "economy", carriers: ["QR", "TK", "EK"], lo: 26500000, hi: 39000000, q: "Lahore to Orlando on 22 October for a family trip" },

  // --- Pakistan → Gulf (short haul, price-sensitive) ---
  { o: "LHE", d: "DXB", date: "2026-10-15", cabin: "economy", carriers: ["EK", "PK", "EY"], lo: 6500000, hi: 11000000, q: "Cheapest Lahore to Dubai on 15 October" },
  { o: "ISB", d: "DXB", date: "2026-10-16", cabin: "economy", carriers: ["EK", "PK"], lo: 6200000, hi: 10500000, q: "Islamabad to Dubai on 16 October" },
  { o: "KHI", d: "DXB", date: "2026-10-17", cabin: "economy", carriers: ["EK", "PK", "EY"], lo: 5500000, hi: 9500000, q: "Karachi to Dubai flights on 17 October" },
  { o: "LHE", d: "DOH", date: "2026-10-18", cabin: "economy", carriers: ["QR", "PK"], lo: 6800000, hi: 11500000, q: "Lahore to Doha on 18 October" },
  { o: "LHE", d: "JED", date: "2026-10-24", cabin: "economy", carriers: ["SV", "PK", "EK"], lo: 8500000, hi: 14000000, q: "I need Lahore to Jeddah on 24 October for Umrah" },
  { o: "KHI", d: "MED", date: "2026-10-25", cabin: "economy", carriers: ["SV", "PK"], lo: 8000000, hi: 13500000, q: "Karachi to Madinah on 25 October" },

  // --- Pakistan → Asia Pacific ---
  { o: "LHE", d: "BKK", date: "2026-10-19", cabin: "economy", carriers: ["TG", "EK", "QR"], lo: 11000000, hi: 18000000, q: "Lahore to Bangkok on 19 October" },
  { o: "LHE", d: "KUL", date: "2026-10-20", cabin: "economy", carriers: ["MH", "QR", "EK"], lo: 12000000, hi: 19000000, q: "Find flights from Lahore to Kuala Lumpur on 20 October" },
  { o: "KHI", d: "SIN", date: "2026-10-21", cabin: "economy", carriers: ["SQ", "EK", "QR"], lo: 13500000, hi: 21000000, q: "Karachi to Singapore on 21 October" },
  { o: "LHE", d: "DPS", date: "2026-10-23", cabin: "economy", carriers: ["QR", "EK", "MH"], lo: 15500000, hi: 24000000, q: "Lahore to Bali on 23 October for our honeymoon" },
  { o: "LHE", d: "MLE", date: "2026-10-24", cabin: "economy", carriers: ["EK", "QR", "UL"], lo: 12500000, hi: 20000000, q: "Show me Lahore to Maldives flights on 24 October" },
  { o: "LHE", d: "ICN", date: "2026-10-26", cabin: "economy", carriers: ["QR", "EK", "TK"], lo: 16000000, hi: 25000000, q: "Lahore to Seoul departing 26 October" },

  // --- Premium cabins ---
  { o: "LHE", d: "LHR", date: "2026-10-18", cabin: "business", carriers: ["EK", "QR", "TK"], lo: 62000000, hi: 95000000, q: "Business class from Lahore to London on 18 October" },
  { o: "ISB", d: "DXB", date: "2026-10-16", cabin: "business", carriers: ["EK", "EY"], lo: 19000000, hi: 32000000, q: "Business class Islamabad to Dubai on 16 October" },
  { o: "LHE", d: "JFK", date: "2026-10-20", cabin: "premium", carriers: ["QR", "TK", "EK"], lo: 38000000, hi: 55000000, q: "Premium economy from Lahore to New York on 20 October" },

  // --- Round trips ---
  { o: "LHE", d: "DXB", date: "2026-10-15", ret: "2026-10-25", cabin: "economy", carriers: ["EK", "PK", "EY"], lo: 11000000, hi: 18500000, q: "Return flight Lahore to Dubai, leaving 15 October coming back 25 October" },
  { o: "LHE", d: "LHR", date: "2026-10-18", ret: "2026-11-02", cabin: "economy", carriers: ["EK", "QR", "TK"], lo: 30000000, hi: 45000000, q: "Round trip Lahore to London, out 18 October back 2 November" },
  { o: "KHI", d: "BKK", date: "2026-10-19", ret: "2026-10-29", cabin: "economy", carriers: ["TG", "EK", "QR"], lo: 18000000, hi: 28000000, q: "Karachi to Bangkok return, 19 October to 29 October" },
];

/** Generate the itineraries for one spec. */
function buildSearch(spec) {
  const r = rng(`${spec.o}${spec.d}${spec.date}${spec.cabin}`);
  const isBiz = spec.cabin === "business";
  const isPrem = spec.cabin === "premium";
  const itineraries = [];

  spec.carriers.forEach((carrier, idx) => {
    const hub = HUB[carrier];
    const direct = !hub || hub === spec.d || hub === spec.o;
    const depMins = between(r, 1, 22) * 60 + pick(r, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const depHHMM = hhmm(depMins);
    const rbd = pick(r, isBiz || isPrem ? RBD_BIZ : RBD_ECON);
    const aircraft = pick(r, FLEET);
    const fno = String(between(r, 100, 899));

    let segments;
    let via = [];
    if (direct) {
      const mins = sectorMinutes(spec.o, spec.d);
      segments = [makeSegment(1, carrier, fno, rbd, spec.o, spec.d, spec.date, depHHMM, mins, aircraft).seg];
    } else {
      const leg1 = sectorMinutes(spec.o, hub);
      const a = makeSegment(1, carrier, fno, rbd, spec.o, hub, spec.date, depHHMM, leg1, aircraft);
      const layover = between(r, 75, 320);
      const dep2Utc = a.arrUtc + layover * 60000;
      const dep2LocalMs = dep2Utc + TZ[hub] * 3600000;
      const dep2Date = new Date(dep2LocalMs).toISOString().slice(0, 10);
      const dep2HHMM = new Date(dep2LocalMs).toISOString().slice(11, 16);
      const leg2 = sectorMinutes(hub, spec.d);
      const b = makeSegment(2, carrier, String(between(r, 1, 99)), rbd, hub, spec.d, dep2Date, dep2HHMM, leg2, pick(r, FLEET));
      a.seg.layoverMinutesAfter = layover;
      segments = [a.seg, b.seg];
      via = [hub];
    }

    const first = segments[0];
    const last = segments[segments.length - 1];
    const totalMinutes = Math.round(
      (utc(last.arrivalDate, last.arriveTimeLocal, last.destinationCode) -
        utc(first.departureDate, first.departTimeLocal, first.originCode)) / 60000,
    );

    // Price scales with the position in the carrier list so cheapest/fastest
    // angles differ — never random per-itinerary, or reruns reshuffle winners.
    const span = spec.hi - spec.lo;
    const totalMinor = Math.round((spec.lo + (span * idx) / Math.max(1, spec.carriers.length - 1)) / 100) * 100;

    let returnSegments;
    let returnMinutes;
    if (spec.ret) {
      const rdepHHMM = hhmm(between(r, 1, 22) * 60);
      if (direct) {
        returnSegments = [makeSegment(segments.length + 1, carrier, String(between(r, 100, 899)), rbd, spec.d, spec.o, spec.ret, rdepHHMM, sectorMinutes(spec.d, spec.o), aircraft).seg];
      } else {
        const ra = makeSegment(segments.length + 1, carrier, String(between(r, 100, 899)), rbd, spec.d, hub, spec.ret, rdepHHMM, sectorMinutes(spec.d, hub), aircraft);
        const rlay = between(r, 75, 300);
        const rdep2Utc = ra.arrUtc + rlay * 60000;
        const rdep2LocalMs = rdep2Utc + TZ[hub] * 3600000;
        const rb = makeSegment(segments.length + 2, carrier, String(between(r, 1, 99)), rbd, hub, spec.o,
          new Date(rdep2LocalMs).toISOString().slice(0, 10),
          new Date(rdep2LocalMs).toISOString().slice(11, 16),
          sectorMinutes(hub, spec.o), pick(r, FLEET));
        ra.seg.layoverMinutesAfter = rlay;
        returnSegments = [ra.seg, rb.seg];
      }
      const rf = returnSegments[0];
      const rl = returnSegments[returnSegments.length - 1];
      returnMinutes = Math.round(
        (utc(rl.arrivalDate, rl.arriveTimeLocal, rl.destinationCode) -
          utc(rf.departureDate, rf.departTimeLocal, rf.originCode)) / 60000,
      );
    }

    itineraries.push({
      option: idx + 1,
      totalMinor,
      totalFormatted: `PKR ${(totalMinor / 100).toLocaleString("en-US")}`,
      fareBasis: `${rbd}${isBiz ? "BIZ" : isPrem ? "PRM" : "LOW"}${between(r, 10, 99)}PK`,
      dayOffset: Math.max(0, Math.floor((Date.parse(`${last.arrivalDate}T00:00:00Z`) - Date.parse(`${spec.date}T00:00:00Z`)) / 86400000)),
      via,
      segments,
      ...(returnSegments ? { returnSegments, returnStops: returnSegments.length - 1, returnDurationMinutes: returnMinutes } : {}),
      durationMinutes: totalMinutes,
      stops: segments.length - 1,
      maxLayoverMinutes: Math.max(0, ...segments.map((s) => s.layoverMinutesAfter || 0)),
      cabin: spec.cabin,
      baggageKg: isBiz ? 40 : isPrem ? 35 : carrier === "PK" ? 40 : 30,
      refundable: isBiz,
      checkedBagIncluded: true,
      construction: "single_ticket",
      marketingCarriers: [carrier],
      validatingCarrier: carrier,
      seatsRemaining: between(r, 2, 9),
      supplierOfferSnapshotId: `snap_demo_${spec.o.toLowerCase()}-${spec.d.toLowerCase()}-${spec.date.slice(8)}${spec.cabin[0]}_${String(idx + 1).padStart(2, "0")}`,
      snapshotExpiresAt: "2026-12-31T23:59:59.000Z",
    });
  });

  // Angles/badges compare WITHIN the set — same rule enrich.cjs uses.
  const cheapest = itineraries.reduce((a, b) => (b.totalMinor < a.totalMinor ? b : a));
  const fastest = itineraries.reduce((a, b) => (b.durationMinutes < a.durationMinutes ? b : a));
  const maxPrice = Math.max(...itineraries.map((i) => i.totalMinor));
  for (const it of itineraries) {
    it.angle = it === cheapest ? "cheapest" : it === fastest ? "fastest" : "best_value";
    it.marketPriceMinor = Math.round((maxPrice * 1.08) / 100) * 100;
    it.savingsPct = Math.round((1 - it.totalMinor / it.marketPriceMinor) * 100);
    it.score = Math.max(60, Math.min(98, 98 - Math.round((it.totalMinor - cheapest.totalMinor) / Math.max(1, maxPrice - cheapest.totalMinor) * 20) - Math.round((it.durationMinutes - fastest.durationMinutes) / 60)));
    it.badges = [
      it.angle === "cheapest" ? "Cheapest" : it.angle === "fastest" ? "Fastest" : "Best value",
      `${it.baggageKg}kg bag`,
      it.stops === 0 ? "Non-stop" : "Single carrier",
    ];
    it.reasons = [
      `${it.savingsPct}% below the comparable market fare`,
      it.stops === 0 ? "Non-stop service" : `${it.stops} stop via ${it.via.join(", ")}`,
      `Total journey ${Math.floor(it.durationMinutes / 60)}h ${it.durationMinutes % 60}m`,
      it.refundable ? "Refundable fare conditions" : "Non-refundable fare conditions",
    ];
  }

  return {
    id: `${spec.o.toLowerCase()}-${spec.d.toLowerCase()}-${spec.date.slice(8)}${spec.date.slice(5, 7) === "10" ? "oct" : "nov"}${spec.cabin === "economy" ? "" : `-${spec.cabin}`}${spec.ret ? "-rt" : ""}`,
    command: `FS${spec.o}${spec.date.slice(8)}OCT${spec.d}${spec.cabin === "business" ? ".JC" : spec.cabin === "premium" ? ".JS" : ""}`,
    query: spec.q,
    origin: spec.o,
    destination: spec.d,
    originCity: (AIRPORT_META[spec.o] || d.airports[spec.o]).city,
    destinationCity: (AIRPORT_META[spec.d] || d.airports[spec.d]).city,
    departureDate: spec.date,
    ...(spec.ret ? { returnDate: spec.ret } : {}),
    tripType: spec.ret ? "round_trip" : "one_way",
    cabin: spec.cabin,
    generated: true,
    totalOptionsReported: { pricing: itineraries.length, itinerary: itineraries.length },
    capturedOptions: itineraries.length,
    itineraries,
    priceRange: {
      minMinor: Math.min(...itineraries.map((i) => i.totalMinor)),
      maxMinor: Math.max(...itineraries.map((i) => i.totalMinor)),
      currency: "PKR",
    },
    durationRange: {
      minMinutes: Math.min(...itineraries.map((i) => i.durationMinutes)),
      maxMinutes: Math.max(...itineraries.map((i) => i.durationMinutes)),
    },
  };
}

// ---------------------------------------------------------------------------
// Map every search (original 5 + generated 30) → FlightOffer[] system shape.
// ---------------------------------------------------------------------------

/** Strip the Galileo-only keys; keep exactly what `FlightSegment` declares. */
function toSystemSegment(s) {
  return {
    carrier: s.carrier,
    flightNumber: `${s.carrier}${s.flightNumber}`,
    aircraft: s.aircraft ?? null,
    originCode: s.originCode,
    destinationCode: s.destinationCode,
    departureDate: s.departureDate,
    departTimeLocal: s.departTimeLocal,
    arrivalDate: s.arrivalDate,
    arriveTimeLocal: s.arriveTimeLocal,
    durationMinutes: s.durationMinutes ?? null,
    ...(s.layoverMinutesAfter ? { layoverMinutesAfter: s.layoverMinutesAfter } : {}),
  };
}

const cityOf = (code) => (AIRPORT_META[code] || d.airports[code] || {}).city || code;

/** Branded-fare label by cabin — what Travelport's brandName carries. */
const BRAND_BY_CABIN = {
  economy: "Economy Saver",
  premium: "Premium Flex",
  business: "Business Saver",
};

/**
 * Fare metadata the detail modal and checkout render (baggage, rules, price
 * breakdown). `fareBasis` and `bookingClass` are the REAL captured values on
 * the 5 terminal searches; the tax split is modelled, not captured — Galileo's
 * FS screen prints a tax-inclusive total only, so base/tax are derived at a
 * flat ratio rather than invented per-itinerary.
 */
function buildFareMetadata(it, outbound) {
  const cabin = it.cabin || "economy";
  const total = it.totalMinor;
  // Long-haul ex-PK fares run roughly 55/45 base-to-tax; short Gulf hops are
  // more base-heavy. Split on journey length as a stand-in for a real filing.
  const baseRatio = it.durationMinutes > 600 ? 0.56 : 0.72;
  const baseMinor = Math.round((total * baseRatio) / 100) * 100;

  return {
    brandName: BRAND_BY_CABIN[cabin],
    fareBasisCode: it.fareBasis,
    bookingClass: outbound[0]?.bookingClass,
    fareType: it.refundable ? "Refundable" : "Instant Purchase",
    validatingCarrier: it.validatingCarrier,
    baggageAllowance: {
      carryOn: { included: true, pieces: 1, weightKg: cabin === "economy" ? 7 : 10 },
      checked: { included: true, pieces: cabin === "business" ? 2 : 1, weightKg: it.baggageKg },
    },
    fareRulesSummary: {
      changes: it.refundable
        ? "Changes permitted, fare difference may apply"
        : "Changes permitted with penalty",
      cancellation: it.refundable ? "Cancellation permitted" : "Cancellation not permitted",
      refund: it.refundable ? "Refundable to original form of payment" : "Non-refundable",
      noShow: "No-show forfeits the fare",
    },
    supplierPriceBreakdown: {
      currency: "PKR",
      baseMinor,
      taxesMinor: total - baseMinor,
      feesMinor: 0,
      totalMinor: total,
    },
    // Search-only: a demo fare is never revalidated against a live supplier.
    validationStatus: "search_only",
  };
}

function toSystemOffers(search) {
  const out = [];
  for (const it of search.itineraries) {
    // Round-trip captures use outbound/inbound; generated ones use segments.
    const outbound = it.segments || it.outbound || [];
    const inbound = it.returnSegments || it.inbound;
    if (outbound.length === 0) continue;

    const first = outbound[0];
    const last = outbound[outbound.length - 1];
    const carrier = it.validatingCarrier || first.carrier;

    out.push({
      id: `DEMO-${search.id.toUpperCase()}-${String(it.option).padStart(2, "0")}`,
      type: "flight",
      supplier: "Travelport",
      supplierOfferSnapshotId: it.supplierOfferSnapshotId,
      snapshotExpiresAt: it.snapshotExpiresAt,
      origin: cityOf(search.origin),
      originCode: search.origin,
      destination: cityOf(search.destination),
      destinationCode: search.destination,
      airline: CARRIERS[carrier] || d.carriers[carrier] || carrier,
      cabin: it.cabin || search.cabin || "economy",
      stops: it.stops ?? outbound.length - 1,
      durationMinutes: it.durationMinutes,
      departTimeLocal: first.departTimeLocal,
      arriveTimeLocal: last.arriveTimeLocal,
      departureDate: first.departureDate,
      flightNumber: `${first.carrier}${first.flightNumber}`,
      aircraft: first.aircraft || undefined,
      segments: outbound.map(toSystemSegment),
      ...(inbound && inbound.length
        ? {
            returnSegments: inbound.map(toSystemSegment),
            returnStops: it.returnStops ?? inbound.length - 1,
            returnDurationMinutes: it.returnDurationMinutes,
            returnDate: inbound[0].departureDate,
          }
        : {}),
      netFare: { amount: it.totalMinor, currency: "PKR" },
      marketPrice: { amount: it.marketPriceMinor ?? it.totalMinor, currency: "PKR" },
      refundable: it.refundable,
      baggageKg: it.baggageKg,
      unitsLeft: it.seatsRemaining,
      fareMetadata: buildFareMetadata(it, outbound),
      tags: [
        it.stops === 0 ? "nonstop" : "connection",
        it.cabin || search.cabin || "economy",
        it.angle || "best_value",
        ...(it.via || []).map((v) => `via-${v.toLowerCase()}`),
      ],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

const generated = SPECS.map(buildSearch);

// English queries for the 5 original terminal captures, so every search has one.
const ORIGINAL_QUERIES = {
  "lhe-jfk-14oct": "Find me flights from Lahore to New York on 14 October",
  "lhe-bos-rt-14oct": "Lahore to Boston return, departing 14 October coming back 28 October",
  "lhe-cdg-14oct": "Lahore to Paris on 14 October",
  "lhe-mxp-14oct": "Show me Lahore to Milan flights on 14 October",
  "lhe-jfk-biz-14oct": "Business class Lahore to New York on 14 October",
};
for (const s of d.searches) {
  if (!s.query && ORIGINAL_QUERIES[s.id]) s.query = ORIGINAL_QUERIES[s.id];
  if (s.generated === undefined) s.generated = false;
  // The captures never carried a search-level cabin; without it the `.JC`
  // business screen reports as economy in the query index.
  if (!s.cabin) s.cabin = s.itineraries[0]?.cabin || "economy";
}

d.searches = [...d.searches, ...generated];

// Merge reference tables.
for (const [code, meta] of Object.entries(AIRPORT_META)) {
  if (!d.airports[code]) d.airports[code] = meta;
}
for (const [code, name] of Object.entries(CARRIERS)) {
  if (!d.carriers[code]) d.carriers[code] = name;
}
d.airports = Object.fromEntries(Object.entries(d.airports).sort());
d.carriers = Object.fromEntries(Object.entries(d.carriers).sort());

// Flat, ready-to-serve offer list in exact FlightOffer shape.
d.systemOffers = d.searches.flatMap(toSystemOffers);

// Query index: english → search id, for the demo resolver.
// Offer ids are matched EXACTLY against this search's own option numbers —
// a `startsWith` prefix match makes `lhe-lhr-18oct` swallow the offers of
// `lhe-lhr-18oct-business` and `-rt`, inflating every economy count.
d.queries = d.searches.map((s) => {
  const ownIds = new Set(
    s.itineraries.map((it) => `DEMO-${s.id.toUpperCase()}-${String(it.option).padStart(2, "0")}`),
  );
  const own = d.systemOffers.filter((o) => ownIds.has(o.id));
  const searchCabin = s.cabin || "economy";
  return {
    query: s.query,
    searchId: s.id,
    origin: s.origin,
    destination: s.destination,
    departureDate: s.departureDate,
    ...(s.returnDate ? { returnDate: s.returnDate } : {}),
    cabin: searchCabin,
    // A `.JC` screen can return a premium-economy option among the business
    // fares, so count only what a search for THIS cabin actually serves —
    // `own.length` would over-promise by including the off-cabin rows.
    offers: own.filter((o) => o.cabin === searchCabin).length,
    ...(own.length !== own.filter((o) => o.cabin === searchCabin).length
      ? { otherCabinOffers: own.length - own.filter((o) => o.cabin === searchCabin).length }
      : {}),
  };
});

d.$meta.provenance = {
  captured: "searches[].generated === false — transcribed from Travelport Smartpoint FS screens. Prices real but historical.",
  generated: "searches[].generated === true — SYNTHETIC. Routes, carriers and hubs are real markets; times are computed from a fixed sector-minutes table plus UTC offsets; prices are plausible PKR ranges, NOT supplier quotes. Never present these as live fares.",
};
d.$meta.systemOffers = "Flat FlightOffer[] (see client/lib/inventory/types.ts) built from every search. netFare/marketPrice are Money in PKR minor units.";
d.$meta.dataIntegrity.searches = d.searches.length;
d.$meta.dataIntegrity.generatedSearches = generated.length;
d.$meta.dataIntegrity.systemOffers = d.systemOffers.length;
d.$meta.dataIntegrity.enrichedAt = "2026-09-23";

fs.writeFileSync(FILE, `${JSON.stringify(d, null, 2)}\n`);

console.log(`searches: ${d.searches.length} (${generated.length} generated)`);
console.log(`systemOffers: ${d.systemOffers.length}`);
console.log(`airports: ${Object.keys(d.airports).length}  carriers: ${Object.keys(d.carriers).length}`);
