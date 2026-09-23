import type {
  OfferCard,
  ExtractedIntent,
  ItinerarySummary,
} from "@/lib/consultant/types";
import type { TravellerLocation } from "@/lib/geo/types";
import { tripRouteLabel } from "./tripStops";

export const ASK_AI_NAME = "Ava";

export function askAiWelcome(originPlace: string): string {
  return (
    `I'm Ava — ask anything about flights, stays, or a full trip from ${originPlace}. ` +
    `Live prices appear in the results panel as you search; pick View deal when you're ready.`
  );
}

export function buildAskAiSystemPrompt(location?: TravellerLocation | null): string {
  const origin = location?.place || location?.city || "their city";
  const currency = location?.currency || "PKR";

  return [
    `You are FlightOne ${ASK_AI_NAME} — conversational travel search beside a live results panel (KAYAK-style).`,
    `The panel shows real inventory from Travelport; you never invent prices or routes.`,
    ``,
    `RULES:`,
    `- Keep replies to 2–4 short sentences. No markdown, bullets, or offer dumps in chat.`,
    `- When COMPLETE TRIPS are listed, lead with those total-trip fares (not single-leg prices).`,
    `- If the traveller asked for best/cheapest fare, highlight the lowest COMPLETE TRIP total first.`,
    `- Summarize what was searched and highlight 1–2 notable options from SEARCH RESULTS / COMPLETE TRIPS only.`,
    `- Direct the traveller to the results panel Trips tab for stacked legs, filters, and View deal.`,
    `- If SEARCH RESULTS is empty, say so honestly and suggest loosening dates, airports, or filters.`,
    `- Do not claim booking is complete in chat — checkout continues via View deal / reservations.`,
    `- Never mention WhatsApp unless the user explicitly asks for human help.`,
    `- Default origin: ${origin}. Currency: ${currency}.`,
  ].join("\n");
}

export function buildAskAiSearchContext(
  offers: OfferCard[],
  intent: ExtractedIntent,
  locale: string,
  itineraries?: ItinerarySummary[],
): string {
  const trips = itineraries?.length ? itineraries : [];
  if (offers.length === 0 && trips.length === 0) {
    const target = intent.destination || intent.hotelName || intent.destinations?.join(", ");
    return target
      ? `SEARCH RESULTS: empty for ${target}. No bookable inventory matched this turn.`
      : "SEARCH RESULTS: empty — need destination and dates.";
  }

  const tripLines = trips.slice(0, 4).map((t, i) => {
    const hops = t.hops.join(" · ");
    const tag = t.construction === "multiple_tickets" ? "self-transfer" : "single-ticket";
    return `${i + 1}. COMPLETE TRIP [${t.angle}] ${hops} — ${t.totalPrice} (${tag})`;
  });

  const offerLines = offers.slice(0, trips.length > 0 ? 4 : 8).map((o, i) => {
    const detail =
      o.type === "flight" && o.flight
        ? `${o.flight.originCode}→${o.flight.destinationCode} ${o.flight.airline}`
        : o.title;
    return `${i + 1}. [${o.type}] ${detail} — ${o.price}`;
  });

  const parts: string[] = [];
  if (tripLines.length > 0) {
    parts.push(
      `COMPLETE TRIPS (${trips.length} packaged journeys — prefer these totals in your reply):`,
      ...tripLines,
    );
  }
  if (offerLines.length > 0) {
    parts.push(
      `LEG / OTHER OFFERS (${offers.length} in panel, showing ${offerLines.length}):`,
      ...offerLines,
    );
  }
  parts.push(
    `Query: ${intent.origin || "?"} → ${intent.destination || intent.hotelName || intent.destinations?.join(", ") || "?"}`,
  );
  return parts.join("\n");
}

export function askAiTemplateReply(
  offers: OfferCard[],
  intent: ExtractedIntent,
  locale: string,
  originPlace: string,
  itineraries?: ItinerarySummary[],
): string {
  const trips = itineraries?.length ? itineraries : [];
  if (trips.length > 0) {
    const cheapest = [...trips].sort((a, b) => a.totalPriceMinor - b.totalPriceMinor)[0];
    const route = tripRouteLabel(cheapest);
    return (
      `Here are the best-value multi-city fares for your trip — lowest complete journey is ${cheapest.totalPrice}` +
      (route ? ` (${route})` : "") +
      `. Open the Trips tab in the results panel to compare stacked legs and View deal.`
    );
  }

  if (offers.length === 0) {
    if (!intent.destination && !intent.hotelName) {
      return `Where would you like to go from ${originPlace}? I'll pull live flights, stays, and packages into the panel.`;
    }
    return `Nothing bookable matched that search yet. Try different dates or a nearby airport — results will update in the panel when you refine.`;
  }

  const top = offers[0];
  const count = offers.length;
  const where = intent.destination || intent.hotelName || "your trip";
  const priceHint = top.price ? ` from ${top.price}` : "";

  return (
    `I found ${count} live option${count === 1 ? "" : "s"} for ${where}${priceHint}. ` +
    `Browse the results panel to compare, filter, and View deal — tell me if you'd like to refine.`
  );
}
