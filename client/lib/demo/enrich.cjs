/**
 * One-shot enrichment for galileo-fares.json.
 *
 * Durations and layovers are COMPUTED from the captured local times plus each
 * airport's UTC offset — not invented — so cross-midnight and multi-day legs
 * come out right. Everything derived from those (stops, angles, scores,
 * savings) follows deterministic rules documented inline.
 *
 * Run: node lib/demo/enrich.cjs
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "galileo-fares.json");
const d = JSON.parse(fs.readFileSync(FILE, "utf8"));

/** UTC offsets valid for Oct–Dec 2026 (post-DST for EU/US). */
const TZ = {
  LHE: 5, KHI: 5, TAS: 5, AUH: 4, DXB: 4, DOH: 3, BAH: 3, RUH: 3, JED: 3,
  IST: 3, CDG: 2, MXP: 2, JFK: -5, BOS: -5, MIA: -5, ORD: -6, YYZ: -5,
  SFO: -8, OAK: -8, SEA: -8,
};

const utc = (dateISO, hhmm, iata) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Date.parse(`${dateISO}T00:00:00Z`) + (h * 60 + m - TZ[iata] * 60) * 60000;
};

/** Arrival date = departure date, +1 when the terminal flagged `#`, or when the
 *  clock would otherwise run backwards (overnight sector). */
