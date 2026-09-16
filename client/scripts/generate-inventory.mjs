/**
 * Deterministic generator for the seed inventory (600 offers: 336 flights,
 * 192 hotels, 72 packages).
 *
 * We intentionally do NOT scrape Booking.com / Trip.com (their ToS forbid it and
 * the data would be unstable). Instead we synthesize realistic, well-shaped
 * records over real city pairs, airlines and hotel brands, with plausible USD
 * fares. Crucially, `marketPrice` is set so that for SOME offers we beat the OTA
 * and for others we're at parity — that parity case is exactly what the sales
 * engine pivots away from ("same price everywhere → pitch a better option").
 *
 * Run:  node scripts/generate-inventory.mjs
 * Out:  lib/inventory/inventory.data.json
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- seeded PRNG (mulberry32) so the file is reproducible ---------------------
let seed = 0x5eed1234;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rint = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
const usd = (major) => ({ amount: Math.round(major * 100), currency: "USD" });

// --- reference data -----------------------------------------------------------
const CITIES = [
  { city: "London", code: "LON", airport: "LHR" },
  { city: "Paris", code: "PAR", airport: "CDG" },
  { city: "Dubai", code: "DXB", airport: "DXB" },
  { city: "Istanbul", code: "IST", airport: "IST" },
  { city: "New York", code: "NYC", airport: "JFK" },
  { city: "Islamabad", code: "ISB", airport: "ISB" },
  { city: "Lahore", code: "LHE", airport: "LHE" },
  { city: "Karachi", code: "KHI", airport: "KHI" },
  { city: "Jeddah", code: "JED", airport: "JED" },
  { city: "Doha", code: "DOH", airport: "DOH" },
  { city: "Singapore", code: "SIN", airport: "SIN" },
  { city: "Bangkok", code: "BKK", airport: "BKK" },
  { city: "Kuala Lumpur", code: "KUL", airport: "KUL" },
  { city: "Rome", code: "ROM", airport: "FCO" },
  { city: "Barcelona", code: "BCN", airport: "BCN" },
  { city: "Amsterdam", code: "AMS", airport: "AMS" },
];
const cityByName = Object.fromEntries(CITIES.map((c) => [c.city, c]));

// realistic-ish one-way economy net fare bands (USD) for a route "distance"
const ROUTE_BASE = {
  short: [70, 160], // intra-region
  medium: [160, 380],
  long: [380, 780],
};
const LONG_HAUL = new Set(["NYC"]);
function routeBand(a, b) {
  if (LONG_HAUL.has(a.code) || LONG_HAUL.has(b.code)) return "long";
  const euro = new Set(["LON", "PAR", "ROM", "BCN", "AMS"]);
  const gulf = new Set(["DXB", "DOH", "JED", "IST"]);
  const pak = new Set(["ISB", "LHE", "KHI"]);
  const asia = new Set(["SIN", "BKK", "KUL"]);
  const grp = (c) =>
    euro.has(c) ? "eu" : gulf.has(c) ? "gulf" : pak.has(c) ? "pak" : asia.has(c) ? "asia" : "x";
  const ga = grp(a.code);
  const gb = grp(b.code);
  if (ga === gb) return "short";
  if ((ga === "eu" && gb === "gulf") || (ga === "gulf" && gb === "eu")) return "medium";
  if ((ga === "gulf" && gb === "pak") || (ga === "pak" && gb === "gulf")) return "medium";
  return "long";
}

const AIRLINES = [
  { name: "Emirates", score: 93 },
  { name: "Qatar Airways", score: 95 },
  { name: "Turkish Airlines", score: 88 },
  { name: "British Airways", score: 84 },
  { name: "Etihad", score: 90 },
  { name: "PIA", score: 62 },
  { name: "Lufthansa", score: 86 },
  { name: "Singapore Airlines", score: 96 },
  { name: "Air France", score: 83 },
  { name: "flydubai", score: 79 },
];
const CABIN_MULT = { economy: 1, premium: 1.8, business: 3.2 };
const HOTEL_BRANDS = [
  "Grand", "Royal", "Park", "Marina", "Central", "Boutique", "Riverside", "Skyline",
  "Heritage", "Palm", "Aurora", "Continental",
];
const HOTEL_SUFFIX = ["Hotel", "Suites", "Residence", "Inn", "Palace", "Plaza"];
const AREAS = ["City Centre", "Downtown", "Old Town", "Business District", "Marina", "Airport"];
const ROOMS = ["Standard Double", "Deluxe King", "Twin Room", "Executive Suite", "Studio"];
const SUPPLIERS = ["Galileo", "Amadeus", "RateHawk", "Sabre", "Direct"];

const offers = [];
let n = 0;
const id = (p) => `${p}-${String(++n).padStart(3, "0")}`;

// helper: market price = net grossed up to an OTA level; sometimes parity, sometimes beatable
function marketFor(netMajor, edge /* "beatable" | "parity" | "premium" */) {
  if (edge === "beatable") return usd(netMajor * (1 + rint(18, 30) / 100));
  if (edge === "parity") return usd(netMajor * (1 + rint(9, 12) / 100));
  return usd(netMajor * (1 + rint(2, 6) / 100)); // OTA barely above net → hard to beat
}
function edgeRoll() {
  const r = rnd();
  return r < 0.5 ? "beatable" : r < 0.8 ? "parity" : "premium";
}

