/**
 * Acceptance checks for flight search extraction (no LLM call required).
 * Run: node scripts/flight-search-acceptance.mjs
 */
import { parseTravelPlan, validateSearchPlan } from "../lib/consultant/travelPlan.ts";

const cases = [
  {
    name: "LHE → DXB Sep 10 2026",
    json: {
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "Lahore",
            destination: "Dubai",
            departureDate: "2026-09-10",
          },
        },
      ],
    },
    expect: { origin: "LHE", destination: "DXB", departureDate: "2026-09-10" },
  },
  {
    name: "LHE → KHI Sep 10 2026",
    json: {
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: { origin: "Lahore", destination: "Karachi", departureDate: "2026-09-10" },
        },
      ],
    },
    expect: { origin: "LHE", destination: "KHI", departureDate: "2026-09-10" },
  },
  {
    name: "LHE → IST Sep 11 2026",
    json: {
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: { origin: "Lahore", destination: "Istanbul", departureDate: "2026-09-11" },
        },
      ],
    },
    expect: { origin: "LHE", destination: "IST", departureDate: "2026-09-11" },
  },
  {
    name: "ISB → DXB",
    json: {
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: { origin: "Islamabad", destination: "Dubai", departureDate: "2026-09-10" },
        },
      ],
    },
    expect: { origin: "ISB", destination: "DXB", departureDate: "2026-09-10" },
  },
  {
    name: "Round trip LHE ↔ DXB",
    json: {
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "2026-09-10",
            returnDate: "2026-09-15",
          },
        },
      ],
    },
    expect: {
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
      returnDate: "2026-09-15",
    },
  },
];

let failed = 0;
for (const c of cases) {
  const plan = parseTravelPlan(JSON.stringify(c.json));
  if (plan?.action !== "search") {
    console.error(`FAIL ${c.name}: plan not search`, plan);
    failed++;
    continue;
  }
  const q = plan.searches[0].query;
  const v = validateSearchPlan(plan);
  const ok =
    v.ok &&
    q.origin === c.expect.origin &&
    q.destination === c.expect.destination &&
    q.departureDate === c.expect.departureDate &&
    (c.expect.returnDate == null || q.returnDate === c.expect.returnDate);
  console.log(`${ok ? "PASS" : "FAIL"} ${c.name}`, {
    origin: q.origin,
    destination: q.destination,
    departureDate: q.departureDate,
    returnDate: q.returnDate ?? null,
    validation: v,
  });
  if (!ok) failed++;
}

process.exit(failed > 0 ? 1 : 0);
