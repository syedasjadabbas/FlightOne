import appLogger from "../../lib/logger.js";
import { GeminiProvider } from "./gemini.js";
import { LmStudioProvider } from "./lmstudio.js";

/**
 * Provider registry with an ordered fallback chain.
 *
 * LLM_PROVIDER controls the order:
 *   - "auto"     (default): Gemini first (if a key is set), then LM Studio.
 *   - "gemini":  Gemini only.
 *   - "lmstudio": LM Studio only.
 *   - "off":     skip the LLM entirely.
 */
export function orderedProviders() {
  const mode = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  const gemini = new GeminiProvider();
  const lmstudio = new LmStudioProvider();

  switch (mode) {
    case "off":
      return [];
    case "gemini":
      return [gemini];
    case "lmstudio":
    case "ollama": // legacy alias — Ollama removed; route to LM Studio
      return [lmstudio];
    case "auto":
    default:
      return [gemini, lmstudio];
  }
}

export async function complete(req) {
  const providers = orderedProviders().filter((p) => p.isConfigured());
  for (const p of providers) {
    try {
      return await p.complete(req);
    } catch (err) {
      appLogger.warn(`[llm] provider "${p.name}" failed: ${err?.message || err}`);
    }
  }
  return null;
}

/**
 * Stream text deltas from the first working provider. Yields token chunks;
 * return value of the generator is the final CompletionResult (or null).
 */
export async function* completeStream(req) {
  const providers = orderedProviders().filter((p) => p.isConfigured());

  for (const p of providers) {
    try {
      if (p.completeStream) {
        return yield* p.completeStream(req);
      }
      // Provider has no streaming — fall back to one-shot and yield once.
      const result = await p.complete(req);
      if (result.text) yield result.text;
      return result;
    } catch (err) {
      appLogger.warn(
        `[llm] stream provider "${p.name}" failed: ${err?.message || err}`,
      );
    }
  }
  return null;
}

/** For diagnostics / the UI status pill. */
export function configuredProviderNames() {
  return orderedProviders()
    .filter((p) => p.isConfigured())
    .map((p) => p.name);
}
