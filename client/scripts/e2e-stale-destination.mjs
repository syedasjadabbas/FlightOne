/**
 * Live regression: latest explicit route/date must override previousTravelPlan.
 * Run with: node scripts/e2e-stale-destination.mjs
 * Requires: next dev on localhost:3000
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

async function turn(message, history, previousTravelPlan) {
  const res = await fetch("http://localhost:3000/api/chat", {
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
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

function offerDests(data) {
  return (data.searchPanel?.offers ?? [])
    .filter((o) => o.type === "flight" && o.flight)
    .map((o) => o.flight.destinationCode);
}

function assert(name, cond, detail = "") {
  if (cond) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

async function main() {
  const report = { cases: [] };

  // —— Live regression 1: DXB → IST + date ——
  {
    console.log("\n=== Case A: Istanbul instead ===");
    const history = [];
    let plan = null;

    const t1 = await turn(
      "I want to fly from Lahore to Dubai on September 10, 2026.",
      history,
      null,
    );
    plan = t1.meta?.travelPlan ?? null;
    const q1 = flightQuery(plan);
    console.log("T1 query:", q1, "offers:", t1.searchPanel?.offers?.length ?? 0);
    assert(
      "A1 LHE→DXB 2026-09-10",
      q1?.origin === "LHE" && q1?.destination === "DXB" && q1?.departureDate === "2026-09-10",
      JSON.stringify(q1),
    );
    history.push({ role: "user", content: "I want to fly from Lahore to Dubai on September 10, 2026." });
    history.push({ role: "assistant", content: t1.reply || "" });

    const t2 = await turn(
      "I want to go to Istanbul instead on September 15.",
      history,
      plan,
    );
    plan = t2.meta?.travelPlan ?? plan;
    const q2 = flightQuery(plan);
    const dests = offerDests(t2);
    console.log("T2 query:", q2, "dests:", [...new Set(dests)], "reply:", t2.reply?.slice(0, 100));
    assert(
      "A2 LHE→IST 2026-09-15",
      q2?.origin === "LHE" && q2?.destination === "IST" && q2?.departureDate === "2026-09-15",
      JSON.stringify(q2),
    );
    assert("A2 zero DXB offers", !dests.includes("DXB"), dests.join(","));
    assert(
      "A2 IST offers or empty (not DXB)",
      dests.length === 0 || dests.every((d) => d === "IST"),
      dests.join(","),
    );
    report.cases.push({ id: "A", q1, q2, dests });
  }

  // —— Live regression 2: KHI→LHR ——
  {
    console.log("\n=== Case B: Karachi to London ===");
    const history = [];
    let plan = null;

    const t1 = await turn("Lahore to Dubai", history, null);
    plan = t1.meta?.travelPlan ?? null;
    history.push({ role: "user", content: "Lahore to Dubai" });
    history.push({ role: "assistant", content: t1.reply || "" });

    const t2 = await turn(
      "Actually I want to fly from Karachi to London on September 15.",
      history,
      plan,
    );
    plan = t2.meta?.travelPlan ?? plan;
    const q2 = flightQuery(plan);
    const dests = offerDests(t2);
    const origins = (t2.searchPanel?.offers ?? [])
      .filter((o) => o.flight)
      .map((o) => o.flight.originCode);
    console.log("T2 query:", q2, "origins:", [...new Set(origins)], "dests:", [...new Set(dests)]);
    assert(
      "B2 KHI→LHR 2026-09-15",
      q2?.origin === "KHI" && q2?.destination === "LHR" && q2?.departureDate === "2026-09-15",
      JSON.stringify(q2),
    );
    assert("B2 no LHE origin in offers", !origins.includes("LHE"), origins.join(","));
    assert("B2 no DXB dest in offers", !dests.includes("DXB"), dests.join(","));
    report.cases.push({ id: "B", q2, origins, dests });
  }

  // —— China clarify ——
  {
    console.log("\n=== Case C: China clarify ===");
    const history = [];
    const t1 = await turn("Lahore to Dubai", history, null);
    let plan = t1.meta?.travelPlan ?? null;
    history.push({ role: "user", content: "Lahore to Dubai" });
    history.push({ role: "assistant", content: t1.reply || "" });

    const t2 = await turn(
      "I want to go to China from Lahore on 15 sept",
      history,
      plan,
    );
    plan = t2.meta?.travelPlan ?? plan;
    const q2 = flightQuery(plan);
    const dests = offerDests(t2);
    console.log("T2 action:", plan?.action, "query:", q2, "reply:", t2.reply?.slice(0, 140));
    assert("C2 clarify OR no DXB search", plan?.action === "clarify" || q2?.destination !== "DXB", plan?.action);
    assert("C2 destination not DXB", q2?.destination !== "DXB", JSON.stringify(q2));
    assert("C2 zero DXB offers", !dests.includes("DXB"), dests.join(","));
    if (plan?.action === "clarify") {
      assert("C2 asks China city", /china|beijing|shanghai|city/i.test(t2.reply || ""), t2.reply);
    }
    report.cases.push({ id: "C", action: plan?.action, q2, dests, reply: t2.reply });
  }

  report.status = process.exitCode ? "FAIL" : "PASS";
  writeFileSync(resolve(__dir, "../e2e-stale-destination.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.status} → e2e-stale-destination.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
