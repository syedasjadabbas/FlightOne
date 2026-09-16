/**
 * Module 16 — Ava knowledge-intent detection.
 */
const KNOWLEDGE_INTENT =
  /\b(sop|standard\s+operating|airline\s+polic(y|ies)|supplier\s+(rule|contract|procedure)|corporate\s+(travel\s+)?polic(y|ies)|corporate\s+agreement|visa\s+(rule|procedure|polic)|travel\s+polic(y|ies)|internal\s+polic(y|ies)|what\s+(is|are)\s+(our|flightone'?s)|cancellation\s+sop|baggage\s+polic)\b/i;

export function isKnowledgeQuestion(message: string): boolean {
  return KNOWLEDGE_INTENT.test(String(message || ""));
}

export function formatKnowledgeGuidanceForPrompt(
  context: { promptBlock?: string } | null,
): string | null {
  if (!context?.promptBlock) {
    return "KNOWLEDGE: No data — never invent FlightOne SOPs, policies, contracts, or visa procedures. Say unavailable and offer escalation when needed.";
  }
  return context.promptBlock;
}
