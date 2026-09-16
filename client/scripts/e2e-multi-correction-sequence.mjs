/**
 * Multi-turn sequential correction regression.
 * Run: node scripts/e2e-multi-correction-sequence.mjs
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

function offerRoutes(data) {
  return (data.searchPanel?.offers ?? [])
    .filter((o) => o.flight)
    .map((o) => ({
      origin: o.flight.originCode,
      destination: o.flight.destinationCode,
      date: o.flight.departureDate,
    }));
}

function assert(name, cond, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function expectQuery(q, { origin, destination, departureDate }) {
  return (
    q?.origin === origin &&
    q?.destination === destination &&
    q?.departureDate === departureDate
  );
}

function noStaleRoutes(routes, forbidden) {
  return !routes.some(
    (r) =>
      (forbidden.origin && r.origin === forbidden.origin) ||
      (forbidden.destination && r.destination === forbidden.destination),
  );
}

async function main() {
  const history = [];
  let previousTravelPlan = null;
  const report = { turns: [], bonus: null, status: "PENDING" };

  const steps = [
    {
      label: "T1",
      message: "I want to fly from Lahore to Dubai on September 10, 2026.",
      expect: { origin: "LHE", destination: "DXB", departureDate: "2026-09-10" },
      forbidOffers: null,
    },
    {
      label: "T2",
      message: "Actually Istanbul instead on September 15.",
      expect: { origin: "LHE", destination: "IST", departureDate: "2026-09-15" },
      forbidOffers: { destination: "DXB" },
    },
    {
      label: "T3",
      message: "No, London instead.",
      expect: { origin: "LHE", destination: "LHR", departureDate: "2026-09-15" },
      forbidOffers: { destination: "DXB" },
      alsoForbidDest: "IST",
    },
    {
      label: "T4",
      message: "Actually from Karachi.",
      expect: { origin: "KHI", destination: "LHR", departureDate: "2026-09-15" },
      forbidOffers: { origin: "LHE", destination: "DXB" },
    },
  ];

  console.log("\n=== Multi-turn sequential correction ===\n");

  for (const step of steps) {
    console.log(`${step.label}: "${step.message}"`);
    const data = await turn(step.message, history, previousTravelPlan);
    const plan = data.meta?.travelPlan ?? null;
    const q = flightQuery(plan);
    const routes = offerRoutes(data);

    const entry = {
      label: step.label,
      user: step.message,
      previousTravelPlan: previousTravelPlan
        ? {
            action: previousTravelPlan.action,
            query: flightQuery(previousTravelPlan),
          }
        : null,
      mergedPlan: { action: plan?.action, query: q },
      finalTravelportRequest: q
        ? {
            origin: q.origin,
            destination: q.destination,
            departureDate: q.departureDate,
          }
        : null,
      resultRoutes: routes,
      offerCount: routes.length,
      liveFlights: data.searchPanel?.liveFlights ?? false,
      reply: data.reply?.slice(0, 140),
    };
    report.turns.push(entry);

    assert(
      `${step.label} plan ${step.expect.origin}→${step.expect.destination} ${step.expect.departureDate}`,
      expectQuery(q, step.expect),
      JSON.stringify(q),
    );

    if (step.forbidOffers) {
      assert(
        `${step.label} offers match active route`,
        routes.length === 0 ||
          routes.every(
            (r) =>
              r.origin === step.expect.origin &&
              r.destination === step.expect.destination,
          ),
        JSON.stringify(routes),
      );
      assert(
        `${step.label} no stale ${step.forbidOffers.destination || step.forbidOffers.origin} offers`,
        noStaleRoutes(routes, step.forbidOffers),
        JSON.stringify(routes),
      );
    }
    if (step.alsoForbidDest) {
      assert(
        `${step.label} no stale ${step.alsoForbidDest} offers`,
        !routes.some((r) => r.destination === step.alsoForbidDest),
        JSON.stringify(routes),
      );
    }

    history.push({ role: "user", content: step.message });
    history.push({ role: "assistant", content: data.reply || "" });
    previousTravelPlan = plan ?? previousTravelPlan;
    console.log("");
  }

  // Bonus: reverse correction
  console.log('T5: "I want Dubai instead."');
  const t5 = await turn("I want Dubai instead.", history, previousTravelPlan);
  const plan5 = t5.meta?.travelPlan ?? null;
  const q5 = flightQuery(plan5);
  const routes5 = offerRoutes(t5);
  report.bonus = {
    user: "I want Dubai instead.",
    mergedPlan: { action: plan5?.action, query: q5 },
    finalTravelportRequest: q5
      ? { origin: q5.origin, destination: q5.destination, departureDate: q5.departureDate }
      : null,
    resultRoutes: routes5,
    reply: t5.reply?.slice(0, 140),
  };

  assert(
    "T5 KHI→DXB 2026-09-15",
    expectQuery(q5, { origin: "KHI", destination: "DXB", departureDate: "2026-09-15" }),
    JSON.stringify(q5),
  );
  assert(
    "T5 no LHR offers",
    routes5.length === 0 || !routes5.some((r) => r.destination === "LHR"),
    JSON.stringify(routes5),
  );

  report.status = process.exitCode ? "FAIL" : "PASS";
  writeFileSync(
    resolve(__dir, "../e2e-multi-correction-sequence.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`\n${report.status} → e2e-multi-correction-sequence.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
