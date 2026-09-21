import { AppError } from "./customError.js";

export const DEFAULT_PAGE_SIZE = 20;

export { sendExpressErrorResponse, publicErrorMessage, isTechnicalErrorMessage } from "./publicErrors.js";

export function parsePositiveInt(value, defaultPage = 1) {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return defaultPage;
  }
  return Math.floor(n);
}

/** @deprecated Prefer AppError — kept for any legacy imports. */
export { AppError };
