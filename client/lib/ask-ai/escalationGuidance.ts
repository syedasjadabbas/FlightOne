/**
 * Module 13 — Ava escalation intent + honest handoff copy.
 * Never claims assignment, resolution, booking changes, or refunds.
 */
export type EscalationTrigger =
  | "CUSTOMER_REQUEST"
  | "VIP_BOOKING"
  | "COMPLEX_ITINERARY"
  | "SUPPLIER_FAILURE"
  | "REFUND_DISPUTE"
  | "MEDICAL_ASSISTANCE"
  | "SPECIAL_SERVICE_REQUEST";

const CUSTOMER_REQUEST_RE =
  /\b(talk\s+to\s+(an?\s+)?(human|agent|person|consultant|advisor)|speak\s+(to|with)\s+(an?\s+)?(human|agent|person|consultant)|connect\s+me\s+(with|to)\s+(an?\s+)?(human|agent|consultant)|need\s+(an?\s+)?(travel\s+)?(human|live\s+)?(agent|consultant|person)|real\s+(person|human|agent)|live\s+(agent|chat|support|consultant)|human\s+(agent|consultant|support)|transfer\s+(me\s+)?to\s+(an?\s+)?agent)\b/i;

const MEDICAL_RE =
  /\b(medical\s+(assistance|emergency|help|issue|condition)|need\s+medical|wheelchair|stretcher|oxygen|hospital|ambulance|doctor\s+on\s+board|health\s+emergency|fit\s+to\s+fly)\b/i;

const SSR_RE =
  /\b(special\s+service(\s+request)?|ssr\b|special\s+assistance|unaccompanied\s+minor|\bum\b|pet\s+in\s+cabin|service\s+animal|kosher\s+meal|halal\s+meal|extra\s+seat|bassinet|mobility\s+aid)\b/i;

const REFUND_DISPUTE_RE =
  /\b(refund\s+dispute|dispute\s+(my\s+)?refund|refund\s+(was\s+)?(wrong|incorrect|denied|rejected)|disagree\s+with\s+(the\s+)?refund|contest\s+(the\s+)?refund|refund\s+not\s+(received|processed))\b/i;

export function detectEscalationIntent(message: string): EscalationTrigger | null {
  const text = String(message || "").trim();
  if (!text) return null;
  if (REFUND_DISPUTE_RE.test(text)) return "REFUND_DISPUTE";
  if (SSR_RE.test(text)) return "SPECIAL_SERVICE_REQUEST";
  if (MEDICAL_RE.test(text)) return "MEDICAL_ASSISTANCE";
  if (CUSTOMER_REQUEST_RE.test(text)) return "CUSTOMER_REQUEST";
  return null;
}

export function isEscalationQuestion(message: string): boolean {
  return detectEscalationIntent(message) != null;
}

export function formatEscalationGuidanceForPrompt(): string {
  return [
    "ESCALATION (Module 13):",
    "- If the customer asks for a human/agent/consultant, or needs medical assistance, a special service request, or a refund dispute handoff: acknowledge that a human consultant handoff can be opened.",
    "- Never claim a consultant has replied, been assigned, or resolved the case unless the system confirms it.",
    "- Never claim a booking was changed or a refund was approved.",
    "- Do not give medical diagnosis or treatment advice.",
    "- After an escalation is already open, do not keep opening new cases — confirm the existing handoff status briefly.",
  ].join(" ");
}

export function honestHandoffReply(opts: {
  trigger: EscalationTrigger;
  escalationId: string;
  status: string;
  deduplicated?: boolean;
}): string {
  const reasonLabel: Record<EscalationTrigger, string> = {
    CUSTOMER_REQUEST: "your request to speak with a human consultant",
    VIP_BOOKING: "VIP booking handling",
    COMPLEX_ITINERARY: "a complex itinerary that needs a consultant",
    SUPPLIER_FAILURE: "a supplier issue that needs a consultant",
    REFUND_DISPUTE: "your refund dispute",
    MEDICAL_ASSISTANCE: "medical-related travel assistance (travel service handoff only — not medical advice)",
    SPECIAL_SERVICE_REQUEST: "your special service request",
  };
  const reason = reasonLabel[opts.trigger] || "your request";
  const idShort = opts.escalationId.slice(0, 8);
  if (opts.deduplicated) {
    return `You already have an open handoff for this conversation (case ${idShort}…, status ${opts.status}). Your full chat history is attached for the consultant. I have not claimed that anyone has replied yet — check Support → Escalations for live status.`;
  }
  return `I've opened a human consultant handoff for ${reason} (case ${idShort}…, status ${opts.status}). Your complete AI conversation history goes with the transfer so you do not need to repeat yourself. This confirms the request only — a consultant has not been assigned or replied until the system shows that. Track status anytime under Support → Escalations.`;
}
