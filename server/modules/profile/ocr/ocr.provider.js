/**
 * Module 02 — OCR provider registry.
 * No third-party OCR SDK ships in this repo. Default is unconfigured (empty fields).
 * Set OCR_PROVIDER=http + OCR_HTTP_URL to call an external extractor.
 */
import { mapOcrExtraction, sanitizeOcrFields, OCR_DOCUMENT_TYPES } from "./ocr.map.js";
import { unconfiguredOcrProvider } from "./unconfigured.provider.js";
import { createHttpOcrProvider } from "./http.provider.js";

export {
  mapOcrExtraction,
  sanitizeOcrFields,
  OCR_DOCUMENT_TYPES,
} from "./ocr.map.js";

/** @deprecated use unconfiguredOcrProvider — kept for older imports/tests */
export const stubOcrProvider = unconfiguredOcrProvider;

/** @type {import('./ocr.types.js').OcrProvider|null} */
let overrideProvider = null;

/**
 * Resolve provider from env. Never returns a faking extractor.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveOcrProvider(env = process.env) {
  const name = (env.OCR_PROVIDER || "unconfigured").trim().toLowerCase();
  if (name === "http") {
    return createHttpOcrProvider({ env });
  }
  if (name === "none" || name === "unconfigured" || name === "stub") {
    return unconfiguredOcrProvider;
  }
  // Unknown name → unconfigured (do not invent a provider).
  return {
    name: `unknown:${name}`,
    async extract(args) {
      const base = await unconfiguredOcrProvider.extract(args);
      return mapOcrExtraction(args.documentType, {
        ...base,
        provider: `unknown:${name}`,
        warnings: [...base.warnings, `unknown_ocr_provider:${name}`],
      });
    },
  };
}

export function getOcrProvider() {
  return overrideProvider ?? resolveOcrProvider();
}

/** Tests only. */
export function setOcrProvider(provider) {
  if (!provider || typeof provider.extract !== "function") {
    throw new Error("Invalid OCR provider");
  }
  overrideProvider = provider;
}

export function resetOcrProvider() {
  overrideProvider = null;
}

export { unconfiguredOcrProvider, createHttpOcrProvider };
