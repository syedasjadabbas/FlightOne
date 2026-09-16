/**
 * Live: China clarify → "beijing on 10 sept" — report exact Travelport request.
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
    .map((o) => `${o.flight.originCode}→${o.flight.destinationCode}`);
}

async function main() {
  const history = [];
  let plan = null;
  const report = { turns: [] };

  const t1 = await turn("Lahore to Dubai", history, null);
  plan = t1.meta?.travelPlan ?? null;
  report.turns.push({
    user: "Lahore to Dubai",
    action: plan?.action,
    query: flightQuery(plan),
    reply: t1.reply?.slice(0, 120),
    offerRoutes: [...new Set(offerRoutes(t1))],
  });
  history.push({ role: "user", content: "Lahore to Dubai" });
  history.push({ role: "assistant", content: t1.reply || "" });

  const t2 = await turn("I want to go to China from Lahore on 15 sept", history, plan);
  plan = t2.meta?.travelPlan ?? plan;
  report.turns.push({
    user: "I want to go to China from Lahore on 15 sept",
    action: plan?.action,
    query: flightQuery(plan),
    reply: t2.reply?.slice(0, 160),
    offerRoutes: [...new Set(offerRoutes(t2))],
    offerCount: t2.searchPanel?.offers?.length ?? 0,
  });
  history.push({ role: "user", content: "I want to go to China from Lahore on 15 sept" });
  history.push({ role: "assistant", content: t2.reply || "" });

  const t3 = await turn("beijing on 10 sept", history, plan);
  plan = t3.meta?.travelPlan ?? plan;
  const q3 = flightQuery(plan);
  const routes = offerRoutes(t3);
  report.turns.push({
    user: "beijing on 10 sept",
    action: plan?.action,
    query: q3,
    reply: t3.reply,
    offerRoutes: [...new Set(routes)],
    offerCount: routes.length,
    liveFlights: t3.searchPanel?.liveFlights,
    hasDxb: routes.some((r) => r.includes("DXB")),
    finalTravelportRequest: q3
      ? {
          origin: q3.origin,
          destination: q3.destination,
          departureDate: q3.departureDate,
          passengers: q3.passengers,
          cabinClass: q3.cabinClass,
        }
      : null,
  });

  // Also simulate bad client state: previousPlan still DXB search
  const dxbPlan = {
    action: "search",
    searches: [
      {
        product: "FLIGHT",
        query: {
          origin: "LHE",
          destination: "DXB",
          departureDate: "2026-09-10",
          passengers: 1,
          cabinClass: "ECONOMY",
        },
      },
    ],
  };
  const tBad = await turn("beijing on 10 sept", history, dxbPlan);
  const qBad = flightQuery(tBad.meta?.travelPlan);
  report.stalePreviousPlanSim = {
    previousWas: "LHE→DXB search",
    query: qBad,
    reply: tBad.reply?.slice(0, 160),
    offerRoutes: [...new Set(offerRoutes(tBad))],
  };

  console.log(JSON.stringify(report, null, 2));
  writeFileSync(resolve(__dir, "../e2e-beijing-clarify.json"), JSON.stringify(report, null, 2));

  const ok =
    q3?.origin === "LHE" &&
    q3?.destination === "PEK" &&
    q3?.departureDate === "2026-09-10" &&
    !routes.some((r) => r.includes("DXB"));
  console.log(ok ? "\nPASS expected LHE→PEK" : "\nFAIL — see report");
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
