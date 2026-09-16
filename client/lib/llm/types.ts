export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  /** System / persona instruction, kept separate from the dialogue turns. */
  system: string;
  messages: ChatTurn[];
  temperature?: number;
  maxTokens?: number;
  /** Abort the upstream call after this many ms. */
  timeoutMs?: number;
  /** Prefer JSON object output when the provider supports it. */
  json?: boolean;
  /**
   * Gemini 3.x thinking level. JSON extraction should use "minimal"/"low" —
   * thinking tokens share the maxOutputTokens budget and otherwise truncate JSON.
   */
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
}

export interface CompletionResult {
  text: string;
  provider: string;
  /** Upstream finish reason when the provider exposes it (e.g. STOP, MAX_TOKENS). */
  finishReason?: string;
  /** Thoughts/thinking tokens when reported (Gemini 3.x). */
  thoughtsTokenCount?: number;
}

export interface LlmProvider {
  readonly name: string;
  /** True when the provider is configured enough to be worth calling. */
  isConfigured(): boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  /**
   * Optional token stream. Yields text deltas; implementations that cannot
   * stream should omit this and the registry will fall back to complete().
   */
  completeStream?(req: CompletionRequest): AsyncGenerator<string, CompletionResult, void>;
}

/** Small helper: fetch with an AbortController-based timeout. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
