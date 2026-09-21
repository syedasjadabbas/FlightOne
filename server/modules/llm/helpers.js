/**
 * Shared LLM HTTP helpers (ported from client/lib/llm).
 */

/** fetch with an AbortController-based timeout. */
export async function fetchWithTimeout(url, init, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
