/**
 * HTTP OCR adapter — calls an external OCR service when configured.
 *
 * Env:
 *   OCR_PROVIDER=http
 *   OCR_HTTP_URL=https://ocr.example/v1/extract
 *   OCR_HTTP_API_KEY=... (optional Bearer)
 *   OCR_HTTP_TIMEOUT_MS=15000
 *   OCR_HTTP_SEND_BINARY=true (default) — include contentBase64 when provided
 *
 * Expected JSON response (any missing field is omitted — never invented):
 *   { fields?: { documentNumber?, countryCode?, ... }, confidence?: number, warnings?: string[] }
 *
 * Never logs contentBase64 or raw document bytes.
 */
import { mapOcrExtraction } from "./ocr.map.js";

function configFromEnv(env = process.env) {
  const url = env.OCR_HTTP_URL?.trim();
  const sendBinaryRaw = (env.OCR_HTTP_SEND_BINARY || "true").trim().toLowerCase();
  return {
    url: url || null,
    apiKey: env.OCR_HTTP_API_KEY?.trim() || null,
    timeoutMs: Number(env.OCR_HTTP_TIMEOUT_MS) || 15_000,
    sendBinary: sendBinaryRaw !== "false" && sendBinaryRaw !== "0",
  };
}

/**
 * @param {{ fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {import('./ocr.types.js').OcrProvider}
 */
export function createHttpOcrProvider(deps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const env = deps.env ?? process.env;
  const cfg = configFromEnv(env);

  return {
    name: "http",
    async extract({
      documentType,
      vaultDocumentId,
      contentType,
      byteSize,
      hasBinary,
      contentBase64,
      rawText,
    }) {
      if (!cfg.url) {
        return mapOcrExtraction(documentType, {
          provider: "http",
          fields: {},
          confidence: null,
          warnings: ["ocr_http_url_not_configured"],
          rawText: null,
        });
      }
      if (typeof fetchImpl !== "function") {
        return mapOcrExtraction(documentType, {
          provider: "http",
          fields: {},
          confidence: null,
          warnings: ["ocr_http_fetch_unavailable"],
          rawText: null,
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const headers = {
          "content-type": "application/json",
          accept: "application/json",
        };
        if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;

        const payload = {
          documentType,
          vaultDocumentId: vaultDocumentId ?? null,
          contentType: contentType ?? null,
          byteSize: byteSize ?? null,
          hasBinary: Boolean(hasBinary),
          rawText: rawText?.trim() ? rawText.trim().slice(0, 20000) : null,
        };
        if (cfg.sendBinary && contentBase64) {
          payload.contentBase64 = contentBase64;
        }

        const res = await fetchImpl(cfg.url, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          return mapOcrExtraction(documentType, {
            provider: "http",
            fields: {},
            confidence: null,
            warnings: [`ocr_http_status_${res.status}`],
            rawText: null,
          });
        }

        const body = await res.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return mapOcrExtraction(documentType, {
            provider: "http",
            fields: {},
            confidence: null,
            warnings: ["ocr_http_invalid_json"],
            rawText: null,
          });
        }

        return mapOcrExtraction(documentType, {
          provider: "http",
          fields: body.fields ?? {},
          confidence: body.confidence,
          warnings: Array.isArray(body.warnings) ? body.warnings : [],
          rawText: null,
        });
      } catch (e) {
        return mapOcrExtraction(documentType, {
          provider: "http",
          fields: {},
          confidence: null,
          warnings: [`ocr_http_error:${e?.name || "Error"}`],
          rawText: null,
        });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
