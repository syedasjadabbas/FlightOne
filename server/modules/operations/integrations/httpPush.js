/**
 * Shared HTTP push classification for Ops external adapters.
 * Never logs Authorization headers or API keys.
 */

/** @param {number} status */
export function isRetryableHttpStatus(status) {
  const code = Number(status);
  if (!Number.isFinite(code)) return true;
  if (code === 408 || code === 425 || code === 429) return true;
  if (code >= 500 && code <= 599) return true;
  return false;
}

/**
 * @param {Response} res
 * @param {string} label
 * @param {unknown} [json]
 */
export function httpFailureResult(res, label, json = null) {
  const retryable = isRetryableHttpStatus(res.status);
  return {
    status: "FAILED",
    retryable,
    error: `${label} HTTP ${res.status}`,
    response: json,
  };
}

/**
 * @param {unknown} err
 * @param {string} label
 */
export function networkFailureResult(err, label) {
  return {
    status: "FAILED",
    retryable: true,
    error: err?.message || `${label} network error`,
  };
}
