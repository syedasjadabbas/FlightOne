/**
 * Module 17 — Ava management dashboard intent helpers.
 */
const DASH_INTENT =
  /\b(sales\s+this\s+(month|week|year)|our\s+(sales|revenue|margin)|outstanding\s+credit|booking\s+conversion|automation\s+rate|supplier\s+performance|operational\s+kpi|how\s+many\s+customers\s+booked|management\s+dashboard|what\s+(were|was|is)\s+our\s+(sales|revenue|margin))\b/i;

export function isDashboardQuestion(message: string): boolean {
  return DASH_INTENT.test(String(message || ""));
}

export function formatDashboardGuidanceForPrompt(
  context: { promptBlock?: string } | null,
): string | null {
  if (!context?.promptBlock) {
    return "DASHBOARD: No data — never invent sales, revenue, margins, credit, conversion, or automation rates.";
  }
  return context.promptBlock;
}

export function defaultDashboardRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}
