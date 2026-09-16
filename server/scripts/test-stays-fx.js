/**
 * Unit checks for Stays FX conversion (no network).
 * node scripts/test-stays-fx.js
 */
import { buildFxMap, convertMajorAmount } from "../modules/suppliers/travelport/stays.js";
import { buildStaysSearchCompleteBody } from "../modules/suppliers/travelport/staysRequest.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fx = buildFxMap([
  { sourceCurrency: "AED", targetCurrency: "INR", conversionFactor: 26.227333581 },
]);

const converted = convertMajorAmount(301.35, "AED", "INR", fx);
assert(converted.converted === true, "expected conversion");
assert(converted.currency === "INR", "currency INR");
assert(Math.abs(converted.amount - 301.35 * 26.227333581) < 0.0001, "amount mismatch");

const same = convertMajorAmount(100, "INR", "INR", fx);
assert(same.converted === false && same.amount === 100, "same-currency passthrough");

const missing = convertMajorAmount(100, "USD", "INR", fx);
assert(missing.converted === false && missing.currency === "USD", "missing FX keeps source");

const body = buildStaysSearchCompleteBody(
  { cityCode: "dxb", checkInDate: "2026-09-20", checkOutDate: "2026-09-22", guests: 2.9, rooms: 1.2 },
  { requestedCurrency: "inr", radiusKm: 25 },
);
assert(body.stayDetails.guests.adults === 2, "adults truncated int");
assert(body.stayDetails.rooms === 1, "rooms truncated int");
assert(body.propertyFilter.location.type === "cityIATACode", "location type");
assert(body.propertyFilter.location.details.iataCode === "DXB", "iata upper");
assert(body.propertyFilter.location.radius.value === 25, "radius value");
assert(body.propertyFilter.location.radius.unit === "km", "radius unit");
assert(body.requestedCurrency === "INR", "requested currency");
assert(!("numberOfAdults" in body.stayDetails.guests), "must not use numberOfAdults");

console.log("OK: stays FX + request schema checks passed");