// ---- 1) Flights: ensure popular pairs are covered, then fill ----------------
const FEATURED_PAIRS = [
  ["London", "Paris"],
  ["London", "Dubai"],
  ["Islamabad", "Jeddah"],
  ["Karachi", "Dubai"],
  ["Lahore", "Istanbul"],
  ["Dubai", "Bangkok"],
  ["London", "New York"],
  ["Istanbul", "Paris"],
];
function makeFlight(aName, bName) {
  const a = cityByName[aName];
  const b = cityByName[bName];
  const band = routeBand(a, b);
  const [lo, hi] = ROUTE_BASE[band];
  const air = pick(AIRLINES);
  const cabin = chance(0.72) ? "economy" : chance(0.6) ? "premium" : "business";
  const stops = band === "long" ? rint(0, 2) : chance(0.6) ? 0 : 1;
  const baseNet = rint(lo, hi) * CABIN_MULT[cabin] * (stops === 0 ? 1.12 : 1);
  const netMajor = Math.round(baseNet);
  const edge = edgeRoll();
  const durBase = band === "long" ? rint(420, 900) : band === "medium" ? rint(180, 360) : rint(75, 200);
  return {
    id: id("FL"),
    type: "flight",
    supplier: pick(SUPPLIERS),
    origin: a.city,
    originCode: a.airport,
    destination: b.city,
    destinationCode: b.airport,
    airline: air.name,
    cabin,
    stops,
    durationMinutes: durBase + stops * rint(60, 150),
    departTimeLocal: pick(["06:15", "07:30", "09:45", "12:20", "14:50", "17:35", "21:10", "23:55"]),
    refundable: chance(0.4),
    baggageKg: cabin === "economy" ? pick([20, 23, 30]) : pick([30, 40]),
    unitsLeft: rint(1, 9),
    netFare: usd(netMajor),
    marketPrice: marketFor(netMajor, edge),
    tags: [band, cabin, stops === 0 ? "nonstop" : "connection", edge],
  };
}
for (const [a, b] of FEATURED_PAIRS) {
  offers.push(makeFlight(a, b));
  offers.push(makeFlight(a, b)); // 2 competing fares per featured pair
}
while (offers.filter((o) => o.type === "flight").length < 336) {
  const a = pick(CITIES).city;
  let b = pick(CITIES).city;
  while (b === a) b = pick(CITIES).city;
  offers.push(makeFlight(a, b));
}

