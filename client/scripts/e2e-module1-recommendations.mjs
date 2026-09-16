/**
 * Module 1 live verification: LHE→DXB curated recommendations + stale protection.
 * Run: node scripts/e2e-module1-recommendations.mjs
 * Requires: next dev on :3000 with Travelport-backed /api/chat
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CHAT = process.env.CHAT_URL || "http://localhost:3000/api/chat";

const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

const FABRICATED =
  /\b(top-rated carrier|more reliable|most reliable|loyalty miles|invented|fabricat)\b/i;

async function turn(message, history = [], previousTravelPlan = null) {
  const res = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      location: LOCATION,
      previousTravelPlan,
      stream: false,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function flightQuery(plan) {
  if (!plan) return null;
  if (plan.action === "search") {
    return plan.searches?.find((s) => s.product === "FLIGHT")?.query ?? null;
  }
  if (plan.action === "clarify" && plan.draft) {
    return plan.draft.searches?.find((s) => s.product === "FLIGHT")?.query ?? null;
  }
  return null;
}

function assert(name, cond, detail = "") {
  if (cond) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

async function main() {
  const report = { chat: CHAT, cases: [] };
  console.log(`\nModule 1 recommendations E2E → ${CHAT}\n`);

  // —— Case 1: LHE→DXB live curated offers ——
  {
    console.log("=== Case 1: LHE→DXB curated Best/Cheapest/Fastest ===");
    const msg =
      "Find flights from Lahore to Dubai on September 18, 2026 for 1 adult.";
    const data = await turn(msg);
    const plan = data.meta?.travelPlan ?? null;
    const q = flightQuery(plan);
    const curated = Array.isArray(data.offers) ? data.offers : [];
    const panel = data.searchPanel?.offers ?? [];
    const angles = curated.map((o) => o.angle);
    const ids = curated.map((o) => o.id);
    const uniqueIds = new Set(ids);

    console.log("query:", q);
    console.log("curated angles:", angles);
    console.log("curated count:", curated.length, "panel:", panel.length);
    console.log(
      "reasons:",
      curated.map((o) => ({ angle: o.angle, reasons: o.reasons })),
    );

    assert("T1 travelPlan is search", plan?.action === "search", String(plan?.action));
    assert("T1 origin LHE", q?.origin === "LHE", String(q?.origin));
    assert("T1 destination DXB", q?.destination === "DXB", String(q?.destination));
    assert("T1 date 2026-09-18", q?.departureDate === "2026-09-18", String(q?.departureDate));
    assert("T1 live flights", data.meta?.liveFlights === true, String(data.meta?.liveFlights));
    assert("T1 has curated offers", curated.length > 0, String(curated.length));
    assert(
      "T1 has best_value",
      angles.includes("best_value"),
      angles.join(","),
    );

    const minPrice = Math.min(
      ...panel.map((o) => o.priceMinor).filter((n) => Number.isFinite(n)),
    );
    const minDur = Math.min(
      ...panel
        .map((o) => o.flight?.durationMinutes)
        .filter((n) => typeof n === "number" && n > 0),
    );
    const cheapId = panel.find((o) => o.priceMinor === minPrice)?.id;
    const fastId = panel.find((o) => o.flight?.durationMinutes === minDur)?.id;
    const bestId = curated.find((o) => o.angle === "best_value")?.id;
    const expectedIds = new Set([bestId, cheapId, fastId].filter(Boolean));

    console.log("axis winners:", { bestId, cheapId, fastId, expected: expectedIds.size });

    if (expectedIds.size >= 3) {
      assert(
        "T1 three distinct curated angles when axes diverge",
        angles.includes("best_value") &&
          angles.includes("cheapest") &&
          angles.includes("fastest"),
        angles.join(","),
      );
      assert(
        "T1 three distinct curated ids when axes diverge",
        uniqueIds.size >= 3,
        ids.join(","),
      );
    } else if (expectedIds.size === 2) {
      assert(
        "T1 at least two curated when two axes diverge",
        curated.length >= 2,
        `got ${curated.length}; axes=${[...expectedIds].join(",")}`,
      );
      assert(
        "T1 includes cheapest or fastest when axes diverge",
        angles.includes("cheapest") || angles.includes("fastest"),
        angles.join(","),
      );
    } else {
      assert(
        "T1 single dominant offer may curate to one",
        curated.length >= 1,
        String(curated.length),
      );
    }
    assert(
      "T1 no duplicate curated ids",
      uniqueIds.size === ids.length,
      ids.join(","),
    );

    for (const o of curated) {
      assert(
        `T1 ${o.angle} has reasons`,
        Array.isArray(o.reasons) && o.reasons.length > 0,
      );
      assert(
        `T1 ${o.angle} reasons not fabricated`,
        !o.reasons.some((r) => FABRICATED.test(r)),
        JSON.stringify(o.reasons),
      );
      if (o.type === "flight" && o.flight) {
        assert(
          `T1 ${o.angle} route LHE→DXB (or nearby)`,
          o.flight.originCode === "LHE" &&
            (o.flight.destinationCode === "DXB" || Boolean(o.flight.nearbyAirport)),
          `${o.flight.originCode}→${o.flight.destinationCode}`,
        );
      }
    }

    // Panel badges should reflect curated angles for matching ids
    const curatedById = new Map(curated.map((o) => [o.id, o.angle]));
    const panelHits = panel.filter((o) => curatedById.has(o.id));
    if (panelHits.length > 0) {
      assert(
        "T1 panel stamps curated angles",
        panelHits.every((o) => o.angle === curatedById.get(o.id)),
      );
    }

    report.cases.push({
      name: "lhe-dxb-curated",
      query: q,
      curated: curated.map((o) => ({
        id: o.id,
        angle: o.angle,
        price: o.price,
        reasons: o.reasons,
      })),
      panelCount: panel.length,
      reply: data.reply,
    });
  }

  // —— Case 2: stale route protection ——
  {
    console.log("\n=== Case 2: stale DXB must not leak after IST correction ===");
    const history = [];
    let plan = null;

    const t1 = await turn(
      "I want to fly from Lahore to Dubai on September 20, 2026.",
      history,
      null,
    );
    plan = t1.meta?.travelPlan ?? null;
    history.push({ role: "user", content: "I want to fly from Lahore to Dubai on September 20, 2026." });
    history.push({ role: "assistant", content: t1.reply || "ok" });

    const t2 = await turn(
      "Actually Istanbul instead, same date.",
      history,
      plan,
    );
    const q2 = flightQuery(t2.meta?.travelPlan);
    const dests = (t2.searchPanel?.offers ?? [])
      .filter((o) => o.type === "flight" && o.flight)
      .map((o) => o.flight.destinationCode);
    const curatedDests = (t2.offers ?? [])
      .filter((o) => o.type === "flight" && o.flight)
      .map((o) => o.flight.destinationCode);

    console.log("T2 query:", q2, "panel dests sample:", [...new Set(dests)].slice(0, 6));

    assert("T2 destination IST", q2?.destination === "IST", String(q2?.destination));
    assert(
      "T2 panel has no DXB leakage when results exist",
      dests.length === 0 || !dests.includes("DXB"),
      dests.filter((d) => d === "DXB").length + " DXB",
    );
    assert(
      "T2 curated has no DXB leakage",
      curatedDests.length === 0 || !curatedDests.includes("DXB"),
      curatedDests.join(","),
    );

    report.cases.push({
      name: "stale-destination",
      query: q2,
      panelDests: [...new Set(dests)],
      curatedDests: [...new Set(curatedDests)],
    });
  }

  const out = resolve(__dir, "../e2e-module1-recommendations.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
  console.log(process.exitCode ? "\nFAILED" : "\nPASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
