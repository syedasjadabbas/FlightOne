#!/usr/bin/env node
/**
 * Ava playbook eval: natural queries → POST /api/chat → LM Studio critique → JSON report.
 *
 * Usage: node scripts/ava-playbook-eval.mjs
 * Env: CHAT_URL (default http://localhost:3000/api/chat),
 *      LMSTUDIO_BASE_URL, LMSTUDIO_MODEL, CONCURRENCY (default 1), SKIP_CHAT, SKIP_CRITIQUE
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tmp");
const OUT_FILE = join(OUT_DIR, "ava-playbook-eval.json");

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

/** Natural-only probes from ava-chat-query-playbook.canvas.tsx */
const PROBES = [
  {
    area: "Discovery",
    feature: "Explore Everywhere",
    details: "Cheapest to any destination; country→city drill-down; map of prices",
    natural:
      "I’m in Lahore and want a cheap international getaway next month — where should I go if I’m flexible on destination?",
  },
  {
    area: "Discovery",
    feature: "Country as destination",
    details: "Type ‘Italy’ / ‘Thailand’ → cheapest entry cities",
    natural: "Find me flights from Lahore to Thailand sometime in October — whichever Thai city is cheapest.",
  },
  {
    area: "Discovery",
    feature: "Nearby airports",
    details: "Expand origin/dest to nearby airports; city vs airport search",
    natural: "Flights from Lahore to London on 12 September, stay a week.",
  },
  {
    area: "Discovery",
    feature: "Explore with AI (NL discovery)",
    details: "Natural-language trip goals → destination shortlist with vibe/price/weather",
    natural: "Plan something beachy and romantic under 250,000 PKR per person from Lahore in November.",
  },
  {
    area: "Discovery",
    feature: "AI Road Trip Planner",
    details: "Scenic/fastest/cultural drive itinerary + car hire",
    natural: "We’re landing in Dubai and want a scenic road trip for 5 days — ideas?",
  },
  {
    area: "Flexible dates",
    feature: "Whole month calendar",
    details: "Indicative prices per day of month; cheapest days",
    natural: "Lahore to Dubai in August — which dates are cheapest?",
  },
  {
    area: "Flexible dates",
    feature: "Cheapest month",
    details: "Compare months of the year for a route",
    natural: "When is the cheapest month to fly Lahore to Istanbul in the next year?",
  },
  {
    area: "Alerts & deals",
    feature: "Price alerts",
    details: "Email/push when route+dates change; pax + direct pref remembered",
    natural: "Lahore to Doha on 20 September return 27 September — watch this for me if it gets cheaper.",
  },
  {
    area: "Alerts & deals",
    feature: "DROPS deals feed",
    details: "App feed of routes down ~20%+ in last 7 days",
    natural: "Any flash deals out of Pakistan this week?",
  },
  {
    area: "Core search",
    feature: "One-way vs return",
    details: "Primary trip-type toggle",
    natural: "One-way Lahore to Jeddah on 5 September.",
  },
  {
    area: "Core search",
    feature: "Multi-city (≤6 legs)",
    details: "Structured multi-leg builder; open-jaw",
    natural:
      "Lahore to Bali 25 Aug, 4 nights, layover Bangkok 2 nights, then back to Lahore.",
  },
  {
    area: "Core search",
    feature: "Open-jaw",
    details: "Fly into A, out of B via multi-city",
    natural: "Fly Lahore to Istanbul, travel overland to Cappadocia, fly home from Kayseri.",
  },
  {
    area: "Core search",
    feature: "Cabin classes",
    details: "Economy / Premium Economy / Business / First",
    natural: "Business class Lahore to Dubai return mid-September for 4 nights.",
  },
  {
    area: "Core search",
    feature: "Passenger types",
    details: "Adults, children 2–17, lap infants, seated infants",
    natural: "Family of 2 adults and 1 child (age 6) Lahore to Dubai 12–16 Sep.",
  },
  {
    area: "Filters — luggage",
    feature: "Checked bag included",
    details: "Filter / true-cost with checked bag fees",
    natural: "Lahore to Bangkok 1 Oct, 1 week — I need at least one checked bag.",
  },
  {
    area: "Filters — luggage",
    feature: "Carry-on / cabin bag rules",
    details: "Carry-on inclusion; size/weight guidance by fare brand",
    natural: "Cheapest Lahore–Dubai next Friday if I only carry cabin bag.",
  },
  {
    area: "Filters — luggage",
    feature: "Fare brand bags matrix",
    details: "Light vs Standard vs Flex baggage compare",
    natural: "Emirates vs Flydubai Lahore–Dubai — what’s included for bags?",
  },
  {
    area: "Filters — layover",
    feature: "Direct / nonstop only",
    details: "Exclude all connecting flights",
    natural: "Direct flight Lahore to Dubai on 18 August.",
  },
  {
    area: "Filters — layover",
    feature: "Max stops",
    details: "0 / 1 / 2+ stop toggles",
    natural: "Lahore to London 21 Aug — max one stop.",
  },
  {
    area: "Filters — layover",
    feature: "Max layover duration",
    details: "Slider for longest acceptable connection",
    natural: "Lahore to London with connections — don’t make me wait more than 3 hours.",
  },
  {
    area: "Filters — layover",
    feature: "Exclude / prefer layover airports",
    details: "Exclude transit hubs (e.g. avoid IST)",
    natural: "Lahore to Paris mid-September, prefer connection in Doha or Dubai.",
  },
  {
    area: "Filters — layover",
    feature: "Overnight layover control",
    details: "Include/exclude overnight connections",
    natural: "I don’t want an overnight layover on the way to London.",
  },
  {
    area: "Filters — layover",
    feature: "Intentional stopover (leisure)",
    details: "User-requested multi-day stop (not filter)",
    natural:
      "Qatar to London 21 Aug, return via Madinah with 3-day layover, then Lahore.",
  },
  {
    area: "Filters — self-transfer",
    feature: "Self-transfer warnings",
    details: "Separate tickets, bag re-check, protected vs not",
    natural: "Cheapest possible Lahore to Europe even if low-cost connections.",
  },
  {
    area: "Filters — time",
    feature: "Departure / arrival time bands",
    details: "Morning/afternoon/evening sliders",
    natural: "Lahore to Istanbul leaving after 2pm on 8 September.",
  },
  {
    area: "Filters — time",
    feature: "Max total duration",
    details: "Cap door-to-door journey time",
    natural: "Lahore to London — nothing over 16 hours total.",
  },
  {
    area: "Filters — carriers",
    feature: "Airline include/exclude",
    details: "Checkbox list of carriers in results",
    natural: "Lahore to Dubai on Emirates only, 10–14 Sep.",
  },
  {
    area: "Filters — carriers",
    feature: "Alliance filter",
    details: "oneworld / SkyTeam / Star Alliance",
    natural: "Prefer oneworld airlines Lahore to London in September.",
  },
  {
    area: "Filters — budget",
    feature: "Price cap slider",
    details: "Max budget for trip",
    natural: "Lahore–Dubai under 80,000 PKR return if possible.",
  },
  {
    area: "Filters — green",
    feature: "Greener Choice (CO2)",
    details: "Lower-than-average emissions routes",
    natural: "Greener option Lahore to Istanbul if you have one.",
  },
  {
    area: "Sorting",
    feature: "Best / Cheapest / Fastest",
    details: "Primary result sort modes",
    natural: "Options Lahore to Bangkok 3 Oct for a week.",
  },
  {
    area: "Stays",
    feature: "Broad Stays catalog",
    details: "Hotels, hostels, campsites, unique stays; amenity filters",
    natural: "Hotel in Bangkok near Sukhumvit, 1–4 Oct, 4★ with breakfast.",
  },
  {
    area: "Stays",
    feature: "Map + landmark distance",
    details: "Map search; distance to centre/landmarks",
    natural: "Stay near Burj Khalifa in Dubai 12–15 Sep.",
  },
  {
    area: "Car hire",
    feature: "Car hire + Fair Fuel",
    details: "Compare providers; Full-to-Full fuel policy; EV; pick-up type",
    natural: "Need a rental car at Dubai airport for 12–15 Sep.",
  },
  {
    area: "Booking",
    feature: "Multi-seller handoff",
    details: "Same fare from airline vs OTAs; book on provider site",
    natural: "I like the Etihad LHE–AUH option — where can I book it cheapest?",
  },
  {
    area: "Booking",
    feature: "Self-serve e-ticket",
    details: "Pay and ticket online without agency WhatsApp",
    natural: "Book the cheapest LHE–DXB for next Friday for me now.",
  },
  {
    area: "Account",
    feature: "Save / heart shortlists",
    details: "Saved flights/hotels across devices",
    natural: "Save these three Dubai options — I’ll decide tomorrow.",
  },
  {
    area: "In-trip",
    feature: "Live Flight Tracker",
    details: "Gate, terminal, baggage belt, delays",
    natural: "Track PK303 status today.",
  },
  {
    area: "Trust",
    feature: "Partner ratings",
    details: "Community scores before leaving to book",
    natural: "Is Kiwi/Expedia safer than booking airline direct for this fare?",
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
    .map(
      (o, i) =>
        `${i + 1}. [${o.type}] ${o.title} — ${o.price}${o.flight ? ` | ${o.flight.originCode}→${o.flight.destinationCode} stops=${o.flight.stops} bag=${o.flight.baggageKg}kg` : ""}`,
    )
    .join("\n");

  const system = `You are a strict product QA critic for Ava, FlightOne's Pakistan leisure travel consultant chat.
Score how well Ava handled a Skyscanner-parity feature probe.
Be honest: if Ava should NOT yet support something, "honest gap admission" can score higher than hallucinating the feature.
Return ONLY valid JSON (no markdown) matching this schema:
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

  const user = `Feature area: ${turn.area}
Feature: ${turn.feature}
Expected Skyscanner-like ability: ${turn.details}

Guest query (natural):
${turn.natural}

API ok: ${turn.ok}
Error: ${turn.error || "none"}
Latency ms: ${turn.latencyMs}
Provider: ${turn.meta?.provider ?? "unknown"}
Grounded: ${turn.meta?.grounded ?? false}
Live flights: ${turn.meta?.liveFlights ?? false}
Query source: ${turn.meta?.querySource ?? "unknown"}
Offer count: ${(turn.offers || []).length}
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
    const v = r.critique?.verdict || (r.ok ? "error" : "error");
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
    log(`Chat eval: ${PROBES.length} natural probes → ${CHAT_URL} (concurrency=${CONCURRENCY})`);
    results = await mapPool(PROBES, CONCURRENCY, async (probe, i) => {
      log(`[${i + 1}/${PROBES.length}] chat: ${probe.feature}`);
      const turn = await chatOnce(probe, i);
      log(
        `  → ${turn.ok ? "ok" : "ERR"} ${turn.latencyMs}ms offers=${turn.offers.length} ${(turn.reply || turn.error || "").slice(0, 80).replace(/\s+/g, " ")}`,
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
          JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              phase: "critique-partial",
              results,
            },
            null,
            2,
          ),
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
      mode: "natural_only",
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
