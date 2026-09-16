#!/usr/bin/env node
/**
 * Ava hotel / Stays playbook eval: natural queries → POST /api/chat → LM Studio critique.
 *
 * Usage: node scripts/ava-hotel-playbook-eval.mjs
 * Env: CHAT_URL, LMSTUDIO_BASE_URL, LMSTUDIO_MODEL, CONCURRENCY, SKIP_CHAT, SKIP_CRITIQUE
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tmp");
const OUT_FILE = join(OUT_DIR, "ava-hotel-playbook-eval.json");

const CHAT_URL = process.env.CHAT_URL || "http://localhost:3000/api/chat";
const LMSTUDIO_BASE_URL = (
  process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1"
).replace(/\/$/, "");
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || "qwen/qwen3.8-27b";
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY) || 1);
const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS) || 180_000;
const CRITIQUE_TIMEOUT_MS = Number(process.env.CRITIQUE_TIMEOUT_MS) || 90_000;

const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

/** Natural probes from ava-hotel-query-playbook.canvas.tsx */
const PROBES = [
  {
    area: "Core stays",
    feature: "City + dates",
    details: "HOTEL cityCode + check-in/out",
    natural: "Hotel in Dubai from 12 to 15 September.",
  },
  {
    area: "Core stays",
    feature: "Stars floor",
    details: "minStars on live / seed search",
    natural: "5-star hotels in Dubai 20–23 September.",
  },
  {
    area: "Core stays",
    feature: "City + stars + dates",
    details: "Combined star + dates ask",
    natural: "4-star hotel in Bangkok 1–4 October.",
  },
  {
    area: "Core stays",
    feature: "Short stay nights",
    details: "N nights starting on a date",
    natural: "3 nights in Doha starting 22 September.",
  },
  {
    area: "Core stays",
    feature: "PKR currency",
    details: "requestedCurrency / quote in PKR",
    natural: "Hotel in Istanbul mid-September — show prices in PKR.",
  },
  {
    area: "Named property",
    feature: "Known alias — Burj Al Arab",
    details: "knownHotels alias → Dubai search",
    natural: "Book Burj Al Arab for 10–12 October.",
  },
  {
    area: "Named property",
    feature: "Known alias — Armani Dubai",
    details: "Armani Hotel Dubai alias",
    natural: "Armani Hotel Dubai 9–11 October.",
  },
  {
    area: "Named property",
    feature: "Known alias — Raffles Singapore",
    details: "Raffles Singapore alias",
    natural: "Raffles Singapore 2–5 November for two.",
  },
  {
    area: "Named property",
    feature: "Known alias — Marina Bay Sands",
    details: "Marina Bay Sands alias",
    natural: "Marina Bay Sands for 2 nights mid-November.",
  },
  {
    area: "Named property",
    feature: "Unknown named hotel",
    details: "Generic hotelNameContains / comps",
    natural: "Stay at The Plaza New York 5–8 November.",
  },
  {
    area: "Location soft",
    feature: "Landmark proximity",
    details: "Near landmark — often treated as hotelName",
    natural: "Stay near Burj Khalifa in Dubai 12–15 September.",
  },
  {
    area: "Location soft",
    feature: "Neighborhood",
    details: "Area / street as soft name match",
    natural: "Hotel in Bangkok near Sukhumvit, 1–4 October.",
  },
  {
    area: "Location soft",
    feature: "Downtown area",
    details: "Downtown / city-centre phrasing",
    natural: "Stay Downtown Dubai 18–21 September.",
  },
  {
    area: "Location soft",
    feature: "Map distance",
    details: "Hard km-to-landmark (expect gap)",
    natural: "Hotels within 1 km of Burj Khalifa, 12–14 September.",
  },
  {
    area: "Filters & amenities",
    feature: "Breakfast included",
    details: "breakfastIncluded badge / soft ask",
    natural: "Dubai hotel 15–18 September with breakfast included.",
  },
  {
    area: "Filters & amenities",
    feature: "Stars + breakfast",
    details: "Playbook classic combo",
    natural: "Hotel in Bangkok near Sukhumvit, 1–4 Oct, 4★ with breakfast.",
  },
  {
    area: "Filters & amenities",
    feature: "Free cancellation",
    details: "refundableOnly on hotel offers",
    natural: "Refundable hotel in Istanbul 8–11 October only.",
  },
  {
    area: "Filters & amenities",
    feature: "Spa / pool amenity",
    details: "Amenity matrix (expect soft/gap)",
    natural: "Dubai hotel with a spa and pool, mid-September.",
  },
  {
    area: "Filters & amenities",
    feature: "Budget per night",
    details: "maxBudgetMinor / live night rate",
    natural: "Dubai stay under 40,000 PKR per night 12–14 September.",
  },
  {
    area: "Filters & amenities",
    feature: "Best value vs cheapest",
    details: "Curate angles for stays",
    natural: "Best-value 4-star vs cheapest decent stay in Dubai 12–15 September.",
  },
  {
    area: "Party & rooms",
    feature: "Guests",
    details: "HOTEL guests / passengers",
    natural: "Hotel in London for 4 adults, 3–6 October.",
  },
  {
    area: "Party & rooms",
    feature: "Two rooms",
    details: "rooms count on query",
    natural: "Two rooms in Singapore Marina Bay, 10–13 November.",
  },
  {
    area: "Party & rooms",
    feature: "Family stay",
    details: "Adults + kids hotel ask",
    natural: "Family hotel in Dubai for 2 adults and 2 kids, 20–25 September.",
  },
  {
    area: "Packages & air+stay",
    feature: "Honeymoon package",
    details: "action package",
    natural: "Honeymoon package Lahore to Maldives in October.",
  },
  {
    area: "Packages & air+stay",
    feature: "Flight + hotel",
    details: "FLIGHT + HOTEL legs",
    natural:
      "Flight Lahore to Dubai 12 September return 16th plus a hotel for those nights.",
  },
  {
    area: "Packages & air+stay",
    feature: "Family package",
    details: "Package with hotel star ask",
    natural: "Family package Lahore to Dubai with a 4-star hotel for the first week of October.",
  },
  {
    area: "Flexible dates",
    feature: "Flexible stay window",
    details: "datesAssumed / clarify cheapest nights",
    natural: "Flexible dates for a Dubai stay next month — any cheap 3 nights.",
  },
  {
    area: "Catalog breadth",
    feature: "Hostel ask",
    details: "Hostels / non-hotel stays (expect gap)",
    natural: "Cheap hostel in Bangkok early October.",
  },
  {
    area: "Trust & compare",
    feature: "OTA rate compare",
    details: "Booking.com vs FlightOne pitch",
    natural: "Is Booking cheaper than your rate for Atlantis The Palm 10–12 October?",
  },
  {
    area: "Account",
    feature: "Save shortlist",
    details: "Save hotels for later (expect gap)",
    natural: "Save these Dubai hotels — I’ll decide tomorrow.",
  },
];

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function chatOnce(probe, index) {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(
      CHAT_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: probe.natural,
          history: [],
          location: LOCATION,
          stream: false,
        }),
      },
      CHAT_TIMEOUT_MS,
    );
    const ms = Date.now() - started;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ...probe,
        index,
        ok: false,
        latencyMs: ms,
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
        reply: "",
        offers: [],
        intent: null,
        meta: null,
        whatsappUrl: null,
      };
    }
    const data = await res.json();
    return {
      ...probe,
      index,
      ok: true,
      latencyMs: ms,
      error: null,
      reply: data.reply ?? "",
      offers: Array.isArray(data.offers) ? data.offers : [],
      intent: data.intent ?? null,
      meta: data.meta ?? null,
      whatsappUrl: data.whatsappUrl ?? null,
    };
  } catch (err) {
    return {
      ...probe,
      index,
      ok: false,
      latencyMs: Date.now() - started,
      error: err?.name === "AbortError" ? "timeout" : String(err?.message || err),
      reply: "",
      offers: [],
      intent: null,
      meta: null,
      whatsappUrl: null,
    };
  }
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

