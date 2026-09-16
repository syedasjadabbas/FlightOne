/**
 * Unconfigured OCR provider — never invents identity fields.
 * Used when OCR_PROVIDER is unset or unknown.
 */
import { mapOcrExtraction } from "./ocr.map.js";

/** @type {import('./ocr.types.js').OcrProvider} */
export const unconfiguredOcrProvider = {
  name: "unconfigured",
  async extract({ documentType, rawText, contentBase64, hasBinary }) {
    const warnings = ["ocr_provider_unconfigured"];
    if (rawText?.trim()) {
      warnings.push("raw_text_ignored_without_provider");
    }
    if (contentBase64 || hasBinary) {
      warnings.push("binary_ignored_without_provider");
    }
    return mapOcrExtraction(documentType, {
      provider: "unconfigured",
      fields: {},
      confidence: null,
      warnings,
      rawText: null,
    });
  },
};
