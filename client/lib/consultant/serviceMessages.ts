/** Deterministic Ask AI copy when the LLM is down or the connection drops. */

const GREETING_RE =
  /^(hi|hello|hey|hiya|good\s*(morning|afternoon|evening)|salaam|salam|assalamu?\s*alaikum|howdy|hola|namaste)([.!?\s]|👋)*$/i;

export function isGreetingOnly(message: string): boolean {
  return GREETING_RE.test(message.trim());
}

export function networkErrorReply(): string {
  return `I lost the connection for a moment. Please send that again and I'll reload your search.`;
}

/** When every LLM provider is unreachable or returns nothing usable. */
export function llmUnavailableReply(opts?: { complex?: boolean }): string {
  if (opts?.complex) {
    return (
      "Trip planning AI is temporarily unreachable, so I can't map that multi-city itinerary right now. " +
      "Please try again in a moment — or send your departure date and I'll retry with what I have."
    );
  }
  return (
    "Trip planning AI is temporarily unreachable. Please try again in a moment, " +
    "or send a simpler request like “flights Lahore to Dubai on 10 October”."
  );
}

/**
 * Clarify copy when LLM is down on a complex / open-jaw ask.
 * Asks for the missing date honestly — never pretends the trip wasn't understood.
 */
export function complexTripLlmFallbackAsk(): string {
  return (
    "I understood a multi-city / open-jaw trip, but trip planning AI is temporarily unreachable " +
    "so I can't finish the full routing yet. What departure date should I use, and I'll retry?"
  );
}

/** Stream / route catch-all — honest, no invented “heavy traffic” stories. */
export function askAiServiceErrorReply(): string {
  return "Something went wrong while handling that request. Please try again in a moment.";
}
