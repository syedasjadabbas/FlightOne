import { AppError } from "./customError.js";
import { errorResponse } from "./response.js";

export const DEFAULT_PAGE_SIZE = 20;

export function parsePositiveInt(value, defaultPage = 1) {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return defaultPage;
  }
  return Math.floor(n);
}

export function sendExpressErrorResponse(err, req, res) {
  if (err instanceof AppError) {
    const extra = {};
    if (err.code) extra.code = err.code;
    if (err.details != null) extra.details = err.details;
    return errorResponse(
      res,
      err.message,
      Object.keys(extra).length ? extra : null,
      err.statusCode,
    );
  }
  if (err.code === "P2002") {
    const target = err.meta?.target;
    if (Array.isArray(target) && target.includes("email")) {
      return errorResponse(res, "Email already in use", null, 409);
    }
    return errorResponse(res, "Conflict", null, 409);
  }
  if (err.code === "P2025") {
    return errorResponse(res, "Not found", null, 404);
  }

  const status = typeof err.status === "number" ? err.status : 500;
  const isDev = req.app.get("env") === "development";

  if (status < 500) {
    return errorResponse(res, err?.message || "Error", null, status);
  }

  return errorResponse(
    res,
    isDev ? (err?.message ?? "Internal Server Error") : "Internal Server Error",
    isDev ? err : null,
    status,
  );
}
