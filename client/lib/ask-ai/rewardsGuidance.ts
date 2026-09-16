/**
 * Module 10 — Ava rewards grounding helpers.
 */
const REWARDS_INTENT =
  /\b(reward|rewards|loyalty|tier|points?|credit(s)?|referral|refer\s+a\s+friend|how\s+many\s+(rewards|points|credits)|can\s+i\s+use\s+(my\s+)?credits)\b/i;

export function isRewardsQuestion(message: string): boolean {
  return REWARDS_INTENT.test(String(message || ""));
}

export type RewardsContextPayload = {
  promptBlock?: string;
};

export function formatRewardsGuidanceForPrompt(
  context: RewardsContextPayload | null,
): string | null {
  if (!context?.promptBlock) {
    return "REWARDS: No data — never invent balances, tiers, or referral status.";
  }
  return context.promptBlock;
}
