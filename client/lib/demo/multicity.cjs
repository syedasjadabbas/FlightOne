/**
 * Adds multi-city / open-jaw demo journeys to galileo-fares.json.
 *
 * A multi-city ask is decomposed by the planner into N INDEPENDENT leg
 * searches (see lib/ask-ai/multiCity.ts), each hitting
 * searchFlightsPreferredThenOpen on its own. So a journey is only demoable if
 * EVERY constituent leg exists in the corpus as its own searchable entry —
 * this script emits both the journey record and each missing leg.
 *
 * Run AFTER expand.cjs: node lib/demo/multicity.cjs
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "galileo-fares.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf8"));

if (!Array.isArray(d.searches) || d.searches.length === 0) {
  throw new Error("Run expand.cjs first — no searches found");
}
if (d.journeys) {
  throw new Error("Journeys already present — re-run expand.cjs from a clean file first");
}

const TZ = {
  LHE: 5, KHI: 5, ISB: 5, SKT: 5, MUX: 5, PEW: 5, TAS: 5,
  AUH: 4, DXB: 4, SHJ: 4, DOH: 3, BAH: 3, RUH: 3, JED: 3, MED: 3,
  IST: 3, CAI: 2, CMN: 1, CDG: 2, MXP: 2, FCO: 2, AMS: 2, BCN: 2,
  FRA: 2, MUC: 2, ZRH: 2, VIE: 2, PRG: 2, ATH: 2, LIS: 1,
  LHR: 1, LGW: 1, MAN: 1, BHX: 1, EDI: 1, DUB: 1,
  JFK: -5, EWR: -5, BOS: -5, MIA: -5, MCO: -5, IAD: -5, ORD: -6,
  YYZ: -5, YVR: -8, SFO: -8, OAK: -8, SEA: -8, LAX: -8, LAS: -8,
  BKK: 7, KUL: 8, SIN: 8, HKG: 8, PEK: 8, PVG: 8, NRT: 9, ICN: 9,
  DPS: 8, CMB: 5.5, MLE: 5, DEL: 5.5, BOM: 5.5, SYD: 11, MEL: 11,
  AKL: 13, JNB: 2, NBO: 3, CPT: 2,
};

const AIRPORT_META = {
  VIE: { city: "Vienna", country: "AT" }, PRG: { city: "Prague", country: "CZ" },
  ATH: { city: "Athens", country: "GR" }, LIS: { city: "Lisbon", country: "PT" },
  EDI: { city: "Edinburgh", country: "GB" }, DUB: { city: "Dublin", country: "IE" },
  YVR: { city: "Vancouver", country: "CA" }, LAS: { city: "Las Vegas", country: "US" },
  MEL: { city: "Melbourne", country: "AU" }, AKL: { city: "Auckland", country: "NZ" },
  JNB: { city: "Johannesburg", country: "ZA" }, NBO: { city: "Nairobi", country: "KE" },
  CPT: { city: "Cape Town", country: "ZA" }, EWR: { city: "New York", country: "US" },
};

const CARRIERS = {
  EK: "Emirates", EY: "Etihad", QR: "Qatar Airways", TK: "Turkish Airlines",
  SV: "Saudia", PK: "PIA", GF: "Gulf Air", TG: "Thai Airways",
  SQ: "Singapore Airlines", MH: "Malaysia Airlines", CX: "Cathay Pacific",
  UL: "SriLankan", WY: "Oman Air", BA: "British Airways", LH: "Lufthansa",
  AF: "Air France", KL: "KLM", QF: "Qantas", ET: "Ethiopian Airlines",
};

const HUB = {
  EK: "DXB", EY: "AUH", QR: "DOH", TK: "IST", SV: "JED", GF: "BAH",
  TG: "BKK", SQ: "SIN", MH: "KUL", CX: "HKG", UL: "CMB", BA: "LHR",
  LH: "FRA", AF: "CDG", KL: "AMS", QF: "SYD", ET: "ADD", PK: null,
};

/** Nominal sector minutes. Extends expand.cjs for the new city pairs. */
const SECTOR = {
  "LHE-DXB": 200, "LHE-AUH": 200, "LHE-DOH": 215, "LHE-IST": 375, "LHE-JED": 285,
  "ISB-DXB": 185, "ISB-DOH": 205, "ISB-IST": 350, "KHI-DXB": 140, "KHI-DOH": 155,
  "KHI-IST": 330, "KHI-AUH": 145,
  "DXB-LHR": 470, "DXB-CDG": 440, "DXB-FRA": 425, "DXB-AMS": 445, "DXB-MXP": 400,
  "DXB-FCO": 400, "DXB-BCN": 450, "DXB-ZRH": 415, "DXB-MUC": 410, "DXB-VIE": 395,
  "DXB-PRG": 420, "DXB-ATH": 330, "DXB-LIS": 500, "DXB-MAN": 465, "DXB-EDI": 480,
  "DXB-DUB": 490, "DXB-JFK": 855, "DXB-EWR": 855, "DXB-BOS": 800, "DXB-IAD": 855,
  "DXB-ORD": 900, "DXB-YYZ": 825, "DXB-YVR": 900, "DXB-SFO": 950, "DXB-LAX": 985,
  "DXB-SEA": 930, "DXB-BKK": 380, "DXB-SIN": 450, "DXB-KUL": 445, "DXB-HKG": 465,
  "DXB-NRT": 570, "DXB-ICN": 520, "DXB-PEK": 490, "DXB-DPS": 545, "DXB-MLE": 255,
  "DXB-SYD": 830, "DXB-MEL": 840, "DXB-JNB": 490, "DXB-NBO": 305, "DXB-CPT": 555,
  "DXB-DEL": 205, "DXB-BOM": 185, "DXB-CMB": 265, "DXB-CAI": 250, "DXB-MED": 200,
  "AUH-LHR": 475, "AUH-CDG": 445, "AUH-JFK": 860, "AUH-BKK": 375, "AUH-SIN": 445,
  "AUH-SYD": 825, "AUH-MLE": 250, "AUH-FRA": 430, "AUH-MAN": 470, "AUH-DEL": 210,
  "DOH-LHR": 445, "DOH-CDG": 420, "DOH-FRA": 400, "DOH-AMS": 420, "DOH-MXP": 380,
  "DOH-FCO": 375, "DOH-BCN": 425, "DOH-ZRH": 390, "DOH-MUC": 385, "DOH-VIE": 375,
  "DOH-ATH": 315, "DOH-LIS": 480, "DOH-MAN": 440, "DOH-EDI": 460, "DOH-DUB": 470,
  "DOH-JFK": 830, "DOH-EWR": 830, "DOH-BOS": 790, "DOH-IAD": 830, "DOH-ORD": 880,
  "DOH-YYZ": 800, "DOH-SFO": 960, "DOH-LAX": 960, "DOH-SEA": 920, "DOH-BKK": 400,
  "DOH-SIN": 465, "DOH-KUL": 460, "DOH-HKG": 490, "DOH-NRT": 590, "DOH-ICN": 540,
  "DOH-DPS": 560, "DOH-MLE": 275, "DOH-SYD": 850, "DOH-MEL": 860, "DOH-JNB": 505,
  "DOH-NBO": 320, "DOH-CPT": 570, "DOH-DEL": 235, "DOH-BOM": 205, "DOH-CMB": 285,
  "IST-LHR": 240, "IST-CDG": 205, "IST-FRA": 185, "IST-AMS": 220, "IST-MXP": 175,
  "IST-FCO": 160, "IST-BCN": 215, "IST-ZRH": 175, "IST-MUC": 165, "IST-VIE": 135,
  "IST-PRG": 150, "IST-ATH": 95, "IST-LIS": 285, "IST-MAN": 250, "IST-EDI": 265,
  "IST-DUB": 275, "IST-JFK": 620, "IST-EWR": 620, "IST-BOS": 585, "IST-IAD": 640,
  "IST-ORD": 680, "IST-YYZ": 630, "IST-SFO": 800, "IST-LAX": 810, "IST-SEA": 780,
  "IST-BKK": 560, "IST-SIN": 645, "IST-KUL": 640, "IST-HKG": 605, "IST-NRT": 700,
  "IST-ICN": 640, "IST-DPS": 700, "IST-MLE": 500, "IST-SYD": 1080, "IST-JNB": 585,
  "IST-NBO": 380, "IST-DEL": 400, "IST-BOM": 385, "IST-CMB": 545,
  "JED-LHR": 380, "JED-CDG": 350, "JED-IST": 215, "JED-MED": 65, "JED-CAI": 130,
  "BKK-SIN": 145, "BKK-KUL": 130, "BKK-HKG": 170, "BKK-DPS": 265, "BKK-NRT": 355,
  "BKK-ICN": 320, "BKK-SYD": 555, "BKK-MLE": 250, "BKK-CMB": 210,
  "SIN-KUL": 60, "SIN-DPS": 160, "SIN-HKG": 230, "SIN-NRT": 420, "SIN-SYD": 470,
  "SIN-MEL": 440, "SIN-AKL": 620, "SIN-CMB": 260,
  "KUL-DPS": 185, "KUL-HKG": 235, "KUL-SYD": 500,
  "HKG-NRT": 240, "HKG-ICN": 210, "HKG-SYD": 540, "HKG-PEK": 195,
  "NRT-ICN": 140, "NRT-SYD": 585, "NRT-LAX": 615, "NRT-SFO": 585,
  "SYD-MEL": 95, "SYD-AKL": 205, "MEL-AKL": 225,
  "LHR-CDG": 80, "LHR-AMS": 75, "LHR-FRA": 95, "LHR-MXP": 120, "LHR-FCO": 155,
  "LHR-BCN": 135, "LHR-ZRH": 100, "LHR-MUC": 115, "LHR-VIE": 145, "LHR-PRG": 125,
  "LHR-ATH": 225, "LHR-LIS": 165, "LHR-EDI": 80, "LHR-DUB": 85, "LHR-MAN": 70,
  "LHR-JFK": 445, "LHR-EWR": 450, "LHR-BOS": 420, "LHR-IAD": 470, "LHR-ORD": 520,
  "LHR-YYZ": 455, "LHR-SFO": 655, "LHR-LAX": 670, "LHR-SEA": 605, "LHR-JNB": 655,
  "CDG-AMS": 75, "CDG-FRA": 80, "CDG-MXP": 90, "CDG-FCO": 125, "CDG-BCN": 105,
  "CDG-ZRH": 75, "CDG-MUC": 85, "CDG-VIE": 110, "CDG-PRG": 100, "CDG-ATH": 195,
  "CDG-LIS": 150, "CDG-JFK": 460, "CDG-YYZ": 470,
  "AMS-FRA": 65, "AMS-MXP": 105, "AMS-BCN": 135, "AMS-JFK": 470,
  "FRA-MXP": 80, "FRA-FCO": 110, "FRA-BCN": 130, "FRA-ZRH": 55, "FRA-MUC": 55,
  "FRA-VIE": 80, "FRA-PRG": 65, "FRA-JFK": 490, "FRA-ORD": 545,
  "MXP-FCO": 70, "MXP-BCN": 105, "MXP-ZRH": 55, "MXP-VIE": 85,
  "FCO-BCN": 110, "FCO-ATH": 125, "FCO-VIE": 95,
  "BCN-LIS": 110, "BCN-ATH": 180,
  "JFK-BOS": 75, "JFK-IAD": 80, "JFK-ORD": 160, "JFK-MIA": 185, "JFK-MCO": 175,
  "JFK-LAX": 375, "JFK-SFO": 390, "JFK-SEA": 375, "JFK-YYZ": 100, "JFK-LAS": 350,
  "LAX-SFO": 95, "LAX-LAS": 70, "LAX-SEA": 165, "LAX-YVR": 175, "LAX-ORD": 245,
  "SFO-SEA": 125, "SFO-YVR": 135, "SFO-LAS": 95, "SFO-ORD": 260,
  "ORD-IAD": 105, "ORD-BOS": 140, "ORD-YYZ": 95, "ORD-MCO": 165,
  "YYZ-YVR": 305, "YYZ-BOS": 95, "YYZ-MIA": 200,
  "DEL-BOM": 130, "DEL-CMB": 215, "DEL-BKK": 260, "DEL-SIN": 335,
  "CMB-MLE": 90, "CMB-BKK": 210,
  "CAI-MED": 150, "CAI-IST": 130, "MED-JED": 65,
  "JNB-CPT": 125, "JNB-NBO": 235, "NBO-CPT": 300,
};

