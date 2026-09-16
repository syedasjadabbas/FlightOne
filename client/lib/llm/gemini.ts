import type {
  CompletionRequest,
  CompletionResult,
  LlmProvider,
} from "./types";
import { fetchWithTimeout } from "./types";

/**
 * Google Gemini provider (REST — no SDK dependency).
 * Config via env: GEMINI_API_KEY, GEMINI_MODEL (default gemini-2.0-flash).
 */
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";

  private get key(): string | undefined {
    return process.env.GEMINI_API_KEY;
  }
  private get model(): string {
    return process.env.GEMINI_MODEL || "gemini-2.0-flash";
  }

  isConfigured(): boolean {
    return !!this.key;
  }

  private buildBody(req: CompletionRequest) {
    const thinkingLevel =
      req.thinkingLevel ?? (req.json ? "minimal" : undefined);
    const requested = req.maxTokens ?? 400;
    // Gemini 3.x: maxOutputTokens is a combined thinking+output budget.
    // JSON extraction needs headroom so thinking cannot starve the payload.
    const maxOutputTokens =
      req.json || thinkingLevel ? Math.max(requested, 4096) : requested;

    return {
      system_instruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
        ...(thinkingLevel
          ? { thinkingConfig: { thinkingLevel } }
          : {}),
      },
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (!this.key) throw new Error("GEMINI_API_KEY not set");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.key}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.buildBody(req)),
      },
      req.timeoutMs ?? 20000,
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
      }[];
      usageMetadata?: {
        thoughtsTokenCount?: number;
        candidatesTokenCount?: number;
        promptTokenCount?: number;
      };
    };
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) throw new Error("Gemini returned no text");
    return {
      text,
      provider: this.name,
      finishReason: candidate?.finishReason,
      thoughtsTokenCount: json.usageMetadata?.thoughtsTokenCount,
    };
  }

  async *completeStream(
    req: CompletionRequest,
  ): AsyncGenerator<string, CompletionResult, void> {
    if (!this.key) throw new Error("GEMINI_API_KEY not set");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 60000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.buildBody(req)),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
      }
      if (!res.body) throw new Error("Gemini stream missing body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          for (const rawLine of block.split("\n")) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[];
              };
              const delta =
                json.candidates?.[0]?.content?.parts
                  ?.map((p) => p.text ?? "")
                  .join("") ?? "";
              if (delta) {
                full += delta;
                yield delta;
              }
            } catch {
              // ignore malformed SSE chunks
            }
          }
        }
      }

      const text = full.trim();
      if (!text) throw new Error("Gemini stream returned no text");
      return { text, provider: this.name };
    } finally {
      clearTimeout(timer);
    }
  }
}
