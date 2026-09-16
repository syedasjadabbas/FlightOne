/**
 * Module 02 — OCR field sanitization + mapping (no invented values).
 */

/** @typedef {import('./ocr.types.js').OcrIdentityFields} OcrIdentityFields */
/** @typedef {import('./ocr.types.js').OcrExtractionResult} OcrExtractionResult */

export const OCR_DOCUMENT_TYPES = Object.freeze([
  "PASSPORT",
  "NATIONAL_ID",
  "VISA",
  "RESIDENCE_PERMIT",
]);

export const OCR_FIELD_KEYS = Object.freeze([
  "documentNumber",
  "countryCode",
  "documentSubtype",
  "issuedAt",
  "expiresAt",
  "fullName",
  "nationality",
]);

/**
 * @param {OcrIdentityFields|Record<string, unknown>|null|undefined} input
 * @returns {OcrIdentityFields}
 */
export function sanitizeOcrFields(input) {
  if (!input || typeof input !== "object") return {};
  /** @type {OcrIdentityFields} */
  const out = {};
  for (const key of OCR_FIELD_KEYS) {
    const v = input[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (key === "countryCode" || key === "nationality") {
      if (s.length !== 2) continue;
      out[key] = s.toUpperCase();
      continue;
    }
    if (key === "issuedAt" || key === "expiresAt") {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) continue;
      out[key] = d.toISOString().slice(0, 10);
      continue;
    }
    out[key] = s;
  }
  return out;
}

/**
 * Map provider payload into a reviewable extraction. Never fills defaults.
 * @param {string} documentType
 * @param {object|null|undefined} extracted
 * @returns {OcrExtractionResult}
 */
export function mapOcrExtraction(documentType, extracted) {
  if (!OCR_DOCUMENT_TYPES.includes(documentType)) {
    return {
      provider: "none",
      fields: {},
      confidence: null,
      warnings: [`unsupported_document_type:${documentType}`],
      rawTextEcho: null,
    };
  }
  const fields = sanitizeOcrFields(extracted?.fields ?? extracted);
  const warnings = Array.isArray(extracted?.warnings) ? [...extracted.warnings] : [];
  return {
    provider: String(extracted?.provider ?? "unknown"),
    fields,
    confidence:
      typeof extracted?.confidence === "number" &&
      extracted.confidence >= 0 &&
      extracted.confidence <= 1
        ? extracted.confidence
        : null,
    warnings,
    rawTextEcho:
      typeof extracted?.rawText === "string" && extracted.rawText.trim()
        ? extracted.rawText.trim().slice(0, 4000)
        : null,
  };
}
