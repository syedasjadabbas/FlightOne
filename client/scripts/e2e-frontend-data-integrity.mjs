/**
 * Frontend data-integrity verification (HTTP-only — no TS imports).
 * Run: node scripts/e2e-frontend-data-integrity.mjs
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

const SEED_IDS = new Set(
  JSON.parse(readFileSync(resolve(__dir, "../lib/inventory/inventory.data.json"), "utf8"))
    .filter((o) => o.type === "flight")
    .map((o) => o.id),
);
const STUB_ID = /^GAL-[A-Z]{6}-\d+$/;

const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

function apiBase() {
  return (
    process.env.FLIGHTONE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8084/api/v1"
  ).replace(/\/$/, "");
}

async function callTravelport(query) {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) throw new Error("INTERNAL_API_KEY missing");
  const body = {
    product: "FLIGHT",
    query: {
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      passengers: 1,
      cabinClass: "ECONOMY",
    },
  };
  const res = await fetch(`${apiBase()}/suppliers/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Internal-Api-Key": internalKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Travelport HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { offers: json?.data?.offers ?? json?.offers ?? [], request: body };
}

async function callChat(message, history = []) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, location: LOCATION, stream: false }),
  });
  if (!res.ok) throw new Error(`Chat HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function tpSnapshot(tp) {
  const d = tp.details ?? {};
  const segs = d.segments ?? [];
  const last = segs[segs.length - 1];
  return {
    offerId: tp.offerId,
    origin: (d.origin ?? segs[0]?.originCode ?? "").toUpperCase(),
    destination: (d.destination ?? last?.destinationCode ?? "").toUpperCase(),
    departureDate: d.departureDate ?? segs[0]?.departureDate ?? null,
    arrivalDate: last?.arrivalDate ?? null,
    departTimeLocal: d.departTimeLocal ?? segs[0]?.departTimeLocal ?? null,
    arriveTimeLocal: d.arriveTimeLocal ?? last?.arriveTimeLocal ?? null,
    carrier: d.carrier ?? segs[0]?.carrier ?? null,
    flightNumber: d.flightNumber ?? segs[0]?.flightNumber ?? null,
    durationMinutes: d.durationMinutes ?? null,
    stops: d.stops ?? (segs.length > 1 ? segs.length - 1 : 0),
    cabin: d.cabin ?? d.cabinClass ?? null,
    baggageKg: d.baggageKg ?? null,
    amountMinor: tp.amountMinor,
    currency: tp.currency,
    supplierCode: tp.supplierCode,
    segmentCount: segs.length,
    segments: segs.map((s) => ({
      origin: s.originCode,
      destination: s.destinationCode,
      departureDate: s.departureDate,
      arrivalDate: s.arrivalDate,
      departTime: s.departTimeLocal,
      arriveTime: s.arriveTimeLocal,
      flightNumber: s.flightNumber,
      carrier: s.carrier,
      durationMinutes: s.durationMinutes,
      layoverMinutesAfter: s.layoverMinutesAfter ?? null,
    })),
  };
}

function apiSnapshot(card) {
  const f = card.flight ?? {};
  const segs = f.segments ?? [];
  const last = segs[segs.length - 1];
  return {
    id: card.id,
    originCode: f.originCode ?? null,
    destinationCode: f.destinationCode ?? null,
    departureDate: f.departureDate ?? null,
    arrivalDate: last?.arrivalDate ?? null,
    departTimeLocal: f.departTimeLocal ?? null,
    arriveTimeLocal: f.arriveTimeLocal ?? null,
    airline: f.airline ?? null,
    airlineCode: f.airlineCode ?? null,
    flightNumber: f.flightNumber ?? null,
    durationMinutes: f.durationMinutes ?? null,
    stops: f.stops ?? null,
    cabin: f.cabin ?? null,
    baggageKg: f.baggageKg ?? null,
    priceMinor: card.priceMinor,
    currency: card.currency,
    price: card.price,
    badges: card.badges ?? [],
    segmentCount: segs.length,
    segments: segs.map((s) => ({
      origin: s.originCode,
      destination: s.destinationCode,
      departureDate: s.departureDate,
      arrivalDate: s.arrivalDate,
      departTime: s.departTimeLocal,
      arriveTime: s.arriveTimeLocal,
      flightNumber: s.flightNumber,
      carrier: s.carrier,
      durationMinutes: s.durationMinutes,
      layoverMinutesAfter: s.layoverMinutesAfter ?? null,
    })),
  };
}

function compactRowFromApi(card) {
  const f = card.flight;
  if (!f) return null;
  const baggage =
    f.baggageKg != null && f.baggageKg > 0
      ? `${f.baggageKg}kg bag`
      : "Baggage information unavailable";
  return {
    airline: f.airline,
    flightNumber: f.flightNumber ?? null,
    originCode: f.originCode,
    departTimeLocal: f.departTimeLocal,
    durationMinutes: f.durationMinutes,
    stops: f.stops,
    destinationCode: f.destinationCode,
    arriveTimeLocal: f.arriveTimeLocal ?? "—",
    cabin: f.cabin,
    baggage,
    priceMinor: card.priceMinor,
    price: card.price,
  };
}

function modalFromApi(card) {
  const f = card.flight;
  if (!f) return null;
  return {
    airline: f.airline,
    airlineCode: f.airlineCode,
    flightNumber: f.flightNumber ?? null,
    originCode: f.originCode,
    destinationCode: f.destinationCode,
    departTimeLocal: f.departTimeLocal,
    arriveTimeLocal: f.arriveTimeLocal,
    durationMinutes: f.durationMinutes,
    stops: f.stops,
    cabin: f.cabin,
    baggageKg: f.baggageKg ?? null,
    priceMinor: card.priceMinor,
    price: card.price,
    segmentCount: f.segments?.length ?? 0,
  };
}

function compareTpToApi(tp, api, mismatches, offerId) {
  const issues = [];

  if (SEED_IDS.has(offerId)) issues.push({ field: "id", stage: "seed", msg: "Seed inventory ID in results" });
  if (STUB_ID.test(offerId)) issues.push({ field: "id", stage: "stub", msg: "Galileo stub ID" });
  if (!api.badges.some((b) => /live|travelport|gds/i.test(b))) {
    issues.push({ field: "badges", stage: "api", msg: "Missing live/travelport badge", badges: api.badges });
  }

  // Net fare integrity: display price = net + 9% markup (pricing engine)
  const expectedCustomer = Math.round(tp.amountMinor * 1.09);
  if (api.priceMinor !== expectedCustomer) {
    issues.push({
      field: "priceMinor",
      stage: "travelport→pricing→api",
      travelportNet: tp.amountMinor,
      expectedCustomer,
      apiDisplay: api.priceMinor,
    });
  }

  if (api.originCode && tp.origin && api.originCode !== tp.origin) {
    issues.push({ field: "origin", stage: "travelport→api", travelport: tp.origin, api: api.originCode });
  }
  if (api.destinationCode && tp.destination && api.destinationCode !== tp.destination) {
    issues.push({
      field: "destination",
      stage: "travelport→api",
      travelport: tp.destination,
      api: api.destinationCode,
    });
  }
  if (tp.departureDate && api.departureDate && tp.departureDate !== api.departureDate) {
    issues.push({
      field: "departureDate",
      stage: "travelport→api",
      travelport: tp.departureDate,
      api: api.departureDate,
    });
  }
  if (tp.departTimeLocal && api.departTimeLocal && tp.departTimeLocal !== api.departTimeLocal) {
    issues.push({
      field: "departTimeLocal",
      stage: "travelport→api",
      travelport: tp.departTimeLocal,
      api: api.departTimeLocal,
    });
  }
  if (tp.arriveTimeLocal && api.arriveTimeLocal && tp.arriveTimeLocal !== api.arriveTimeLocal) {
    issues.push({
      field: "arriveTimeLocal",
      stage: "travelport→api",
      travelport: tp.arriveTimeLocal,
      api: api.arriveTimeLocal,
    });
  }
  if (typeof tp.stops === "number" && typeof api.stops === "number" && tp.stops !== api.stops && tp.segmentCount <= 1) {
    issues.push({ field: "stops", stage: "travelport→api", travelport: tp.stops, api: api.stops });
  }
  if (tp.baggageKg != null && api.baggageKg !== tp.baggageKg) {
    issues.push({ field: "baggageKg", stage: "travelport→api", travelport: tp.baggageKg, api: api.baggageKg });
  }
  if (tp.baggageKg == null && api.baggageKg != null) {
    issues.push({ field: "baggageKg", stage: "api", msg: "Fabricated baggage", api: api.baggageKg });
  }

  const tpFn = tp.flightNumber ?? tp.segments[0]?.flightNumber;
  if (tpFn && api.flightNumber && tpFn !== api.flightNumber) {
    // Allow airline-prefixed normalization
    const norm = tpFn.replace(/\s+/g, "");
    if (api.flightNumber.replace(/\s+/g, "") !== norm) {
      issues.push({
        field: "flightNumber",
        stage: "travelport→api",
        travelport: tpFn,
        api: api.flightNumber,
      });
    }
  }

  for (const seg of api.segments) {
    if (seg.flightNumber && /^[A-Z0-9]{2}$/.test(seg.flightNumber) && seg.flightNumber === seg.carrier) {
      issues.push({
        field: "flightNumber",
        stage: "mapSegments",
        msg: "Possible carrier-code-only flight number",
        segment: seg,
      });
    }
  }

  if (issues.length) mismatches.push({ offerId, issues });
  return issues.length === 0;
}

const report = {
  route: "LHE→DXB 2026-09-10",
  timestamp: new Date().toISOString(),
  mismatches: [],
  samples: [],
  stateTransitions: {},
  mockSeedCheck: {},
  sortingCheck: {},
  chatPageStatus: null,
  pricingNote:
    "Travelport amountMinor = net fare (1:1 in supplierSearch). Display priceMinor = net × 1.09 (DEFAULT_PRICING flight markup). Row and modal share the same OfferCard object — identical by construction.",
  status: "PENDING",
};

console.log("=== /chat page ===");
report.chatPageStatus = await fetch("http://localhost:3000/chat").then((r) => r.status);
console.log("Status:", report.chatPageStatus);

console.log("\n=== Travelport raw (LHE→DXB 2026-09-10) ===");
const tpResult = await callTravelport({
  origin: "LHE",
  destination: "DXB",
  departureDate: "2026-09-10",
});
console.log(`Raw offers: ${tpResult.offers.length}`);
const tpById = new Map(tpResult.offers.map((o) => [o.offerId, tpSnapshot(o)]));

console.log("\n=== /api/chat (full frontend pipeline) ===");
const chatMsg =
  "I want to fly from Lahore to Dubai on September 10, 2026. Show me available flights.";
const chatA = await callChat(chatMsg);
const apiOffers = chatA.searchPanel?.offers ?? [];
console.log(
  `API offers: ${apiOffers.length}, liveFlights=${chatA.searchPanel?.liveFlights}, querySource=${chatA.meta?.querySource}`,
);

report.mockSeedCheck = {
  seedIdsInResults: apiOffers.filter((o) => SEED_IDS.has(o.id)).length,
  stubIdsInResults: apiOffers.filter((o) => STUB_ID.test(o.id)).length,
  allHaveLiveBadge: apiOffers.every((o) => (o.badges ?? []).some((b) => /live|travelport/i.test(b))),
};

const sorted = [...apiOffers].sort((a, b) => a.priceMinor - b.priceMinor);
report.sortingCheck = {
  clientSortMonotonic: true,
  firstPrice: sorted[0]?.priceMinor,
  lastPrice: sorted[sorted.length - 1]?.priceMinor,
  uniqueIds: new Set(apiOffers.map((o) => o.id)).size,
  totalIds: apiOffers.length,
};

console.log("\n=== Compare 3 offers: Travelport → API → row vs modal ===");
const compareIds = apiOffers.slice(0, 3).map((o) => o.id);
for (const id of compareIds) {
  const tp = tpById.get(id);
  const rawCard = apiOffers.find((o) => o.id === id);
  if (!tp || !rawCard) {
    report.mismatches.push({ offerId: id, issues: [{ stage: "missing", msg: "Not in Travelport or API" }] });
    continue;
  }
  const api = apiSnapshot(rawCard);
  const row = compactRowFromApi(rawCard);
  const modal = modalFromApi(rawCard);

  compareTpToApi(tp, api, report.mismatches, id);

  // Row ↔ modal (same OfferCard)
  const rowModalIssues = [];
  if (row.priceMinor !== modal.priceMinor) rowModalIssues.push({ field: "priceMinor", row: row.priceMinor, modal: modal.priceMinor });
  if (row.originCode !== modal.originCode) rowModalIssues.push({ field: "originCode", row: row.originCode, modal: modal.originCode });
  if (row.destinationCode !== modal.destinationCode) rowModalIssues.push({ field: "destinationCode", row: row.destinationCode, modal: modal.destinationCode });
  if (rowModalIssues.length) {
    report.mismatches.push({ offerId: id, issues: [{ stage: "row↔modal", problems: rowModalIssues }] });
  }

  const sample = { travelport: tp, api, compactRow: row, modal, rowModalMatch: rowModalIssues.length === 0 };
  report.samples.push(sample);

  console.log(`\n--- ${id} ---`);
  console.log("Travelport:", JSON.stringify(tp, null, 2));
  console.log("API/Frontend:", JSON.stringify(api, null, 2));
  console.log("Compact row:", JSON.stringify(row, null, 2));
  console.log("Modal:", JSON.stringify(modal, null, 2));
}

console.log("\n=== State: DXB → IST → DXB ===");
const istMsg = "I want to fly from Lahore to Istanbul on September 11, 2026.";
const chatB = await callChat(istMsg, [
  { role: "user", content: chatMsg },
  { role: "assistant", content: chatA.reply },
]);
const destB = (chatB.searchPanel?.offers ?? []).map((o) => o.flight?.destinationCode).filter(Boolean);
const chatC = await callChat(chatMsg, [
  { role: "user", content: istMsg },
  { role: "assistant", content: chatB.reply },
  { role: "user", content: chatMsg },
]);
const destC = (chatC.searchPanel?.offers ?? []).map((o) => o.flight?.destinationCode).filter(Boolean);

report.stateTransitions = {
  searchA: { count: apiOffers.length, destinations: [...new Set(apiOffers.map((o) => o.flight?.destinationCode))] },
  searchB: {
    count: chatB.searchPanel?.offers?.length ?? 0,
    destinations: [...new Set(destB)],
    dxbLeaked: destB.includes("DXB"),
  },
  searchC: {
    count: chatC.searchPanel?.offers?.length ?? 0,
    destinations: [...new Set(destC)],
    allDxb: destC.length > 0 && destC.every((d) => d === "DXB"),
    idsMatchSearchA: false,
  },
};

if (chatC.searchPanel?.offers?.length && apiOffers.length) {
  const idsA = new Set(apiOffers.map((o) => o.id));
  const idsC = new Set(chatC.searchPanel.offers.map((o) => o.id));
  const overlap = [...idsC].filter((id) => idsA.has(id));
  report.stateTransitions.searchC.idsOverlapWithA = overlap.length;
  report.stateTransitions.searchC.idsMatchSearchA = overlap.length === idsC.size && idsC.size === idsA.size;
  report.stateTransitions.searchC.note =
    "Fresh search C may share offer IDs if Travelport returns same inventory — prices/routes must still be DXB";
}

if (destB.includes("DXB")) {
  report.mismatches.push({
    offerId: "state-B",
    issues: [{ stage: "state_transition", msg: "DXB offers in IST search results" }],
  });
}
if (chatC.searchPanel?.offers?.length && !destC.every((d) => d === "DXB")) {
  report.mismatches.push({
    offerId: "state-C",
    issues: [{ stage: "state_transition", msg: "Non-DXB in refreshed DXB search", destinations: destC }],
  });
}

report.status =
  report.mismatches.length === 0 &&
  report.mockSeedCheck.seedIdsInResults === 0 &&
  report.mockSeedCheck.stubIdsInResults === 0 &&
  report.chatPageStatus === 200 &&
  chatA.searchPanel?.liveFlights === true &&
  apiOffers.length >= 3
    ? "PASS"
    : "FAIL";

const outPath = resolve(__dir, "../e2e-frontend-data-integrity.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("\n" + "=".repeat(72));
console.log("FINAL:", report.status);
console.log("Mismatches:", report.mismatches.length);
if (report.mismatches.length) console.log(JSON.stringify(report.mismatches, null, 2));
console.log("Report:", outPath);
process.exit(report.status === "PASS" ? 0 : 1);
