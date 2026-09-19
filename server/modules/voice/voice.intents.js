/**
 * Voice intent classification — same guardrails as Ava: propose, never silently commit.
 */

const BOOKING_RE =
  /\b(book|booking|reserve|confirm (the |this )?(flight|hotel|trip|itinerary|offer)|yes[, ]?(book|confirm)|go ahead and book)\b/i;
const CANCEL_RE = /\b(cancel (my )?(flight|booking|ticket|trip)|void (the )?ticket)\b/i;
const REFUND_RE = /\b(refund|money back)\b/i;
const REISSUE_RE = /\b(reissue|re-issue)\b/i;
const TICKET_PAY_RE = /\b(issue( the)? ticket|ticket (it|now)|pay( now)?|charge (my|the) card)\b/i;
const ITINERARY_RE =
  /\b(itinerary|my (flight|trip|booking)|gate|delay|what time|when (do|does) (i|my)|pnr|ticket number)\b/i;
const DISCOVERY_RE =
  /\b(find|search|show|compare|flights? to|hotels? in|plan (a |my )?trip|weekend|options)\b/i;

export function classifyVoiceIntent(text) {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) {
    return {
      kind: "OTHER",
      requiresConfirmation: false,
      blocked: false,
      irreversible: false,
    };
  }

  if (CANCEL_RE.test(raw)) {
    return {
      kind: "CANCEL",
      requiresConfirmation: true,
      blocked: true,
      irreversible: true,
      reason: "Cancellation cannot be completed from voice alone",
    };
  }
  if (REFUND_RE.test(raw)) {
    return {
      kind: "REFUND",
      requiresConfirmation: true,
      blocked: true,
      irreversible: true,
      reason: "Refunds must go through the existing refund workflow",
    };
  }
  if (REISSUE_RE.test(raw)) {
    return {
      kind: "REISSUE",
      requiresConfirmation: true,
      blocked: true,
      irreversible: true,
      reason: "Reissue cannot be completed from voice alone",
    };
  }
  if (TICKET_PAY_RE.test(raw)) {
    return {
      kind: "TICKET",
      requiresConfirmation: true,
      blocked: true,
      irreversible: true,
      reason: "Ticketing and payment cannot be completed from conversational intent alone",
    };
  }
  if (BOOKING_RE.test(raw)) {
    return {
      kind: "BOOKING",
      requiresConfirmation: true,
      blocked: false,
      irreversible: true,
      reason: "Voice booking requires explicit confirmation and OTP",
    };
  }
  if (ITINERARY_RE.test(raw)) {
    return {
      kind: "ITINERARY",
      requiresConfirmation: false,
      blocked: false,
      irreversible: false,
    };
  }
  if (DISCOVERY_RE.test(raw)) {
    return {
      kind: "DISCOVERY",
      requiresConfirmation: false,
      blocked: false,
      irreversible: false,
    };
  }
  return {
    kind: "OTHER",
    requiresConfirmation: false,
    blocked: false,
    irreversible: false,
  };
}

export function publicIntentReply(intent, assistantContent) {
  if (intent.kind === "BOOKING") {
    return (
      "I can prepare this booking, but I will not confirm, ticket, or charge from voice alone. " +
      "Say you want to continue, then confirm with the one-time code we send you."
    );
  }
  if (intent.blocked) {
    return (
      "I cannot complete that action from voice. " +
      (intent.reason || "Please use the existing FlightOne workflow, or ask me to connect you with a consultant.")
    );
  }
  return assistantContent;
}
