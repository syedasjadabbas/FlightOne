/**
 * Multi-turn conversation continuity live test.
 * Run: node scripts/e2e-multiturn-continuity.mjs
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
    const leg = plan.searches?.find((s) => s.product === "FLIGHT");
    return leg?.query ?? null;
  }
  if (plan.action === "clarify" && plan.draft) {
    const leg = plan.draft.searches?.find((s) => s.product === "FLIGHT");
    return leg?.query ?? null;
  }
  return null;
}

const report = { conversations: [], status: "PENDING" };

async function runConversation(label, steps) {
  const history = [];
  let previousTravelPlan = null;
  const log = { label, turns: [] };

  for (const step of steps) {
    const data = await turn(step.message, history, previousTravelPlan);
    previousTravelPlan = data.meta?.travelPlan ?? previousTravelPlan;
    const q = flightQuery(previousTravelPlan);
    const offers = data.searchPanel?.offers ?? [];
    const entry = {
      user: step.message,
      reply: data.reply,
      action: previousTravelPlan?.action,
      query: q,
      liveFlights: data.searchPanel?.liveFlights,
      offerCount: offers.length,
      reaskedDestination: /where would you like to fly/i.test(data.reply || ""),
      reaskedKnownRoute: false,
    };
    if (step.expectPreserve) {
      entry.preserved = {
        origin: q?.origin === step.expectPreserve.origin,
        destination: q?.destination === step.expectPreserve.destination,
        departureDate: q?.departureDate === step.expectPreserve.departureDate,
      };
    }
    log.turns.push(entry);
    history.push({ role: "user", content: step.message });
    history.push({ role: "assistant", content: data.reply });
    console.log(`\n[${label}] USER: ${step.message}`);
    console.log(`  AVA: ${data.reply?.slice(0, 120)}`);
    console.log(`  plan=${previousTravelPlan?.action} query=${JSON.stringify(q)}`);
  }

  report.conversations.push(log);
}

console.log("=== Conversation 1: Karachi → Dubai + yes ===");
await runConversation("KHI-DXB-yes", [
  {
    message: "i wanna fly to dubai from karachi on 10th sept",
    expectPreserve: { origin: "KHI", destination: "DXB", departureDate: "2026-09-10" },
  },
  {
    message: "yes",
    expectPreserve: { origin: "KHI", destination: "DXB", departureDate: "2026-09-10" },
  },
  {
    message: "one way",
    expectPreserve: { origin: "KHI", destination: "DXB", departureDate: "2026-09-10" },
  },
]);

console.log("\n=== Conversation 2: Lahore → Dubai Sep 10 ===");
await runConversation("LHE-DXB", [
  {
    message: "i wanna fly from lahore to dubai on september 10",
    expectPreserve: { origin: "LHE", destination: "DXB", departureDate: "2026-09-10" },
  },
]);

console.log("\n=== Conversation 3: RT Karachi Dubai ===");
await runConversation("KHI-DXB-RT", [
  {
    message: "return flight from karachi to dubai from september 10 to september 15",
    expectPreserve: {
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    },
  },
]);

const c1 = report.conversations[0];
const last = c1.turns[c1.turns.length - 1];
const noReask = c1.turns.every((t) => !t.reaskedDestination);
const preserved = c1.turns.every(
  (t) => !t.preserved || (t.preserved.origin && t.preserved.destination && t.preserved.departureDate),
);
const finalQuery = last.query;

report.status =
  noReask &&
  preserved &&
  finalQuery?.origin === "KHI" &&
  finalQuery?.destination === "DXB" &&
  finalQuery?.departureDate === "2026-09-10"
    ? "PASS"
    : "FAIL";

report.finalTravelportRequest = finalQuery;

const out = resolve(__dir, "../e2e-multiturn-continuity.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nWrote ${out}`);
console.log(`STATUS: ${report.status}`);
console.log("Final query:", JSON.stringify(finalQuery));
process.exit(report.status === "PASS" ? 0 : 1);
