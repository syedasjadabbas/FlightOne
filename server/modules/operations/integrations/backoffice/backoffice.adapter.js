import { configuredCapability, unconfiguredCapability } from "../capability.js";
import { httpFailureResult, networkFailureResult } from "../httpPush.js";

export function getBackOfficeCapability() {
  const baseUrl = (process.env.OPS_BACKOFFICE_BASE_URL || "").trim();
  const apiKey = (process.env.OPS_BACKOFFICE_API_KEY || "").trim();
  if (!baseUrl || !apiKey) {
    return unconfiguredCapability("backoffice", [
      "Set OPS_BACKOFFICE_BASE_URL and OPS_BACKOFFICE_API_KEY to enable back-office sync",
    ]);
  }
  return configuredCapability("backoffice", {
    verified: process.env.OPS_BACKOFFICE_VERIFY === "true",
  });
}

export async function pushBackOfficeEvent(event, { fetchImpl = fetch } = {}) {
  const cap = getBackOfficeCapability();
  if (!cap.configured) {
    return {
      status: "SKIPPED_UNCONFIGURED",
      retryable: false,
      error: cap.reasons.join("; "),
      response: { capability: { name: cap.name, state: cap.state, configured: false } },
    };
  }
  const baseUrl = process.env.OPS_BACKOFFICE_BASE_URL.replace(/\/$/, "");
  const path = process.env.OPS_BACKOFFICE_EVENTS_PATH || "/api/v1/events";
  try {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPS_BACKOFFICE_API_KEY}`,
        "Idempotency-Key": `ops-back:${event.id}`,
      },
      body: JSON.stringify({
        source: "flightone",
        eventId: event.id,
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return httpFailureResult(res, "Back-office", json);
    return {
      status: "DELIVERED",
      retryable: false,
      externalRef: json?.id || null,
      response: json,
    };
  } catch (e) {
    return networkFailureResult(e, "Back-office");
  }
}
