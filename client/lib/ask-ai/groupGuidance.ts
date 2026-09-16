/**
 * Module 11 — Ava group travel grounding helpers.
 */
const GROUP_INTENT =
  /\b(group|our\s+itinerary|who\s+is\s+attending|attendance|announcement|poll\s+result|shared\s+documents?|trip\s+memor(?:y|ies)|emergency\s+broadcast|group\s+flight|gallery)\b/i;

export function isGroupQuestion(message: string): boolean {
  return GROUP_INTENT.test(String(message || ""));
}

export function formatGroupGuidanceForPrompt(context: { promptBlock?: string } | null): string | null {
  if (!context?.promptBlock) {
    return "GROUPS: No data — never invent itineraries, attendance, polls, or flight status.";
  }
  return context.promptBlock;
}
