import { fetchWithTimeout } from "./helpers.js";

/**
 * LM Studio provider — OpenAI-compatible `/v1/chat/completions`.
 *
 * Config via env:
 *   LMSTUDIO_BASE_URL  default http://localhost:1234/v1
 *   LMSTUDIO_MODEL     default qwen/qwen3.8-27b
 *   LMSTUDIO_API_KEY   optional
 *   LMSTUDIO_ENABLED   set "false" to disable
 *   LMSTUDIO_THINK     set "true" to allow Qwen CoT (slow; often burns max_tokens)
 *
 * Qwen3 on LM Studio ignores `chat_template_kwargs.enable_thinking`. The
 * reliable disable is an assistant prefill of an empty `<think></think>`
 * block (verified ~17s JSON vs ~120s+ empty content with thinking on).
 */
export class LmStudioProvider {
  name = "lmstudio";

  get baseUrl() {
    const raw = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
    return raw.replace(/\/$/, "");
  }

  get model() {
    return process.env.LMSTUDIO_MODEL || "qwen/qwen3.8-27b";
  }

  get apiKey() {
    const key = process.env.LMSTUDIO_API_KEY;
    return key && key.length > 0 ? key : undefined;
  }

  /** Default off — thinking burns the whole max_tokens budget on this stack. */
  get thinkEnabled() {
    return (
      process.env.LMSTUDIO_THINK === "true" || process.env.LMSTUDIO_THINK === "1"
    );
  }

  isConfigured() {
    return process.env.LMSTUDIO_ENABLED !== "false";
  }

  headers() {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  buildBody(req, stream) {
    // This LM Studio build rejects OpenAI's `json_object`; it only allows
    // `json_schema` or `text`. Extraction already prompts for JSON + repairs
    // malformed replies, so we omit response_format and rely on the prompt.
    const system = req.json
      ? `${req.system}\n\nRespond with a single valid JSON object only. No markdown fences, no prose before or after the JSON.`
      : req.system;

    const messages = [
      { role: "system", content: system },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Empty think prefill skips CoT on Qwen3 when LM Studio drops template kwargs.
    if (!this.thinkEnabled) {
      messages.push({ role: "assistant", content: "<think>\n</think>\n" });
    }

    return {
      model: this.model,
      stream,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 512,
      // Harmless if ignored; kept for builds that do honor it.
      chat_template_kwargs: { enable_thinking: this.thinkEnabled },
      messages,
    };
  }

  /**
   * Prefer `content`; if empty (CoT ate the budget), pull JSON/text from
   * `reasoning_content` as a last resort.
   */
  extractText(choice) {
    const content = stripThinkBlocks(choice?.message?.content ?? "");
    if (content) return content;

    const reasoning = (choice?.message?.reasoning_content ?? "").trim();
    if (!reasoning) return "";
    const fromReasoning =
      extractJsonObject(reasoning) ?? stripThinkBlocks(reasoning);
    return fromReasoning;
  }

  async complete(req) {
    const url = `${this.baseUrl}/chat/completions`;
    let res;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(this.buildBody(req, false)),
        },
        req.timeoutMs ?? 20000,
      );
    } catch (err) {
      throw new Error(networkErrorMessage(this.baseUrl, err));
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`LM Studio ${res.status}: ${detail.slice(0, 300)}`);
    }

    const json = await res.json();
    const text = this.extractText(json.choices?.[0]);
    if (!text) {
      throw new Error(
        `LM Studio returned no text (finish_reason=${json.choices?.[0]?.finish_reason ?? "?"}). Set LMSTUDIO_THINK=false (default) or raise maxTokens.`,
      );
    }
    return { text, provider: `lmstudio:${this.model}` };
  }

  async *completeStream(req) {
    const url = `${this.baseUrl}/chat/completions`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 60000);

    try {
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(this.buildBody(req, true)),
          signal: ctrl.signal,
        });
      } catch (err) {
        throw new Error(networkErrorMessage(this.baseUrl, err));
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`LM Studio ${res.status}: ${detail.slice(0, 300)}`);
      }
      if (!res.body) throw new Error("LM Studio stream missing body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      // Hold partial open `<think>` across chunks so we never yield CoT.
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, sep).trim();
          buffer = buffer.slice(sep + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let chunk;
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue;
          }

          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (!delta) continue;

          pending += delta;
          const { safe, rest } = takeSafeContent(pending);
          pending = rest;
          if (safe) {
            full += safe;
            yield safe;
          }
        }
      }

      // Flush anything left after the stream ends (closed think blocks).
      const flushed = stripThinkBlocks(pending);
      if (flushed) {
        full += flushed;
        yield flushed;
      }

      const text = full.trim();
      if (!text) {
        throw new Error(
          "LM Studio stream returned no text (model may have only emitted thinking). Keep LMSTUDIO_THINK=false.",
        );
      }
      return { text, provider: `lmstudio:${this.model}` };
    } finally {
      clearTimeout(timer);
    }
  }
}

function networkErrorMessage(baseUrl, err) {
  const cause =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "unknown network error";
  return `Cannot reach LM Studio at ${baseUrl} (${cause}). Start Local Server in LM Studio, confirm the model is loaded, and that LMSTUDIO_BASE_URL is reachable from this machine.`;
}

/** Remove complete `<think>…</think>` (and legacy `<thinking>`) blocks. */
export function stripThinkBlocks(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

/** Best-effort first JSON object in a blob (reasoning fallback). */
export function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try {
          JSON.parse(slice);
          return slice;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Yield only content that is outside an open think block. Keeps an incomplete
 * open tag in `rest` until the closing tag arrives (or stream ends).
 */
function takeSafeContent(pending) {
  const open = pending.search(/<think(?:ing)?>/i);
  if (open < 0) return { safe: pending, rest: "" };

  const before = pending.slice(0, open);
  const fromOpen = pending.slice(open);
  const closeMatch = fromOpen.match(/<\/think(?:ing)?>/i);
  if (!closeMatch || closeMatch.index == null) {
    // Still inside thinking — hold everything from the open tag.
    return { safe: before, rest: fromOpen };
  }
  const afterClose = fromOpen.slice(closeMatch.index + closeMatch[0].length);
  const nested = takeSafeContent(afterClose);
  return { safe: before + nested.safe, rest: nested.rest };
}
