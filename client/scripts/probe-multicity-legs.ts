/** One-off leg probe — run: npx tsx scripts/probe-multicity-legs.ts */
import { searchFlightsWithRouting } from "../lib/inventory/searchFlightsRouted";

async function main() {
  const legs = [
    { origin: "LHE", destination: "LHR", departureDate: "2026-09-10" },
    { origin: "ISB", destination: "LHR", departureDate: "2026-09-10" },
    { origin: "LHR", destination: "IAD", departureDate: "2026-09-14" },
    { origin: "LGW", destination: "IAD", departureDate: "2026-09-14" },
    { origin: "LHR", destination: "DCA", departureDate: "2026-09-14" },
    { origin: "IAD", destination: "MIA", departureDate: "2026-09-28" },
    { origin: "IAD", destination: "FLL", departureDate: "2026-09-28" },
    { origin: "MIA", destination: "LHE", departureDate: "2026-10-02" },
    { origin: "MIA", destination: "ISB", departureDate: "2026-10-02" },
  ];

  for (const q of legs) {
    const out = await searchFlightsWithRouting({
      ...q,
      passengers: 1,
      cabinClass: "ECONOMY",
    });
    const n = out?.length ?? 0;
    const s = out?.[0];
    const sample =
      s && "originCode" in s
        ? ` ${s.originCode}→${s.destinationCode} [${(s.tags || []).slice(0, 4).join(",")}]`
        : "";
    console.log(`${q.origin}→${q.destination} ${q.departureDate}: ${n}${sample}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
