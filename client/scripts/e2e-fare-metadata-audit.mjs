/**
 * Fare metadata audit via live /api/chat pipeline.
 * Run: node scripts/e2e-fare-metadata-audit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* optional */
}

const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

async function callChat(message) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [], location: LOCATION, stream: false }),
  });
  if (!res.ok) throw new Error(`Chat HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function fareSnapshot(card) {
  const f = card.flight ?? {};
  return {
    id: card.id,
    itineraryKey: card.itineraryKey,
    price: card.price,
    priceMinor: card.priceMinor,
    fareBrandName: f.fareBrandName ?? null,
    cabin: f.cabin,
    baggageAllowance: f.baggageAllowance ?? null,
    baggageKg: f.baggageKg ?? null,
    fareRulesSummary: f.fareRulesSummary ?? null,
    refundable: f.refundable ?? null,
    fareBasisCode: f.fareBasisCode ?? null,
    bookingClass: f.bookingClass ?? null,
    validatingCarrier: f.validatingCarrier ?? null,
    paymentTimeLimit: f.paymentTimeLimit ?? null,
    supplierPriceBreakdown: f.supplierPriceBreakdown ?? null,
    validationStatus: f.validationStatus ?? null,
    connectionWarnings: f.connectionWarnings ?? [],
    hubStitched: card.hubStitched ?? false,
    roundTrip: card.roundTrip ?? false,
    returnSegments: f.returnSegments?.length ?? 0,
  };
}

function groupByItinerary(offers) {
  const map = new Map();
  for (const o of offers) {
    const k = o.itineraryKey ?? o.id;
    const list = map.get(k) ?? [];
    list.push(o);
    map.set(k, list);
  }
  return map;
}

const report = { runs: [], status: "PENDING" };

const searches = [
  {
    label: "LHE-DXB",
    message: "I want to fly from Lahore to Dubai on September 10, 2026. Show me available flights.",
  },
  {
    label: "LHE-IST",
    message: "I want to fly from Lahore to Istanbul on September 11, 2026.",
  },
  {
    label: "LHE-DXB-RT",
    message: "Round trip Lahore to Dubai departing September 10, 2026 returning September 15, 2026.",
  },
];

for (const s of searches) {
  console.log(`=== ${s.label} ===`);
  const chat = await callChat(s.message);
  const offers = (chat.searchPanel?.offers ?? []).filter((o) => o.flight);
  const snaps = offers.map(fareSnapshot);
  const groups = groupByItinerary(offers);
  const firstGroup = [...groups.values()].find((g) => g.length >= 2) ?? [];
  const sampleFares = firstGroup.slice(0, 3).map(fareSnapshot);

  const hasBrand = snaps.filter((x) => x.fareBrandName).length;
  const hasBaggage = snaps.filter((x) => x.baggageAllowance).length;
  const hasRules = snaps.filter((x) => x.fareRulesSummary).length;
  const hasBreakdown = snaps.filter((x) => x.supplierPriceBreakdown).length;

  report.runs.push({
    label: s.label,
    offerCount: offers.length,
    uniqueItineraries: groups.size,
    withFareBrand: hasBrand,
    withBaggage: hasBaggage,
    withFareRules: hasRules,
    withPriceBreakdown: hasBreakdown,
    sampleFares,
    sameItineraryFareDiff:
      sampleFares.length >= 2
        ? {
            ids: sampleFares.map((x) => x.id),
            prices: sampleFares.map((x) => x.price),
            brands: sampleFares.map((x) => x.fareBrandName),
          }
        : null,
  });

  console.log(
    `${offers.length} fares · ${groups.size} itineraries · brand:${hasBrand} baggage:${hasBaggage} rules:${hasRules} breakdown:${hasBreakdown}`,
  );
}

report.status = report.runs.every(
  (r) => r.offerCount >= 1 && r.withFareBrand >= 1 && r.withBaggage >= 1 && r.withFareRules >= 1,
)
  ? "PASS"
  : "FAIL";

const out = resolve(__dir, "../e2e-fare-metadata-audit.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nWrote ${out}`);
console.log(`STATUS: ${report.status}`);
process.exit(report.status === "PASS" ? 0 : 1);
