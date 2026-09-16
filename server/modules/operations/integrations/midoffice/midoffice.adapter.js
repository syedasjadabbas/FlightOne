import { configuredCapability, unconfiguredCapability } from "../capability.js";
import { httpFailureResult, networkFailureResult } from "../httpPush.js";

export function getMidOfficeCapability() {
  const baseUrl = (process.env.OPS_MIDOFFICE_BASE_URL || "").trim();
  const apiKey = (process.env.OPS_MIDOFFICE_API_KEY || "").trim();
  if (!baseUrl || !apiKey) {
    return unconfiguredCapability("midoffice", [
      "Set OPS_MIDOFFICE_BASE_URL and OPS_MIDOFFICE_API_KEY to enable mid-office sync",
    ]);
  }
  return configuredCapability("midoffice", {
    verified: process.env.OPS_MIDOFFICE_VERIFY === "true",
  });
}

export async function pushMidOfficeEvent(event, { fetchImpl = fetch } = {}) {
  const cap = getMidOfficeCapability();
  if (!cap.configured) {
    return {
      status: "SKIPPED_UNCONFIGURED",
      retryable: false,
      error: cap.reasons.join("; "),
      response: { capability: { name: cap.name, state: cap.state, configured: false } },
    };
  }
  const baseUrl = process.env.OPS_MIDOFFICE_BASE_URL.replace(/\/$/, "");
  const path = process.env.OPS_MIDOFFICE_EVENTS_PATH || "/api/v1/events";
  try {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPS_MIDOFFICE_API_KEY}`,
        "Idempotency-Key": `ops-mid:${event.id}`,
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
    if (!res.ok) return httpFailureResult(res, "Mid-office", json);
    return {
      status: "DELIVERED",
      retryable: false,
      externalRef: json?.id || null,
      response: json,
    };
  } catch (e) {
    return networkFailureResult(e, "Mid-office");
  }
}
