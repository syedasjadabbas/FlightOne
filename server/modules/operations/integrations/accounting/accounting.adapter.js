/**
 * External accounting posting adapter (separate from internal AccountingEntry ledger).
 */
import { configuredCapability, unconfiguredCapability } from "../capability.js";
import { httpFailureResult, networkFailureResult } from "../httpPush.js";

export function getAccountingCapability() {
  const baseUrl = (process.env.OPS_ACCOUNTING_BASE_URL || "").trim();
  const apiKey = (process.env.OPS_ACCOUNTING_API_KEY || "").trim();
  if (!baseUrl || !apiKey) {
    return unconfiguredCapability("accounting", [
      "Set OPS_ACCOUNTING_BASE_URL and OPS_ACCOUNTING_API_KEY for external accounting postings",
      "Internal AccountingEntry ledger still records REVENUE/COST/MARGIN/PAYMENT/REFUND/CREDIT/COMMISSION locally",
    ]);
  }
  return configuredCapability("accounting", {
    verified: process.env.OPS_ACCOUNTING_VERIFY === "true",
  });
}

export async function pushAccountingEvent(event, { fetchImpl = fetch } = {}) {
  const cap = getAccountingCapability();
  if (!cap.configured) {
    return {
      status: "SKIPPED_UNCONFIGURED",
      retryable: false,
      error: cap.reasons.join("; "),
      response: { capability: { name: cap.name, state: cap.state, configured: false } },
    };
  }
  const baseUrl = process.env.OPS_ACCOUNTING_BASE_URL.replace(/\/$/, "");
  const path = process.env.OPS_ACCOUNTING_EVENTS_PATH || "/api/v1/journal";
  try {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPS_ACCOUNTING_API_KEY}`,
        "Idempotency-Key": `ops-acct:${event.id}`,
      },
      body: JSON.stringify({
        source: "flightone",
        eventId: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return httpFailureResult(res, "Accounting", json);
    return {
      status: "DELIVERED",
      retryable: false,
      externalRef: json?.id || null,
      response: json,
    };
  } catch (e) {
    return networkFailureResult(e, "Accounting");
  }
}
