/**
 * Live itinerary vs fare audit (HTTP-only).
 * Run: node scripts/e2e-itinerary-audit.mjs
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

async function callChat(message, history = []) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, location: LOCATION, stream: false }),
  });
  if (!res.ok) throw new Error(`Chat HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function normCode(code) {
  return (code ?? "").trim().toUpperCase();
}

function normFlightNumber(fn, carrier) {
  const raw = (fn || carrier || "").replace(/\s+/g, "").toUpperCase();
  return raw || "UNK";
}

function segmentItineraryToken(seg) {
  const carrier = normCode(seg.carrier) || normFlightNumber(seg.flightNumber, seg.carrier).slice(0, 2);
  return [
    normCode(seg.originCode ?? seg.origin),
    normCode(seg.destinationCode ?? seg.destination),
    seg.departureDate ?? "",
    seg.departTimeLocal ?? seg.departTime ?? "",
    seg.arrivalDate ?? "",
    seg.arriveTimeLocal ?? seg.arriveTime ?? "",
    carrier,
    normFlightNumber(seg.flightNumber, seg.carrier),
  ].join("|");
}

function legChainKey(segments) {
  if (!segments?.length) return "";
  return segments.map(segmentItineraryToken).join(">");
}

function buildItineraryKeyFromCard(card) {
  if (card.itineraryKey) return card.itineraryKey;
  const f = card.flight;
  if (!f) return `nonflight:${card.id}`;
  const hub = card.hubStitched ? "hub" : "direct";
  const outbound =
    legChainKey(f.segments) ||
    [
      normCode(f.originCode),
      normCode(f.destinationCode),
      f.departureDate ?? "",
      f.departTimeLocal ?? "",
      "",
      f.arriveTimeLocal ?? "",
      normCode(f.airlineCode),
      normFlightNumber(f.flightNumber, f.airlineCode),
    ].join("|");
  const inbound = legChainKey(f.returnSegments);
  const parts = [
    normCode(f.originCode),
    normCode(f.destinationCode),
    f.departureDate ?? "",
    f.returnDate ?? card.returnDate ?? "",
    hub,
    `OB:${outbound}`,
  ];
  if (inbound) parts.push(`RT:${inbound}`);
  return parts.join("::");
}

function enrichFares(offers) {
  const keys = offers.map((o) => buildItineraryKeyFromCard(o));
  const counts = new Map();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return offers.map((o, i) => ({
    id: o.id,
    itineraryKey: keys[i],
    priceMinor: o.priceMinor,
    price: o.price,
    faresOnItinerary: counts.get(keys[i]) ?? 1,
    carriers: (o.flight?.segments ?? [])
      .map((s) => s.carrier)
      .filter(Boolean),
    flightNumbers: (o.flight?.segments ?? [])
      .map((s) => s.flightNumber)
      .filter(Boolean),
    route: o.flight ? `${o.flight.originCode}→${o.flight.destinationCode}` : null,
    hubStitched: Boolean(o.hubStitched),
  }));
}

function auditSearch(label, message, history = []) {
  return callChat(message, history).then((chat) => {
    const offers = chat.searchPanel?.offers ?? [];
    const flights = offers.filter((o) => o.type === "flight" || o.flight);
    const enriched = enrichFares(flights);
    const byKey = new Map();
    for (const row of enriched) {
      const list = byKey.get(row.itineraryKey) ?? [];
      list.push(row);
      byKey.set(row.itineraryKey, list);
    }
    const groups = [...byKey.entries()].map(([key, fares]) => ({
      itineraryKey: key,
      fareCount: fares.length,
      prices: fares.map((f) => f.price),
      offerIds: fares.map((f) => f.id),
      carriers: fares[0]?.carriers ?? [],
      flightNumbers: fares[0]?.flightNumbers ?? [],
    }));
    return {
      label,
      totalOffers: offers.length,
      flightOffers: flights.length,
      uniqueItineraries: byKey.size,
      multiFareItineraries: groups.filter((g) => g.fareCount > 1).length,
      groups: groups.sort((a, b) => b.fareCount - a.fareCount),
      enriched,
      liveFlights: chat.searchPanel?.liveFlights,
    };
  });
}

const report = { runs: [], status: "PENDING" };

console.log("=== Itinerary audit: LHE → DXB 2026-09-10 ===");
report.runs.push(
  await auditSearch(
    "LHE-DXB",
    "I want to fly from Lahore to Dubai on September 10, 2026. Show me available flights.",
  ),
);

console.log("=== Itinerary audit: LHE → IST 2026-09-11 ===");
report.runs.push(
  await auditSearch(
    "LHE-IST",
    "I want to fly from Lahore to Istanbul on September 11, 2026.",
  ),
);

console.log("=== Itinerary audit: LHE ↔ DXB RT 2026-09-10 → 2026-09-15 ===");
report.runs.push(
  await auditSearch(
    "LHE-DXB-RT",
    "Round trip Lahore to Dubai departing September 10, 2026 returning September 15, 2026.",
  ),
);

for (const run of report.runs) {
  console.log(
    `\n${run.label}: ${run.flightOffers} fares · ${run.uniqueItineraries} itineraries · ${run.multiFareItineraries} with multiple fares`,
  );
  for (const g of run.groups.filter((x) => x.fareCount > 1).slice(0, 5)) {
    console.log(`  ${g.flightNumbers.join("+")} — ${g.fareCount} fares: ${g.prices.join(", ")}`);
  }
}

report.status = report.runs.every((r) => r.liveFlights && r.flightOffers >= 1) ? "PASS" : "FAIL";
const outPath = resolve(__dir, "../e2e-itinerary-audit.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nWrote ${outPath}`);
console.log(`STATUS: ${report.status}`);
process.exit(report.status === "PASS" ? 0 : 1);
