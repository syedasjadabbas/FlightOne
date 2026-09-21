/**
 * Live SerpAPI probe — requires server SERPAPI_API_KEY + Next INTERNAL_API_KEY.
 * Run: npx vitest run lib/comps/serpFlights.probe.test.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isSerpConfigured } from "./serpHotels";
import { searchGoogleFlights } from "./serpFlights";
import { fillEmptyFlightLegsFromWeb } from "./webLegFallback";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

function getFutureDate(daysAhead = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

describe("live SerpAPI probe", () => {
  it("searchGoogleFlights returns options for LHR→SFO", async () => {
    expect(isSerpConfigured()).toBe(true);

    const started = Date.now();
    const result = await searchGoogleFlights({
      origin: "LHR",
      destination: "SFO",
      outboundDate: getFutureDate(14),
      currency: "PKR",
    });
    const ms = Date.now() - started;

    console.log(`\n[serp-probe] LHR→SFO: ${result.options.length} options in ${ms}ms`);
    console.log(`[serp-probe] lowest: ${result.lowestPriceMajor ?? "n/a"} PKR`);
    for (const o of result.options.slice(0, 3)) {
      console.log(
        `  - ${o.carrierHint ?? "?"} ${o.airlines.join("/")} stops=${o.stops} ` +
          `PKR ${o.priceMajor ?? "?"} dur=${o.durationMinutes ?? "?"}m`,
      );
    }

    expect(result.options.length).toBeGreaterThan(0);
  }, 60_000);

  it("fillEmptyFlightLegsFromWeb fills empty GDS leg bucket", async () => {
    const filled = await fillEmptyFlightLegsFromWeb({
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHR",
            destination: "SFO",
            departureDate: getFutureDate(14),
            passengers: 1,
            cabinClass: "ECONOMY",
            requestedCurrency: "PKR",
          },
        },
      ],
      legBuckets: [[]],
      legLive: [false],
      currency: "PKR",
    });

    console.log(
      `\n[serp-probe] webLegFallback: ${filled.legBuckets[0]?.length ?? 0} offers, legWeb=${filled.legWeb[0]}`,
    );
    const first = filled.legBuckets[0]?.[0];
    if (first && first.type === "flight") {
      console.log(`  sample id=${first.id} tags=${first.tags.join(",")} supplier=${first.supplier}`);
    }

    expect(filled.legWeb[0]).toBe(true);
    expect(filled.legBuckets[0]?.length ?? 0).toBeGreaterThan(0);
  }, 60_000);
});
