/**
 * Smoke-test Travelport Search without printing secrets or tokens.
 * Usage: node scripts/smoke-travelport-search.js LHE DXB 2026-09-15
 */
import "dotenv/config";
import { isTravelportConfigured } from "../modules/suppliers/travelport/config.js";
import { searchFlights } from "../modules/suppliers/galileo.adapter.js";

async function main() {
  if (!isTravelportConfigured()) {
    console.error("FAIL: Travelport env not configured");
    process.exit(1);
  }

  const origin = (process.argv[2] || "LHE").toUpperCase();
  const destination = (process.argv[3] || "DXB").toUpperCase();
  const departureDate = process.argv[4] || defaultDate(21);

  console.log(`Searching ${origin} → ${destination} on ${departureDate}…`);
  const started = Date.now();
  try {
    const offers = await searchFlights({
      origin,
      destination,
      departureDate,
      passengers: 1,
      cabinClass: "ECONOMY",
    });
    const ms = Date.now() - started;
    console.log(`OK: ${offers.length} offers in ${ms}ms`);
    for (const o of offers.slice(0, 5)) {
      console.log(
        `- ${o.offerId.slice(0, 40)}… ${o.currency} ${(o.amountMinor / 100).toFixed(2)} ` +
          `${o.details?.carrier || "?"} stops=${o.details?.stops ?? "?"} ` +
          `dep=${o.details?.departTimeLocal || "?"}`,
      );
    }
    if (offers.length === 0) {
      console.warn("WARN: zero offers — route/date may have no GDS content for this PCC");
      process.exit(2);
    }
  } catch (e) {
    console.error(`FAIL: ${e?.message || e}`);
    process.exit(1);
  }
}

function defaultDate(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

main();
