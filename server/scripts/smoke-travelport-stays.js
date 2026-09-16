/**
 * Smoke-test Travelport Stays SearchComplete without printing secrets.
 * Usage: node scripts/smoke-travelport-stays.js DXB 2026-09-20 2026-09-22
 */
import "dotenv/config";
import { isTravelportConfigured } from "../modules/suppliers/travelport/config.js";
import { searchHotels } from "../modules/suppliers/travelport/staysSearch.js";

async function main() {
  if (!isTravelportConfigured()) {
    console.error("FAIL: Travelport env not configured");
    process.exit(1);
  }

  const cityCode = (process.argv[2] || "DXB").toUpperCase();
  const checkInDate = process.argv[3] || defaultDate(21);
  const checkOutDate = process.argv[4] || defaultDate(23);

  console.log(`Searching hotels in ${cityCode} ${checkInDate} → ${checkOutDate}…`);
  const started = Date.now();
  try {
    const offers = await searchHotels({
      cityCode,
      checkInDate,
      checkOutDate,
      rooms: 1,
      guests: 2,
    });
    const ms = Date.now() - started;
    console.log(`OK: ${offers.length} offers in ${ms}ms`);
    for (const o of offers.slice(0, 5)) {
      const fx = o.details?.fxConverted
        ? ` (from ${o.details.sourceCurrency} ×${Number(o.details.fxFactor).toFixed(4)})`
        : "";
      console.log(
        `- ${String(o.details?.hotelName || o.offerId).slice(0, 40)} ` +
          `${o.currency} ${(o.amountMinor / 100).toFixed(2)}/night` +
          fx +
          ` ★${o.details?.starRating ?? "?"} ` +
          `${o.details?.roomType || ""}`,
      );
    }
    if (offers.length === 0) {
      console.warn("WARN: zero offers — city/dates may lack Stays content for this PCC");
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
