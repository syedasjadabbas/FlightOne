#!/usr/bin/env node
/**
 * Runs the 3 literal agent-reported bug queries against a running Ava chat
 * server and reports reply + offers + distinct airlines per query.
 *
 * This does NOT toggle CONSULTANT_CANDIDATE_SEARCH itself — that flag is
 * read from the server process's env at request time, so to compare
 * before/after, run this script twice against two separate `next dev`
 * processes (one started with CONSULTANT_CANDIDATE_SEARCH unset, one with
 * it set to "true" in .env.local), then diff the two JSON reports.
 *
 * Usage: node scripts/compare-candidate-flow.mjs [label]
 * Env: CHAT_URL (default http://localhost:3000/api/chat)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tmp");

const CHAT_URL = process.env.CHAT_URL || "http://localhost:3000/api/chat";
const LABEL = process.argv[2] || (process.env.CONSULTANT_CANDIDATE_SEARCH === "true" ? "candidates" : "classic");
const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS) || 90_000;

const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

/** The 3 literal reference queries from the agent bug reports (see conversation). */
const QUERIES = [
  {
    id: "q1_pk_sfo_london_stopover_orlando_return",
    message:
      "best fare from Pakistan city may be lahore or Islamabad going SFO via 2 nights stopover in london stay in sfo 15 days return from orlando",
    expect: "Multi-leg: LHE/ISB→LHR (2-night stopover)→SFO (15-day stay)→MCO→home, NOT a one-way.",
  },
  {
    id: "q2_dubai_flexible_return_uae",
    message:
      "could you please quote best return fare for dubai stay in dubai 10 days dates would be in september +- need cheapest and reliable options going Dubai return can be from any city from UAE",
    expect: "A real round trip with multiple airline combinations, not one garbled one-way option.",
  },
  {
    id: "q3a_lhe_shj_lhe",
    message: "find fare lhe-shj-lhe 22sep-3oct",
    expect: "PIA quoted as an option, not only expensive Qatar Airways.",
  },
  {
    id: "q3b_lhe_dxb_lhe",
    message: "lhe-dxb-lhe",
    expect: "A round trip with PIA/Emirates also shown, not only a one-way Etihad fare.",
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

function distinctAirlines(offers) {
  const set = new Set();
  for (const o of offers || []) {
    const a = o.flight?.airline || o.subtitle?.split(" · ")[0];
    if (a) set.add(a);
  }
  return [...set];
}

async function runOne(q) {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(
      CHAT_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q.message, history: [], location: LOCATION, stream: false }),
      },
      CHAT_TIMEOUT_MS,
    );
    const ms = Date.now() - started;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ...q, ok: false, latencyMs: ms, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const offers = Array.isArray(data.offers) ? data.offers : [];
    return {
      ...q,
      ok: true,
      latencyMs: ms,
      reply: data.reply ?? "",
      offerCount: offers.length,
      airlines: distinctAirlines(offers),
      hasReturnLeg: offers.some((o) => o.flight?.returnDate || /round trip/i.test(o.subtitle || "")),
      meta: data.meta ?? null,
      offers,
    };
  } catch (err) {
    return { ...q, ok: false, latencyMs: Date.now() - started, error: err?.name === "AbortError" ? "timeout" : String(err?.message || err) };
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  log(`Running ${QUERIES.length} reference queries against ${CHAT_URL} (label="${LABEL}")`);

  const results = [];
  for (const q of QUERIES) {
    log(`→ ${q.id}: "${q.message}"`);
    const r = await runOne(q);
    results.push(r);
    if (r.ok) {
      log(`  ok ${r.latencyMs}ms offers=${r.offerCount} airlines=[${r.airlines.join(", ")}] returnLeg=${r.hasReturnLeg}`);
      log(`  expect: ${q.expect}`);
      log(`  reply: ${r.reply.slice(0, 220).replace(/\s+/g, " ")}`);
    } else {
      log(`  ERR ${r.latencyMs}ms ${r.error}`);
    }
  }

  const outFile = join(OUT_DIR, `compare-candidate-flow.${LABEL}.json`);
  writeFileSync(
    outFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), label: LABEL, chatUrl: CHAT_URL, results }, null, 2),
  );
  log(`Report → ${outFile}`);
  log(`Run again with the other server (flag flipped) using: node scripts/compare-candidate-flow.mjs <other-label>`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
