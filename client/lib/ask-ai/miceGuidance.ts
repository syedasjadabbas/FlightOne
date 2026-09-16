/**
 * Module 12 — Ava MICE grounding helpers.
 */
const MICE_INTENT =
  /\b(mice|conference|exhibition|incentive|meeting\s+event|event\s+agenda|delegate|checked?\s*in|attendance\s+count|event\s+budget|sponsor|badge|qr\s*check)\b/i;

export function isMiceQuestion(message: string): boolean {
  return MICE_INTENT.test(String(message || ""));
}

export function formatMiceGuidanceForPrompt(context: { promptBlock?: string } | null): string | null {
  if (!context?.promptBlock) {
    return "MICE: No data — never invent delegates, attendance, budgets, or sponsors.";
  }
  return context.promptBlock;
}
