import { API_BASE_URL } from "@/lib/api/baseApi";
import type { CompletionRequest, CompletionResult } from "./types";

export type { ChatTurn, CompletionRequest, CompletionResult } from "./types";

/**
 * Server-side LLM proxy.
 *
 * Completions run on Express (`/api/v1/llm/*`) so provider keys and fallback
 * logic stay on the backend. Next only needs INTERNAL_API_KEY.
 */

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

function llmBase(): string {
  return (
    process.env.FLIGHTONE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    API_BASE_URL
  ).replace(/\/$/, "");
}

function authHeaders(): HeadersInit | null {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    console.warn("[llm] INTERNAL_API_KEY missing — cannot reach backend LLM");
    return null;
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Internal-Api-Key": internalKey,
  };
}

export async function complete(
  req: CompletionRequest,
): Promise<CompletionResult | null> {
  const headers = authHeaders();
  if (!headers) return null;

  const timeoutMs = req.timeoutMs ?? 20000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs + 5000);

  try {
    const res = await fetch(`${llmBase()}/llm/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
      signal: ctrl.signal,
      cache: "no-store",
    });

    if (res.status === 503) return null;
    if (!res.ok) {
      console.warn(`[llm] complete HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as ApiEnvelope<CompletionResult>;
    if (!body?.success || !body.data?.text) return null;
    return body.data;
  } catch (err) {
    console.warn("[llm] complete failed:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stream text deltas from the backend SSE endpoint. Yields token chunks;
 * return value of the generator is the final CompletionResult (or null).
 */
export async function* completeStream(
  req: CompletionRequest,
): AsyncGenerator<string, CompletionResult | null, void> {
  const headers = authHeaders();
  if (!headers) return null;

  const timeoutMs = req.timeoutMs ?? 60000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs + 10000);

  try {
    const res = await fetch(`${llmBase()}/llm/complete/stream`, {
      method: "POST",
      headers: {
        ...headers,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(req),
      signal: ctrl.signal,
      cache: "no-store",
    });

    if (res.status === 503) return null;
    if (!res.ok || !res.body) {
      console.warn(`[llm] stream HTTP ${res.status}`);
      return null;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: CompletionResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let event: {
            type?: string;
            text?: string;
            message?: string;
            result?: CompletionResult;
          };
          try {
            event = JSON.parse(payload) as typeof event;
          } catch {
            continue;
          }

          if (event.type === "delta" && event.text) {
            yield event.text;
          } else if (event.type === "done" && event.result) {
            final = event.result;
          } else if (event.type === "error") {
            console.warn("[llm] stream error:", event.message || "unknown");
            return null;
          }
        }
      }
    }

    return final;
  } catch (err) {
    console.warn("[llm] stream failed:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Diagnostic list of configured backend providers.
 * Best-effort; returns [] if the backend is unreachable.
 */
export async function configuredProviderNames(): Promise<string[]> {
  const headers = authHeaders();
  if (!headers) return [];

  try {
    const res = await fetch(`${llmBase()}/llm/providers`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as ApiEnvelope<{ providers?: string[] }>;
    return body?.data?.providers ?? [];
  } catch {
    return [];
  }
}
