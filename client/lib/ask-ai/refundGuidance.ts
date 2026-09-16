/**
 * Module 14 — Ava refund/reissue grounding helpers.
 */
const REFUND_INTENT =
  /\b(refund|get\s+back|money\s+back|cancel(lation)?\s+(fee|penalty|booking)|change\s+(this\s+)?flight|reissue|exchange\s+(ticket|flight)|travel\s+credit|cancellation\s+penalty|flight\s+was\s+changed|schedule\s+change)\b/i;

export function isRefundQuestion(message: string): boolean {
  return REFUND_INTENT.test(String(message || ""));
}

export function formatRefundGuidanceForPrompt(
  context: { promptBlock?: string } | null,
): string | null {
  if (!context?.promptBlock) {
    return "REFUNDS: No data — never invent refund amounts, penalties, fees, timelines, or completion.";
  }
  return context.promptBlock;
}
