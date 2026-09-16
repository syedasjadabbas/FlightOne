/**
 * Module 15 — Ava operations grounding helpers.
 * Never invents CRM sync, accounting postings, commissions, or reconciliation.
 */
const OPS_INTENT =
  /\b(ticketed|ticketing|booking\s+confirm|is\s+my\s+booking|payment\s+status|crm|reconcil|commission|ops\s+status|operational|has\s+my\s+(booking|refund)\s+been|accounting\s+status)\b/i;

export function isOperationsQuestion(message: string): boolean {
  return OPS_INTENT.test(String(message || ""));
}

export function formatOperationsGuidanceForPrompt(
  context: { promptBlock?: string } | null,
): string | null {
  if (!context?.promptBlock) {
    return "OPERATIONS: No data — never invent CRM sync, accounting postings, commissions, reconciliation, or claim external ops completed.";
  }
  return context.promptBlock;
}