const sectorMinutes = (a, b) => SECTOR[`${a}-${b}`] || SECTOR[`${b}-${a}`] || 320;

const utc = (dateISO, hhmm, iata) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Date.parse(`${dateISO}T00:00:00Z`) + (h * 60 + m - TZ[iata] * 60) * 60000;
};

const hhmm = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

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

const FLEET = ["77W", "788", "789", "32A", "321", "359", "35K", "773", "738", "333"];
const RBD_ECON = ["T", "L", "V", "Q", "K", "H", "N"];
const RBD_BIZ = ["J", "C", "D", "I"];
const BRAND_BY_CABIN = {
  economy: "Economy Saver",
  premium: "Premium Flex",
  business: "Business Saver",
};

function makeSegment(seq, carrier, flightNumber, rbd, from, to, depDateISO, depHHMM, mins, aircraft) {
  const depUtc = utc(depDateISO, depHHMM, from);
  const arrUtc = depUtc + mins * 60000;
  const arrLocalMs = arrUtc + TZ[to] * 3600000;
  const arrDate = new Date(arrLocalMs).toISOString().slice(0, 10);
  const arrHHMM = new Date(arrLocalMs).toISOString().slice(11, 16);
  return {
    seg: {
      seq,
      carrier,
      // Unprefixed, matching expand.cjs — toSystemOffers applies the carrier.
      flightNumber,
      bookingClass: rbd,
      departureDate: depDateISO,
      originCode: from,
      destinationCode: to,
      departTimeLocal: depHHMM,
      arriveTimeLocal: arrHHMM,
      ...(arrDate !== depDateISO ? { arrivesNextDay: true } : {}),
      aircraft,
      arrivalDate: arrDate,
      durationMinutes: mins,
    },
    arrUtc,
  };
}

