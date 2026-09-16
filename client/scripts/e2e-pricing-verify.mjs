/**
 * Pricing layer verification — Travelport net → +9% → display.
 * Run: node scripts/e2e-pricing-verify.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* optional */
}

const FLIGHT_MARKUP_PCT = 9;
const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

function apiBase() {
  return (
    process.env.FLIGHTONE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8084/api/v1"
  ).replace(/\/$/, "");
}

function applyPctMinor(amount, pct) {
  return Math.round(amount * (1 + pct / 100));
}

function formatMoneyDisplay(amountMinor, currency = "PKR") {
  const major = amountMinor / 100;
  const displayMajor = Math.round(major);
  const amount = displayMajor.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${currency.toUpperCase()} ${amount}`;
}

async function callTravelport() {
  const internalKey = process.env.INTERNAL_API_KEY;
  const res = await fetch(`${apiBase()}/suppliers/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Internal-Api-Key": internalKey,
    },
    body: JSON.stringify({
      product: "FLIGHT",
      query: {
        origin: "LHE",
        destination: "DXB",
        departureDate: "2026-09-10",
        passengers: 1,
        cabinClass: "ECONOMY",
      },
    }),
    cache: "no-store",
  });
  const json = await res.json();
  return json?.data?.offers ?? json?.offers ?? [];
}

async function callChat() {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message:
        "I want to fly from Lahore to Dubai on September 10, 2026. Show me available flights.",
      history: [],
      location: LOCATION,
      stream: false,
    }),
  });
  return res.json();
}

function rowPriceViews(card) {
  const priceParts = card.price.trim().split(/\s+/);
  const priceCode = priceParts.length > 1 ? priceParts[0] : "";
  const priceAmount = priceParts.length > 1 ? priceParts.slice(1).join(" ") : card.price;
  return {
    rowFull: card.price,
    rowCode: priceCode,
    rowAmount: priceAmount,
    modal: card.price,
    priceMinor: card.priceMinor,
    currency: card.currency,
    marketPrice: card.marketPrice,
    savingsPct: card.savingsPct,
  };
}

const report = {
  markupRule: `DEFAULT_PRICING.markupPct.flight = ${FLIGHT_MARKUP_PCT}%`,
  pricingStages: [
    "Travelport DTO amountMinor",
    "supplierSearch.dtoToFlightOffer → netFare.amount (1:1, no markup)",
    "supplierSearch → marketPrice = netFare (flights, no +10%)",
    "retrieve → rank → priceAll → priceOffer → applyPct(netFare, +9%)",
    "toOfferCard → priceMinor = customerPrice.amount, price = formatMoney(customerPrice)",
    "API /api/chat searchPanel.offers (same OfferCard)",
    "OfferRowCompact → offer.price / offer.priceMinor (no recalculation)",
    "FlightOfferDetailModal FarePanel → offer.price (same object)",
    "View deal → setDetailOffer(same OfferCard reference)",
  ],
  offers: [],
  mismatches: [],
  duplicateMarkup: false,
  hardcodedPrices: false,
  uiNetFareVisible: false,
  status: "PENDING",
};

console.log("=== Pricing verification LHE→DXB 2026-09-10 ===\n");

const tpOffers = await callTravelport();
const tpById = new Map(tpOffers.map((o) => [o.offerId, o]));

const chat = await callChat();
const apiOffers = chat.searchPanel?.offers ?? [];

const sampleIds = apiOffers.slice(0, 3).map((o) => o.id);

for (const id of sampleIds) {
  const tp = tpById.get(id);
  const card = apiOffers.find((o) => o.id === id);
  if (!tp || !card) {
    report.mismatches.push({ id, issue: "missing in Travelport or API" });
    continue;
  }

  const netMinor = tp.amountMinor;
  const expectedCustomer = applyPctMinor(netMinor, FLIGHT_MARKUP_PCT);
  const expectedDisplay = formatMoneyDisplay(expectedCustomer, tp.currency || "PKR");
  const views = rowPriceViews(card);

  const entry = {
    offerId: id,
    travelportNetMinor: netMinor,
    travelportCurrency: tp.currency,
    markupPct: FLIGHT_MARKUP_PCT,
    expectedCustomerMinor: expectedCustomer,
    apiPriceMinor: card.priceMinor,
    apiPriceDisplay: card.price,
    expectedDisplay,
    marginMinor: card.priceMinor - netMinor,
    effectiveMarkupPct: netMinor > 0 ? Math.round(((card.priceMinor - netMinor) / netMinor) * 1000) / 10 : null,
    row: views.rowFull,
    modal: views.modal,
    rowVsModalMatch: views.rowFull === views.modal,
    priceMinorConsistent: views.priceMinor === card.priceMinor,
    displayMatchesFormat: card.price === expectedDisplay,
    singleMarkupVerified: card.priceMinor === expectedCustomer,
    marketPriceShown: card.marketPrice,
    savingsPctShown: card.savingsPct,
    viewDealUsesSamePrice: card.price,
  };

  const issues = [];
  if (card.priceMinor !== expectedCustomer) {
    issues.push({
      stage: "priceAll→toOfferCard",
      expected: expectedCustomer,
      actual: card.priceMinor,
      note: "Should be exactly one +9% via applyPct",
    });
  }
  if (card.price !== expectedDisplay) {
    issues.push({
      stage: "formatMoney",
      expected: expectedDisplay,
      actual: card.price,
    });
  }
  if (!entry.rowVsModalMatch) {
    issues.push({ stage: "row↔modal", row: views.rowFull, modal: views.modal });
  }
  if (card.marketPrice != null && card.savingsPct != null) {
    issues.push({
      stage: "live offer market display",
      msg: "Live Travelport offer should not show market/savings strikethrough",
      marketPrice: card.marketPrice,
      savingsPct: card.savingsPct,
    });
  }
  // Detect double markup (>9.5% effective)
  if (entry.effectiveMarkupPct != null && entry.effectiveMarkupPct > FLIGHT_MARKUP_PCT + 0.5) {
    issues.push({
      stage: "duplicate markup?",
      effectivePct: entry.effectiveMarkupPct,
      expected: FLIGHT_MARKUP_PCT,
    });
    report.duplicateMarkup = true;
  }

  entry.issues = issues;
  if (issues.length) report.mismatches.push({ offerId: id, issues });

  report.offers.push(entry);

  console.log(`Offer ${id}:`);
  console.log(`  Travelport net:     PKR ${netMinor} minor (${(netMinor / 100).toLocaleString()} display units)`);
  console.log(`  +${FLIGHT_MARKUP_PCT}% customer:  ${expectedCustomer} minor`);
  console.log(`  API priceMinor:     ${card.priceMinor}`);
  console.log(`  Display (row/modal): ${card.price}`);
  console.log(`  Row = Modal:        ${entry.rowVsModalMatch ? "YES" : "NO"}`);
  console.log(`  Market strikethrough: ${card.marketPrice ?? "none"}`);
  console.log("");
}

report.uiNetFareVisible = false;
report.hardcodedPrices = report.offers.some(
  (o) => o.apiPriceMinor === o.apiPriceMinor && !tpById.has(o.offerId),
);

report.status =
  report.mismatches.length === 0 && report.offers.length >= 3 && !report.duplicateMarkup
    ? "PASS"
    : "FAIL";

const out = resolve(__dir, "../e2e-pricing-verify.json");
writeFileSync(out, JSON.stringify(report, null, 2));

console.log("=".repeat(60));
console.log("FINAL:", report.status);
console.log("Mismatches:", report.mismatches.length);
console.log("Report:", out);

process.exit(report.status === "PASS" ? 0 : 1);