// ---- 2) Hotels --------------------------------------------------------------
function makeHotel(cityName) {
  const c = cityByName[cityName];
  const stars = pick([3, 3, 4, 4, 4, 5]);
  const base = { 3: rint(55, 110), 4: rint(95, 190), 5: rint(190, 420) }[stars];
  const edge = edgeRoll();
  return {
    id: id("HO"),
    type: "hotel",
    supplier: "RateHawk",
    city: c.city,
    cityCode: c.code,
    name: `${pick(HOTEL_BRANDS)} ${c.city} ${pick(HOTEL_SUFFIX)}`,
    area: pick(AREAS),
    stars,
    roomType: pick(ROOMS),
    breakfastIncluded: chance(0.55),
    ratingScore: Math.round((6.8 + rnd() * 3.1) * 10) / 10,
    reviewCount: rint(120, 5200),
    distanceToCentreKm: Math.round(rnd() * 80) / 10,
    refundable: chance(0.6),
    unitsLeft: rint(1, 12),
    netFare: usd(base),
    marketPrice: marketFor(base, edge),
    tags: [`${stars}-star`, edge],
  };
}
// Every city gets hotel coverage (not just a curated subset) so any
// destination the customer names has real hotel offers to pitch.
const HOTEL_CITIES = CITIES.map((c) => c.city);
for (let i = 0; i < 192; i++) makeHotelPush();
function makeHotelPush() {
  offers.push(makeHotel(pick(HOTEL_CITIES)));
}

// ---- 3) Packages (flight + hotel) ------------------------------------------
function makePackage(aName, bName) {
  const a = cityByName[aName];
  const b = cityByName[bName];
  const nights = pick([3, 4, 5, 7]);
  const stars = pick([4, 4, 5]);
  const air = pick(AIRLINES);
  const base = rint(480, 1500) + nights * rint(60, 160) + (stars === 5 ? 300 : 0);
  const edge = chance(0.7) ? "beatable" : "parity"; // packages are our margin sweet-spot
  return {
    id: id("PK"),
    type: "package",
    supplier: "Direct",
    origin: a.city,
    originCode: a.airport,
    destination: b.city,
    destinationCode: b.airport,
    airline: air.name,
    hotelName: `${pick(HOTEL_BRANDS)} ${b.city} ${pick(HOTEL_SUFFIX)}`,
    stars,
    nights,
    refundable: chance(0.5),
    unitsLeft: rint(1, 6),
    netFare: usd(base),
    marketPrice: marketFor(base, edge),
    tags: [`${nights}n`, `${stars}-star`, edge, "bundle"],
  };
}
const PKG_PAIRS = [
  ["London", "Dubai"], ["Islamabad", "Istanbul"], ["Karachi", "Bangkok"],
  ["Lahore", "Jeddah"], ["London", "Paris"], ["Dubai", "Singapore"],
  ["Istanbul", "Rome"], ["London", "Barcelona"], ["Karachi", "Dubai"],
  ["Islamabad", "Jeddah"], ["Lahore", "Istanbul"], ["Dubai", "Bangkok"],
];
for (const [a, b] of PKG_PAIRS) offers.push(makePackage(a, b));
while (offers.filter((o) => o.type === "package").length < 72) {
  const a = pick(CITIES).city;
  let b = pick(CITIES).city;
  while (b === a) b = pick(CITIES).city;
  offers.push(makePackage(a, b));
}

// ---- write ------------------------------------------------------------------
const out = join(__dirname, "..", "lib", "inventory", "inventory.data.json");
writeFileSync(out, JSON.stringify(offers, null, 2) + "\n");
const counts = offers.reduce((m, o) => ((m[o.type] = (m[o.type] || 0) + 1), m), {});
console.log(`Wrote ${offers.length} offers → ${out}`);
console.log(counts);