/** Builds one searchable leg (same schema expand.cjs emits). */
function buildLeg({ origin, destination, date, cabin, carriers, lo, hi, query }) {
  const r = rng(`${origin}${destination}${date}${cabin}`);
  const isBiz = cabin === "business";
  const isPrem = cabin === "premium";
  const itineraries = [];

  carriers.forEach((carrier, idx) => {
    const hub = HUB[carrier];
    const direct = !hub || hub === destination || hub === origin || !TZ[hub];
    const depHHMM = hhmm(between(r, 1, 22) * 60 + pick(r, [0, 10, 15, 20, 30, 40, 45, 50]));
    const rbd = pick(r, isBiz || isPrem ? RBD_BIZ : RBD_ECON);
    const aircraft = pick(r, FLEET);

    let segments;
    let via = [];
    if (direct) {
      segments = [
        makeSegment(1, carrier, String(between(r, 100, 899)), rbd, origin, destination, date, depHHMM, sectorMinutes(origin, destination), aircraft).seg,
      ];
    } else {
      const a = makeSegment(1, carrier, String(between(r, 100, 899)), rbd, origin, hub, date, depHHMM, sectorMinutes(origin, hub), aircraft);
      const layover = between(r, 80, 300);
      const dep2Ms = a.arrUtc + layover * 60000 + TZ[hub] * 3600000;
      const b = makeSegment(
        2, carrier, String(between(r, 1, 99)), rbd, hub, destination,
        new Date(dep2Ms).toISOString().slice(0, 10),
        new Date(dep2Ms).toISOString().slice(11, 16),
        sectorMinutes(hub, destination), pick(r, FLEET),
      );
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
    const span = hi - lo;
    const totalMinor =
      Math.round((lo + (span * idx) / Math.max(1, carriers.length - 1)) / 100) * 100;

    itineraries.push({
      option: idx + 1,
      totalMinor,
      totalFormatted: `PKR ${(totalMinor / 100).toLocaleString("en-US")}`,
      fareBasis: `${rbd}${isBiz ? "BIZ" : isPrem ? "PRM" : "LOW"}${between(r, 10, 99)}PK`,
      dayOffset: Math.max(
        0,
        Math.round((Date.parse(`${last.arrivalDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000),
      ),
      via,
      segments,
      durationMinutes: totalMinutes,
      stops: segments.length - 1,
      maxLayoverMinutes: Math.max(0, ...segments.map((s) => s.layoverMinutesAfter || 0)),
      cabin,
      baggageKg: isBiz ? 40 : isPrem ? 35 : carrier === "PK" ? 40 : 30,
      refundable: isBiz,
      checkedBagIncluded: true,
      construction: "single_ticket",
      marketingCarriers: [carrier],
      validatingCarrier: carrier,
      seatsRemaining: between(r, 2, 9),
      supplierOfferSnapshotId: `snap_demo_${origin.toLowerCase()}-${destination.toLowerCase()}-${date.slice(5).replace("-", "")}${cabin[0]}_${String(idx + 1).padStart(2, "0")}`,
      snapshotExpiresAt: "2026-12-31T23:59:59.000Z",
    });
  });

  const cheapest = itineraries.reduce((a, b) => (b.totalMinor < a.totalMinor ? b : a));
  const fastest = itineraries.reduce((a, b) => (b.durationMinutes < a.durationMinutes ? b : a));
  const maxPrice = Math.max(...itineraries.map((i) => i.totalMinor));
  for (const it of itineraries) {
    it.angle = it === cheapest ? "cheapest" : it === fastest ? "fastest" : "best_value";
    it.marketPriceMinor = Math.round((maxPrice * 1.08) / 100) * 100;
    it.savingsPct = Math.round((1 - it.totalMinor / it.marketPriceMinor) * 100);
    it.score = Math.max(60, Math.min(98,
      98 - Math.round(((it.totalMinor - cheapest.totalMinor) / Math.max(1, maxPrice - cheapest.totalMinor)) * 20) -
      Math.round((it.durationMinutes - fastest.durationMinutes) / 60)));
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

  const monthTag = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][
    Number(date.slice(5, 7))
  ];

  return {
    id: `${origin.toLowerCase()}-${destination.toLowerCase()}-${date.slice(8)}${monthTag}${cabin === "economy" ? "" : `-${cabin}`}`,
    command: `FS${origin}${date.slice(8)}${monthTag.toUpperCase()}${destination}${cabin === "business" ? ".JC" : cabin === "premium" ? ".JS" : ""}`,
    query,
    origin,
    destination,
    originCity: cityOf(origin),
    destinationCity: cityOf(destination),
    departureDate: date,
    tripType: "one_way",
    cabin,
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

function cityOf(code) {
  return (AIRPORT_META[code] || d.airports[code] || {}).city || code;
}

// --- FlightOffer mapping (mirrors expand.cjs; kept in sync by shape tests) ---

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

function buildFareMetadata(it, outbound) {
  const cabin = it.cabin || "economy";
  const total = it.totalMinor;
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
    validationStatus: "search_only",
  };
}

function toSystemOffers(search) {
  const out = [];
  for (const it of search.itineraries) {
    const outbound = it.segments || [];
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
// Multi-city journeys. Each `legs` entry becomes its own searchable leg.
// ---------------------------------------------------------------------------

const C_EU = ["EK", "QR", "TK"];
const C_US = ["QR", "TK", "EK"];
const C_ASIA = ["EK", "QR", "SQ"];
const C_SHORT = ["EK", "PK", "EY"];
const EU_SHORT = ["BA", "LH", "AF"];
const US_DOM = ["BA", "QR"];

/** Fare band per leg type, PKR minor. */
const BAND = {
  gulf: [6000000, 11000000],
  euLong: [17000000, 27000000],
  usLong: [24000000, 39000000],
  asiaLong: [11000000, 21000000],
  euShort: [3500000, 7000000],
  usDom: [4500000, 9000000],
  asiaShort: [3000000, 6500000],
};

/**
 * Second route for each "leaf" city — one reachable from only a single other
 * city (or, like BOS, from none on a one-way basis). A leaf cannot be reached
 * via ANY intermediate, so arbitrary pairs involving it return nothing no
 * matter how good the fallback logic is. This is the data half of that fix.
 */
const LEAF_ROUTES = [
  { origin: "DXB", destination: "AMS", date: "2026-11-08", carriers: ["EK", "KL"], band: "euLong" },
  { origin: "LHE", destination: "BOS", date: "2026-11-09", carriers: ["QR", "TK", "EK"], band: "usLong" },
  { origin: "DXB", destination: "BOS", date: "2026-11-21", carriers: ["EK", "QR"], band: "usLong" },
  { origin: "ISB", destination: "DOH", date: "2026-11-10", carriers: ["QR", "PK"], band: "gulf" },
  { origin: "KHI", destination: "DPS", date: "2026-11-11", carriers: ["EK", "QR", "MH"], band: "asiaLong" },
  { origin: "ISB", destination: "KUL", date: "2026-11-12", carriers: ["MH", "QR", "EK"], band: "asiaLong" },
  { origin: "KHI", destination: "LAX", date: "2026-11-13", carriers: ["QR", "EK", "TK"], band: "usLong" },
  { origin: "ISB", destination: "MCO", date: "2026-11-14", carriers: ["QR", "TK"], band: "usLong" },
  { origin: "ISB", destination: "MXP", date: "2026-11-15", carriers: ["QR", "TK", "EK"], band: "euLong" },
  { origin: "KHI", destination: "AMS", date: "2026-11-16", carriers: ["EK", "QR", "KL"], band: "euLong" },
  { origin: "DXB", destination: "MXP", date: "2026-11-22", carriers: ["EK", "QR"], band: "euLong" },
  { origin: "DXB", destination: "KUL", date: "2026-11-23", carriers: ["EK", "MH"], band: "asiaLong" },
];

const JOURNEYS = [
  {
    id: "eurotrip-3city",
    query: "Multi-city: Lahore to London on 5 November, London to Paris on 9 November, Paris back to Lahore on 14 November",
    label: "Lahore → London → Paris → Lahore",
    legs: [
      { origin: "LHE", destination: "LHR", date: "2026-11-05", carriers: C_EU, band: "euLong" },
      { origin: "LHR", destination: "CDG", date: "2026-11-09", carriers: EU_SHORT, band: "euShort" },
      { origin: "CDG", destination: "LHE", date: "2026-11-14", carriers: C_EU, band: "euLong" },
    ],
  },
  {
    id: "italy-swiss",
    query: "Multi-city: Lahore to Rome 6 November, Rome to Zurich 10 November, Zurich to Lahore 15 November",
    label: "Lahore → Rome → Zurich → Lahore",
    legs: [
      { origin: "LHE", destination: "FCO", date: "2026-11-06", carriers: C_EU, band: "euLong" },
      { origin: "FCO", destination: "ZRH", date: "2026-11-10", carriers: EU_SHORT, band: "euShort" },
      { origin: "ZRH", destination: "LHE", date: "2026-11-15", carriers: C_EU, band: "euLong" },
    ],
  },
  {
    id: "openjaw-lhr-man",
    query: "Open jaw: fly Lahore to London on 7 November and return from Manchester on 18 November",
    label: "Lahore → London, Manchester → Lahore",
    legs: [
      { origin: "LHE", destination: "LHR", date: "2026-11-07", carriers: C_EU, band: "euLong" },
      { origin: "MAN", destination: "LHE", date: "2026-11-18", carriers: C_EU, band: "euLong" },
    ],
  },
  {
    id: "usa-coast-to-coast",
    query: "Multi-city: Lahore to New York 8 November, New York to San Francisco 13 November, San Francisco to Lahore 20 November",
    label: "Lahore → New York → San Francisco → Lahore",
    legs: [
      { origin: "LHE", destination: "JFK", date: "2026-11-08", carriers: C_US, band: "usLong" },
      { origin: "JFK", destination: "SFO", date: "2026-11-13", carriers: US_DOM, band: "usDom" },
      { origin: "SFO", destination: "LHE", date: "2026-11-20", carriers: C_US, band: "usLong" },
    ],
  },
  {
    id: "usa-east-chicago",
    query: "Multi-city: Karachi to Washington 9 November, Washington to Chicago 14 November, Chicago to Karachi 19 November",
    label: "Karachi → Washington → Chicago → Karachi",
    legs: [
      { origin: "KHI", destination: "IAD", date: "2026-11-09", carriers: C_US, band: "usLong" },
      { origin: "IAD", destination: "ORD", date: "2026-11-14", carriers: US_DOM, band: "usDom" },
      { origin: "ORD", destination: "KHI", date: "2026-11-19", carriers: C_US, band: "usLong" },
    ],
  },
  {
    id: "asia-triangle",
    query: "Multi-city: Lahore to Bangkok 10 November, Bangkok to Singapore 15 November, Singapore to Lahore 20 November",
    label: "Lahore → Bangkok → Singapore → Lahore",
    legs: [
      { origin: "LHE", destination: "BKK", date: "2026-11-10", carriers: C_ASIA, band: "asiaLong" },
      { origin: "BKK", destination: "SIN", date: "2026-11-15", carriers: ["TG", "SQ", "MH"], band: "asiaShort" },
      { origin: "SIN", destination: "LHE", date: "2026-11-20", carriers: C_ASIA, band: "asiaLong" },
    ],
  },
  {
    id: "far-east-4city",
    query: "Multi-city: Lahore to Hong Kong 11 November, Hong Kong to Tokyo 16 November, Tokyo to Seoul 20 November, Seoul to Lahore 24 November",
    label: "Lahore → Hong Kong → Tokyo → Seoul → Lahore",
    legs: [
      { origin: "LHE", destination: "HKG", date: "2026-11-11", carriers: ["CX", "EK", "QR"], band: "asiaLong" },
      { origin: "HKG", destination: "NRT", date: "2026-11-16", carriers: ["CX", "SQ"], band: "asiaShort" },
      { origin: "NRT", destination: "ICN", date: "2026-11-20", carriers: ["CX", "SQ"], band: "asiaShort" },
      { origin: "ICN", destination: "LHE", date: "2026-11-24", carriers: C_ASIA, band: "asiaLong" },
    ],
  },
  {
    id: "umrah-then-dubai",
    query: "Multi-city: Karachi to Jeddah 12 November, Jeddah to Madinah 16 November, Madinah to Dubai 20 November, Dubai to Karachi 23 November",
    label: "Karachi → Jeddah → Madinah → Dubai → Karachi",
    legs: [
      { origin: "KHI", destination: "JED", date: "2026-11-12", carriers: ["SV", "PK", "EK"], band: "gulf" },
      { origin: "JED", destination: "MED", date: "2026-11-16", carriers: ["SV"], band: "asiaShort" },
      { origin: "MED", destination: "DXB", date: "2026-11-20", carriers: ["SV", "EK"], band: "gulf" },
      { origin: "DXB", destination: "KHI", date: "2026-11-23", carriers: C_SHORT, band: "gulf" },
    ],
  },
  {
    id: "business-europe",
    query: "Multi-city business class: Lahore to Frankfurt 13 November, Frankfurt to Vienna 17 November, Vienna to Lahore 21 November",
    label: "Lahore → Frankfurt → Vienna → Lahore (business)",
    cabin: "business",
    legs: [
      { origin: "LHE", destination: "FRA", date: "2026-11-13", carriers: ["EK", "QR", "LH"], band: "euLong", scale: 3.4 },
      { origin: "FRA", destination: "VIE", date: "2026-11-17", carriers: ["LH", "BA"], band: "euShort", scale: 3.4 },
      { origin: "VIE", destination: "LHE", date: "2026-11-21", carriers: ["EK", "QR", "TK"], band: "euLong", scale: 3.4 },
    ],
  },
  {
    id: "australia-stopover",
    query: "Multi-city: Lahore to Dubai 14 November, Dubai to Sydney 17 November, Sydney to Melbourne 22 November, Melbourne to Lahore 26 November",
    label: "Lahore → Dubai → Sydney → Melbourne → Lahore",
    legs: [
      { origin: "LHE", destination: "DXB", date: "2026-11-14", carriers: C_SHORT, band: "gulf" },
      { origin: "DXB", destination: "SYD", date: "2026-11-17", carriers: ["EK", "QF"], band: "usLong" },
      { origin: "SYD", destination: "MEL", date: "2026-11-22", carriers: ["QF"], band: "asiaShort" },
      { origin: "MEL", destination: "LHE", date: "2026-11-26", carriers: ["EK", "QR"], band: "usLong" },
    ],
  },
  {
    id: "africa-safari",
    query: "Multi-city: Lahore to Nairobi 15 November, Nairobi to Johannesburg 20 November, Johannesburg to Lahore 25 November",
    label: "Lahore → Nairobi → Johannesburg → Lahore",
    legs: [
      { origin: "LHE", destination: "NBO", date: "2026-11-15", carriers: ["QR", "EK", "ET"], band: "asiaLong" },
      { origin: "NBO", destination: "JNB", date: "2026-11-20", carriers: ["ET", "QR"], band: "asiaShort" },
      { origin: "JNB", destination: "LHE", date: "2026-11-25", carriers: ["QR", "EK"], band: "asiaLong" },
    ],
  },
  {
    id: "scandinavia-iberia",
    query: "Multi-city: Islamabad to Barcelona 16 November, Barcelona to Lisbon 20 November, Lisbon to Islamabad 25 November",
    label: "Islamabad → Barcelona → Lisbon → Islamabad",
    legs: [
      { origin: "ISB", destination: "BCN", date: "2026-11-16", carriers: C_EU, band: "euLong" },
      { origin: "BCN", destination: "LIS", date: "2026-11-20", carriers: EU_SHORT, band: "euShort" },
      { origin: "LIS", destination: "ISB", date: "2026-11-25", carriers: C_EU, band: "euLong" },
    ],
  },
  {
    id: "canada-west",
    query: "Multi-city: Lahore to Toronto 17 November, Toronto to Vancouver 22 November, Vancouver to Lahore 27 November",
    label: "Lahore → Toronto → Vancouver → Lahore",
    legs: [
      { origin: "LHE", destination: "YYZ", date: "2026-11-17", carriers: C_US, band: "usLong" },
      { origin: "YYZ", destination: "YVR", date: "2026-11-22", carriers: US_DOM, band: "usDom" },
      { origin: "YVR", destination: "LHE", date: "2026-11-27", carriers: C_US, band: "usLong" },
    ],
  },
  {
    id: "island-hop",
    query: "Multi-city: Lahore to Maldives 18 November, Maldives to Colombo 22 November, Colombo to Lahore 26 November",
    label: "Lahore → Maldives → Colombo → Lahore",
    legs: [
      { origin: "LHE", destination: "MLE", date: "2026-11-18", carriers: ["EK", "QR", "UL"], band: "asiaLong" },
      { origin: "MLE", destination: "CMB", date: "2026-11-22", carriers: ["UL"], band: "asiaShort" },
      { origin: "CMB", destination: "LHE", date: "2026-11-26", carriers: ["UL", "EK", "QR"], band: "asiaLong" },
    ],
  },
  {
    id: "uk-ireland",
    query: "Multi-city: Sialkot to Manchester 19 November, Manchester to Dublin 23 November, Dublin to Sialkot 28 November",
    label: "Sialkot → Manchester → Dublin → Sialkot",
    legs: [
      { origin: "SKT", destination: "MAN", date: "2026-11-19", carriers: ["EK", "QR"], band: "euLong" },
      { origin: "MAN", destination: "DUB", date: "2026-11-23", carriers: ["BA"], band: "euShort" },
      { origin: "DUB", destination: "SKT", date: "2026-11-28", carriers: ["EK", "QR"], band: "euLong" },
    ],
  },
];

// ---------------------------------------------------------------------------

const existing = new Set(
  d.searches.map((s) => `${s.origin}|${s.destination}|${s.departureDate}|${s.cabin || "economy"}|${s.tripType}`),
);

const newSearches = [];
const journeys = [];

for (const leaf of LEAF_ROUTES) {
  const key = `${leaf.origin}|${leaf.destination}|${leaf.date}|economy|one_way`;
  if (existing.has(key)) continue;
  const [lo, hi] = BAND[leaf.band];
  existing.add(key);
  newSearches.push(
    buildLeg({
      origin: leaf.origin,
      destination: leaf.destination,
      date: leaf.date,
      cabin: "economy",
      carriers: leaf.carriers,
      lo,
      hi,
      query: `${cityOf(leaf.origin)} to ${cityOf(leaf.destination)} on ${new Date(`${leaf.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`,
    }),
  );
}

for (const j of JOURNEYS) {
  const cabin = j.cabin || "economy";
  const legRefs = [];

  for (const leg of j.legs) {
    const [lo0, hi0] = BAND[leg.band];
    const scale = leg.scale ?? 1;
    const lo = Math.round(lo0 * scale);
    const hi = Math.round(hi0 * scale);
    const key = `${leg.origin}|${leg.destination}|${leg.date}|${cabin}|one_way`;

    const built = buildLeg({
      origin: leg.origin,
      destination: leg.destination,
      date: leg.date,
      cabin,
      carriers: leg.carriers,
      lo,
      hi,
      query: `${cityOf(leg.origin)} to ${cityOf(leg.destination)} on ${new Date(`${leg.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`,
    });

    legRefs.push({
      searchId: built.id,
      origin: leg.origin,
      destination: leg.destination,
      departureDate: leg.date,
    });

    // Only emit a leg that is not already searchable, so a journey never
    // shadows a captured search with a generated one.
    if (!existing.has(key)) {
      existing.add(key);
      newSearches.push(built);
    }
  }

  journeys.push({
    id: j.id,
    query: j.query,
    label: j.label,
    tripType: "multi_city",
    cabin,
    legCount: j.legs.length,
    legs: legRefs,
  });
}

d.searches = [...d.searches, ...newSearches];

for (const [code, meta] of Object.entries(AIRPORT_META)) {
  if (!d.airports[code]) d.airports[code] = meta;
}
for (const [code, name] of Object.entries(CARRIERS)) {
  if (!d.carriers[code]) d.carriers[code] = name;
}
d.airports = Object.fromEntries(Object.entries(d.airports).sort());
d.carriers = Object.fromEntries(Object.entries(d.carriers).sort());

const added = newSearches.flatMap(toSystemOffers);
d.systemOffers = [...d.systemOffers, ...added];

for (const s of newSearches) {
  const ownIds = new Set(
    s.itineraries.map(
      (it) => `DEMO-${s.id.toUpperCase()}-${String(it.option).padStart(2, "0")}`,
    ),
  );
  const own = d.systemOffers.filter((o) => ownIds.has(o.id));
  d.queries.push({
    query: s.query,
    searchId: s.id,
    origin: s.origin,
    destination: s.destination,
    departureDate: s.departureDate,
    cabin: s.cabin,
    offers: own.filter((o) => o.cabin === s.cabin).length,
  });
}

d.journeys = journeys;
d.$meta.journeys =
  "Multi-city / open-jaw demo asks. The planner splits these into independent per-leg searches, so every `legs[].searchId` also exists in `searches[]`.";
d.$meta.dataIntegrity.searches = d.searches.length;
d.$meta.dataIntegrity.systemOffers = d.systemOffers.length;
d.$meta.dataIntegrity.journeys = journeys.length;
d.$meta.dataIntegrity.leafRoutes = LEAF_ROUTES.length;

fs.writeFileSync(FILE, `${JSON.stringify(d, null, 2)}\n`);

console.log(`journeys:      ${journeys.length}`);
console.log(`new legs:      ${newSearches.length}`);
console.log(`searches:      ${d.searches.length}`);
console.log(`systemOffers:  ${d.systemOffers.length}`);
console.log(`queries:       ${d.queries.length} (+ ${journeys.length} journeys)`);
