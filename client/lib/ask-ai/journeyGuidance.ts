/**
 * Module 09 — Ava journey question detection + grounding helpers.
 * Never invents delays, gates, cancellations, or rebooking outcomes.
 */

const JOURNEY_INTENT =
  /\b(my\s+flight|flight\s+status|delayed|delay|cancelled|canceled|gate\s+change|terminal\s+change|boarding|disruption|missed\s+connection|rebook|alternative\s+flight|journey\s+update|is\s+my\s+flight|weather\s+(alert|disruption|delay)|hotel\s+check[-\s]?in|airport\s+transfer|transfer\s+pickup|immigration\s+(advisory|advice|alert)|entry\s+requirements?\s+for\s+my\s+trip)\b/i;

export function isJourneyQuestion(message: string): boolean {
  return JOURNEY_INTENT.test(String(message || ""));
}

export type JourneyContextPayload = {
  promptBlock?: string;
  capability?: {
    configured?: boolean;
    canPollLive?: boolean;
    provider?: string;
  };
  watches?: Array<{
    flightNumber?: string | null;
    status?: string;
  }>;
};

export function formatJourneyGuidanceForPrompt(
  context: JourneyContextPayload | null,
): string | null {
  if (!context) return null;
  if (context.promptBlock) return context.promptBlock;
  return [
    "JOURNEY MONITORING (Module 09):",
    "No journey context available. Do not invent flight status, delays, gates, weather alerts, hotel status, transfer status, immigration advisories, or cancellations.",
    "Offer human escalation (JOURNEY_DISRUPTION) for unresolved disruptions. Never claim a rebook completed unless Module 03 confirms it.",
  ].join(" ");
}
