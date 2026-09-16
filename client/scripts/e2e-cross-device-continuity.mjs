/**
 * Cross-device continuity E2E (API-level Browser A / Browser B).
 * Run: node scripts/e2e-cross-device-continuity.mjs
 * Requires: filght-one-server on :8084 with travelPlan metadata persistence.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:8084/api/v1";

const email = `fo.crossdevice.${Date.now()}@example.com`;
const password = "TestPass9!";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(name, cond, detail = "") {
  if (cond) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

const samplePlan = {
  action: "search",
  searches: [
    {
      product: "FLIGHT",
      query: {
        origin: "LHE",
        destination: "DXB",
        departureDate: "2026-09-18",
        passengers: 1,
        cabinClass: "ECONOMY",
      },
    },
  ],
  datesAssumed: false,
  filters: { preferredAirlines: ["EY"] },
};

async function main() {
  const report = { api: API, email, steps: [] };
  console.log(`\nCross-device continuity E2E → ${API}\n`);

  // Browser A: register + login
  const signup = await api("/auth/register", {
    method: "POST",
    body: { email, password, name: "Cross Device" },
  });
  report.steps.push({ step: "signup", status: signup.status });
  assert("A signup 201", signup.status === 201, String(signup.status));
  const tokenA = signup.json?.data?.accessToken;
  assert("A has access token", Boolean(tokenA));

  // Browser A: create conversation + record turn with travelPlan
  const created = await api("/conversations", {
    method: "POST",
    token: tokenA,
    body: { title: "LHE to DXB chat" },
  });
  report.steps.push({ step: "create-conversation", status: created.status });
  assert("A create conversation", created.status === 201, String(created.status));
  const conversationId = created.json?.data?.id;
  assert("A conversation id", Boolean(conversationId));

  const recorded = await api(`/conversations/${conversationId}/messages/record`, {
    method: "POST",
    token: tokenA,
    body: {
      messages: [
        {
          role: "USER",
          content: "Find flights from Lahore to Dubai on September 18, 2026.",
        },
        {
          role: "ASSISTANT",
          content:
            "Based on your preferences, Best overall is a strong LHE→DXB option. Compare the panel for Cheapest and Fastest.",
          provider: "flightone",
        },
      ],
      travelPlan: samplePlan,
    },
  });
  report.steps.push({ step: "record-messages", status: recorded.status });
  assert("A record messages 201", recorded.status === 201, String(recorded.status));

  // Browser B: fresh login (new token), no local conversationId
  const loginB = await api("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  report.steps.push({ step: "login-b", status: loginB.status });
  assert("B login 200", loginB.status === 200, String(loginB.status));
  const tokenB = loginB.json?.data?.accessToken;
  assert("B has access token", Boolean(tokenB));
  assert("B token differs from A (new session)", tokenB !== tokenA);

  // Browser B: list conversations → load latest
  const list = await api("/conversations?page=1&pageSize=5", { token: tokenB });
  report.steps.push({ step: "list-b", status: list.status });
  assert("B list conversations", list.status === 200, String(list.status));
  const latest = list.json?.data?.items?.[0];
  assert("B sees latest conversation", latest?.id === conversationId, latest?.id);

  const detail = await api(`/conversations/${conversationId}`, { token: tokenB });
  report.steps.push({ step: "get-b", status: detail.status });
  assert("B get conversation", detail.status === 200, String(detail.status));

  const messages = detail.json?.data?.messages ?? [];
  const metadata = detail.json?.data?.metadata;
  const travelPlan = metadata?.travelPlan;

  assert("B loads user message", messages.some((m) => m.role === "USER" && /Dubai/.test(m.content)));
  assert(
    "B loads assistant message",
    messages.some((m) => m.role === "ASSISTANT" && /Best overall/i.test(m.content)),
  );
  assert("B metadata has travelPlan", Boolean(travelPlan), JSON.stringify(metadata));
  assert("B travelPlan action search", travelPlan?.action === "search");
  assert(
    "B travelPlan LHE→DXB",
    travelPlan?.searches?.[0]?.query?.origin === "LHE" &&
      travelPlan?.searches?.[0]?.query?.destination === "DXB",
    JSON.stringify(travelPlan?.searches?.[0]?.query),
  );
  assert(
    "B travelPlan date",
    travelPlan?.searches?.[0]?.query?.departureDate === "2026-09-18",
  );
  assert(
    "B travelPlan preferred EY",
    travelPlan?.filters?.preferredAirlines?.includes("EY"),
    JSON.stringify(travelPlan?.filters),
  );

  // Simulate resume helper expectations used by the client
  const resumeMessages = messages
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));
  assert("B resume has >=2 messages", resumeMessages.length >= 2);

  report.detail = {
    conversationId,
    messageCount: messages.length,
    travelPlan,
  };

  const out = resolve(__dir, "../e2e-cross-device-continuity.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
  console.log(process.exitCode ? "\nFAILED" : "\nPASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