async function critiqueOne(turn) {
  const offerSummary = (turn.offers || [])
    .slice(0, 6)
    .map((o, i) => {
      if (o.type === "hotel" || (!o.flight && o.title)) {
        const stars = o.badges?.find?.((b) => /★|star/i.test(b)) || "";
        const bags = (o.badges || []).join(", ");
        return `${i + 1}. [${o.type || "?"}] ${o.title} — ${o.price} · ${o.subtitle || ""} · badges=${bags || stars || "none"}`;
      }
      if (o.flight) {
        return `${i + 1}. [flight] ${o.title} — ${o.price} | ${o.flight.originCode}→${o.flight.destinationCode}`;
      }
      if (o.type === "package") {
        return `${i + 1}. [package] ${o.title} — ${o.price}`;
      }
      return `${i + 1}. [${o.type}] ${o.title} — ${o.price}`;
    })
    .join("\n");

  const system = `You are a strict product QA critic for Ava, FlightOne's Pakistan leisure travel consultant.
This probe is about HOTEL / Stays (Skyscanner Stays parity), not flights — score hotel-relevant behavior.
Be honest: if Ava should NOT yet support something (map km, hostels, amenity matrix, save), "honest gap admission" scores higher than hallucinating.
If Ava pitches flight cards for a pure hotel ask, that is a fail on product match.
Return ONLY valid JSON (no markdown):
{
  "verdict": "pass"|"partial"|"fail"|"error",
  "overall": 1-5,
  "scores": {
    "intentGrasp": 1-5,
    "featureCoverage": 1-5,
    "honestyAboutGaps": 1-5,
    "groundingOffers": 1-5,
    "agencyVoicePkr": 1-5,
    "actionability": 1-5
  },
  "strengths": ["short"],
  "weaknesses": ["short"],
  "gapVsSkyscanner": "one sentence",
  "fixPriority": "P0"|"P1"|"P2"|"P3"|"none",
  "summary": "2 sentences max"
}`;

  const hotelOffers = (turn.offers || []).filter((o) => o.type === "hotel").length;
  const flightOffers = (turn.offers || []).filter((o) => o.type === "flight").length;
  const packageOffers = (turn.offers || []).filter((o) => o.type === "package").length;

  const user = `Feature area: ${turn.area}
Feature: ${turn.feature}
Expected Stays-like ability: ${turn.details}

Guest query (natural):
${turn.natural}

API ok: ${turn.ok}
Error: ${turn.error || "none"}
Latency ms: ${turn.latencyMs}
Provider: ${turn.meta?.provider ?? "unknown"}
Grounded: ${turn.meta?.grounded ?? false}
Live hotels: ${turn.meta?.liveHotels ?? false}
Live flights: ${turn.meta?.liveFlights ?? false}
Query source: ${turn.meta?.querySource ?? "unknown"}
Offer counts: hotel=${hotelOffers} flight=${flightOffers} package=${packageOffers} total=${(turn.offers || []).length}
Intent JSON: ${JSON.stringify(turn.intent)}

Ava reply:
${(turn.reply || "(empty)").slice(0, 2500)}

Offers:
${offerSummary || "(none)"}
WhatsApp handoff: ${turn.whatsappUrl ? "yes" : "no"}`;

  try {
    const res = await fetchWithTimeout(
      `${LMSTUDIO_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: LMSTUDIO_MODEL,
          stream: false,
          temperature: 0.2,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: `${system}\n\nRespond with a single valid JSON object only.`,
            },
            { role: "user", content: user },
          ],
        }),
      },
      CRITIQUE_TIMEOUT_MS,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { error: `critique HTTP ${res.status}: ${detail.slice(0, 180)}` };
    }
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();
    try {
      return JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch {
          /* fallthrough */
        }
      }
      return { error: "critique JSON parse failed", raw: text.slice(0, 400) };
    }
  } catch (err) {
    return {
      error: err?.name === "AbortError" ? "critique timeout" : String(err?.message || err),
    };
  }
}

function summarize(results) {
  const critiques = results.map((r) => r.critique).filter((c) => c && !c.error);
  const byVerdict = { pass: 0, partial: 0, fail: 0, error: 0 };
  for (const r of results) {
    const v = r.critique?.verdict || "error";
    byVerdict[v] = (byVerdict[v] || 0) + 1;
  }
  const avg = (key) => {
    const vals = critiques.map((c) => Number(c.scores?.[key])).filter((n) => Number.isFinite(n));
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };
  const overalls = critiques.map((c) => Number(c.overall)).filter((n) => Number.isFinite(n));
  const overallAvg = overalls.length
    ? Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10
    : null;
  const latencies = results.map((r) => r.latencyMs).filter((n) => Number.isFinite(n));
  const p50 = percentile(latencies, 0.5);
  const p90 = percentile(latencies, 0.9);
  const byArea = {};
  for (const r of results) {
    if (!byArea[r.area]) byArea[r.area] = { n: 0, overallSum: 0, rated: 0, fails: 0 };
    byArea[r.area].n += 1;
    if (Number.isFinite(Number(r.critique?.overall))) {
      byArea[r.area].overallSum += Number(r.critique.overall);
      byArea[r.area].rated += 1;
    }
    if (r.critique?.verdict === "fail" || !r.ok) byArea[r.area].fails += 1;
  }
  const areaRows = Object.entries(byArea).map(([area, s]) => ({
    area,
    probes: s.n,
    avgOverall: s.rated ? Math.round((s.overallSum / s.rated) * 10) / 10 : null,
    fails: s.fails,
  }));
  const topFails = results
    .filter((r) => r.critique?.verdict === "fail" || r.critique?.fixPriority === "P0")
    .sort((a, b) => (Number(a.critique?.overall) || 0) - (Number(b.critique?.overall) || 0))
    .slice(0, 12)
    .map((r) => ({
      feature: r.feature,
      area: r.area,
      overall: r.critique?.overall ?? null,
      priority: r.critique?.fixPriority ?? null,
      gap: r.critique?.gapVsSkyscanner ?? r.error,
      summary: r.critique?.summary ?? null,
    }));
  return {
    probeCount: results.length,
    chatOk: results.filter((r) => r.ok).length,
    critiqueOk: critiques.length,
    byVerdict,
    overallAvg,
    scoreAvgs: {
      intentGrasp: avg("intentGrasp"),
      featureCoverage: avg("featureCoverage"),
      honestyAboutGaps: avg("honestyAboutGaps"),
      groundingOffers: avg("groundingOffers"),
      agencyVoicePkr: avg("agencyVoicePkr"),
      actionability: avg("actionability"),
    },
    latency: {
      avgMs: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      p50Ms: p50,
      p90Ms: p90,
      maxMs: latencies.length ? Math.max(...latencies) : null,
    },
    byArea: areaRows,
    topFails,
  };
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))));
  return s[idx];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let results;

  if (process.env.SKIP_CHAT === "1" && existsSync(OUT_FILE)) {
    log("SKIP_CHAT=1 — loading existing results");
    const prev = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    results = prev.results;
  } else {
    log(`Hotel chat eval: ${PROBES.length} probes → ${CHAT_URL} (concurrency=${CONCURRENCY})`);
    results = await mapPool(PROBES, CONCURRENCY, async (probe, i) => {
      log(`[${i + 1}/${PROBES.length}] chat: ${probe.feature}`);
      const turn = await chatOnce(probe, i);
      const hotels = turn.offers.filter((o) => o.type === "hotel").length;
      log(
        `  → ${turn.ok ? "ok" : "ERR"} ${turn.latencyMs}ms hotels=${hotels}/${turn.offers.length} ${(turn.reply || turn.error || "").slice(0, 80).replace(/\s+/g, " ")}`,
      );
      return turn;
    });
    writeFileSync(
      OUT_FILE,
      JSON.stringify({ generatedAt: new Date().toISOString(), phase: "chat", results }, null, 2),
    );
    log(`Wrote chat phase → ${OUT_FILE}`);
  }

  if (process.env.SKIP_CRITIQUE !== "1") {
    log(`Critique via ${LMSTUDIO_BASE_URL} model=${LMSTUDIO_MODEL}`);
    for (let i = 0; i < results.length; i++) {
      const turn = results[i];
      log(`[${i + 1}/${results.length}] critique: ${turn.feature}`);
      turn.critique = await critiqueOne(turn);
      const v = turn.critique?.verdict || turn.critique?.error || "?";
      const o = turn.critique?.overall ?? "-";
      log(`  → ${v} overall=${o}`);
      if ((i + 1) % 5 === 0) {
        writeFileSync(
          OUT_FILE,
          JSON.stringify({ generatedAt: new Date().toISOString(), phase: "critique-partial", results }, null, 2),
        );
      }
    }
  }

  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      chatUrl: CHAT_URL,
      lmstudioBaseUrl: LMSTUDIO_BASE_URL,
      lmstudioModel: LMSTUDIO_MODEL,
      concurrency: CONCURRENCY,
      location: LOCATION,
      mode: "hotel_natural_only",
    },
    summary,
    results,
  };
  writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
  log("DONE", JSON.stringify(summary.byVerdict), `overallAvg=${summary.overallAvg}`);
  log(`Report → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