function arrivalDateOf(seg) {
  const base = Date.parse(`${seg.departureDate}T00:00:00Z`);
  let days = seg.arrivesNextDay ? 1 : 0;
  if (!days) {
    const dep = seg.departTimeLocal, arr = seg.arriveTimeLocal;
    if (arr && arr < dep && TZ[seg.destinationCode] >= TZ[seg.originCode]) days = 1;
  }
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

function enrichLegs(segs) {
  let prevArrUtc = null;
  segs.forEach((s) => {
    s.arrivalDate = arrivalDateOf(s);
    const depUtc = utc(s.departureDate, s.departTimeLocal, s.originCode);
    const arrUtc = utc(s.arrivalDate, s.arriveTimeLocal, s.destinationCode);
    s.durationMinutes = Math.round((arrUtc - depUtc) / 60000);
    if (prevArrUtc !== null) {
      const prev = segs[segs.indexOf(s) - 1];
      prev.layoverMinutesAfter = Math.round((depUtc - prevArrUtc) / 60000);
    }
    prevArrUtc = arrUtc;
  });
  return segs;
}

/**
 * Cabin from RBD. `I` is deliberately NOT treated as business: on several
 * carriers here (PK in particular) it is a discounted economy bucket, and
 * mapping it to business mislabelled real itineraries in this corpus.
 * `D`/`Z` are likewise discounted-business on some carriers but appear in
 * none of the captured fares, so they stay out of the map entirely.
 */
const cabinOf = (rbd) =>
  "JC".includes(rbd) ? "business" : "WSPA".includes(rbd) ? "premium" : "economy";

/** Checked allowance by carrier + cabin — representative published values. */
function baggageKg(carrier, cabin) {
  if (cabin === "business") return 40;
  if (cabin === "premium") return 35;
  return { EK: 30, EY: 30, QR: 30, TK: 30, SV: 30, GF: 30, PK: 30, HY: 20, AA: 23, AS: 23 }[carrier] ?? 23;
}

/** Restrictive economy buckets are non-refundable; higher buckets are not. */
const refundableOf = (rbd, cabin) =>
  cabin === "business" ? true : cabin === "premium" ? true : !"TVLEQON".includes(rbd);

let seq = 0;
const snapshotIso = (mins) => new Date(Date.parse("2026-09-22T18:00:00Z") + mins * 60000).toISOString();

for (const s of d.searches) {
  const all = s.itineraries.map((it) => {
    const out = enrichLegs(it.segments || it.outbound);
    const inb = it.inbound ? enrichLegs(it.inbound) : null;

    const legTotal = (legs) => legs.reduce((a, l) => a + l.durationMinutes + (l.layoverMinutesAfter || 0), 0);
    const maxLay = (legs) => Math.max(0, ...legs.map((l) => l.layoverMinutesAfter || 0));

    it.durationMinutes = legTotal(out);
    it.stops = out.length - 1;
    it.maxLayoverMinutes = maxLay(out);
    if (inb) {
      it.returnDurationMinutes = legTotal(inb);
      it.returnStops = inb.length - 1;
      it.maxLayoverMinutes = Math.max(it.maxLayoverMinutes, maxLay(inb));
    }

    const rbd = out[0].bookingClass;
    it.cabin = cabinOf(rbd);
    it.baggageKg = baggageKg(out[0].carrier, it.cabin);
    it.refundable = refundableOf(rbd, it.cabin);
    it.checkedBagIncluded = it.baggageKg > 0;
    it.construction = "single_ticket";
    it.marketingCarriers = [...new Set(out.concat(inb || []).map((l) => l.carrier))];
    it.validatingCarrier = out[0].carrier;
    it.seatsRemaining = 9 - ((seq * 3) % 8); // 1–9, deterministic spread
    it.supplierOfferSnapshotId = `snap_demo_${s.id}_${String(it.option).padStart(2, "0")}`;
    it.snapshotExpiresAt = snapshotIso(720);
    seq++;
    return it;
  });

  // ---- angles: derived by comparing the set, never hand-assigned ----
  const cheapest = all.reduce((a, b) => (b.totalMinor < a.totalMinor ? b : a));
  const fastest = all.reduce((a, b) => (b.durationMinutes < a.durationMinutes ? b : a));
  const dearest = all.reduce((a, b) => (b.totalMinor > a.totalMinor ? b : a));

  const prices = all.map((i) => i.totalMinor);
  const durs = all.map((i) => i.durationMinutes);
  const [pMin, pMax] = [Math.min(...prices), Math.max(...prices)];
  const [dMin, dMax] = [Math.min(...durs), Math.max(...durs)];
  const norm = (v, lo, hi) => (hi === lo ? 0 : (v - lo) / (hi - lo));

  for (const it of all) {
    // score: cheaper + faster + fewer stops is better; 0–100
    const raw = 1 - (0.5 * norm(it.totalMinor, pMin, pMax) + 0.35 * norm(it.durationMinutes, dMin, dMax) + 0.15 * Math.min(1, it.stops / 2));
    it.score = Math.round(raw * 100);
  }

  const best = all.reduce((a, b) => (b.score > a.score ? b : a));
  for (const it of all) {
    it.angle =
      it === cheapest ? "cheapest"
      : it === fastest ? "fastest"
      : it === best ? "best_value"
      : it === dearest && it.cabin !== "economy" ? "premium"
      : "recommended";
  }

  // market reference = dearest fare in the set; savings measured against it
  const marketMinor = dearest.totalMinor;
  for (const it of all) {
    it.marketPriceMinor = marketMinor;
    it.savingsPct = marketMinor > it.totalMinor
      ? Math.round(((marketMinor - it.totalMinor) / marketMinor) * 100)
      : null;

    const h = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;
    const badges = [];
    if (it.angle === "cheapest") badges.push("Cheapest");
    if (it.angle === "fastest") badges.push("Fastest");
    if (it.angle === "best_value") badges.push("Best value");
    if (it.stops === 0) badges.push("Nonstop");
    if (it.checkedBagIncluded) badges.push(`${it.baggageKg}kg bag`);
    if (it.refundable) badges.push("Refundable");
    if (it.seatsRemaining <= 3) badges.push(`${it.seatsRemaining} seats left`);
    if (it.marketingCarriers.length === 1) badges.push("Single carrier");
    it.badges = badges;

    const reasons = [];
    if (it.savingsPct) reasons.push(`${it.savingsPct}% below the highest fare in this search`);
    reasons.push(it.stops === 0 ? "Nonstop service" : `${it.stops} stop${it.stops > 1 ? "s" : ""} via ${it.via.join(", ")}`);
    reasons.push(`Total journey ${h(it.durationMinutes)}`);
    if (it.maxLayoverMinutes) reasons.push(`Longest layover ${h(it.maxLayoverMinutes)}`);
    reasons.push(it.refundable ? "Refundable fare" : "Non-refundable fare conditions");
    it.reasons = reasons;
  }

  s.priceRange = { minMinor: pMin, maxMinor: pMax, currency: "PKR" };
  s.durationRange = { minMinutes: dMin, maxMinutes: dMax };
}

// priced PNR gets the same leg maths
enrichLegs(d.pricedPnr.segments);
d.pricedPnr.cabin = cabinOf(d.pricedPnr.segments[0].bookingClass);

const NOTES = [
  "`durationMinutes` and `layoverMinutesAfter` are computed from captured local times plus per-airport UTC offsets (Oct–Dec 2026), so overnight and multi-day sectors are correct.",
  "`angle`, `score`, `savingsPct`, `badges` and `reasons` are derived by comparing each search set — they are demo-grade, not supplier-supplied.",
  "`baggageKg`, `refundable`, `cabin` and `seatsRemaining` are representative values inferred from the RBD and carrier, not captured from the terminal.",
];
// Idempotent: re-running must not duplicate notes.
for (const n of NOTES) if (!d.$meta.notes.includes(n)) d.$meta.notes.push(n);
d.$meta.dataIntegrity.enrichedAt = "2026-09-22";

fs.writeFileSync(FILE, JSON.stringify(d, null, 2) + "\n");
console.log("enriched");
