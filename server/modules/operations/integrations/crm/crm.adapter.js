/**
 * CRM adapter — never fabricates sync success.
 * Configure with OPS_CRM_BASE_URL + OPS_CRM_API_KEY (optional OPS_CRM_VERIFY=true).
 */
import { configuredCapability, unconfiguredCapability } from "../capability.js";
import { httpFailureResult, networkFailureResult } from "../httpPush.js";

export function getCrmCapability() {
  const baseUrl = (process.env.OPS_CRM_BASE_URL || "").trim();
  const apiKey = (process.env.OPS_CRM_API_KEY || "").trim();
  if (!baseUrl || !apiKey) {
    return unconfiguredCapability("crm", [
      "Set OPS_CRM_BASE_URL and OPS_CRM_API_KEY to enable CRM sync",
    ]);
  }
  return configuredCapability("crm", {
    verified: process.env.OPS_CRM_VERIFY === "true",
    reasons: ["CRM adapter configured — pushes only when drain runs"],
  });
}

/**
 * Push one ops event to CRM. Returns { status, retryable?, externalRef?, error?, response? }.
 */
export async function pushCrmEvent(event, { fetchImpl = fetch } = {}) {
  const cap = getCrmCapability();
  if (!cap.configured) {
    return {
      status: "SKIPPED_UNCONFIGURED",
      retryable: false,
      error: cap.reasons.join("; "),
      response: { capability: { name: cap.name, state: cap.state, configured: false } },
    };
  }

  const baseUrl = process.env.OPS_CRM_BASE_URL.replace(/\/$/, "");
  const path = process.env.OPS_CRM_EVENTS_PATH || "/api/v1/flightone/events";
  try {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPS_CRM_API_KEY}`,
        "Idempotency-Key": `ops-crm:${event.id}`,
      },
      body: JSON.stringify({
        source: "flightone",
        eventId: event.id,
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: event.createdAt,
      }),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    if (!res.ok) return httpFailureResult(res, "CRM", json);
    return {
      status: "DELIVERED",
      retryable: false,
      externalRef: json?.id || json?.externalRef || null,
      response: json,
    };
  } catch (e) {
    return networkFailureResult(e, "CRM");
  }
}
