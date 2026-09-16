/**
 * Live auth E2E against filght-one-server (/api/v1/auth/*).
 * Run: node scripts/e2e-auth.mjs
 * Requires: API at NEXT_PUBLIC_API_URL or http://localhost:8084/api/v1
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:8084/api/v1";

const email = `fo.auth.${Date.now()}@example.com`;
const password = "TestPass9!";
const name = "FlightOne Tester";

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

async function main() {
  const report = { api: API, email, steps: [] };
  console.log(`\nAuth E2E → ${API}\n`);

  // 1. Signup valid
  {
    const r = await api("/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    report.steps.push({ step: "signup", status: r.status });
    assert("signup 201", r.status === 201, String(r.status));
    assert("signup returns tokens", Boolean(r.json?.data?.accessToken));
    assert("signup returns user email", r.json?.data?.user?.email === email);
    assert("signup never returns passwordHash", !("passwordHash" in (r.json?.data?.user || {})));
  }

  // 2. Duplicate email
  {
    const r = await api("/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    report.steps.push({ step: "duplicate", status: r.status });
    assert("duplicate email 409", r.status === 409, String(r.status));
  }

  // 3. Invalid email
  {
    const r = await api("/auth/register", {
      method: "POST",
      body: { email: "bad", password, name },
    });
    report.steps.push({ step: "invalid-email", status: r.status });
    assert("invalid email rejected", r.status === 400 || r.status === 422, String(r.status));
  }

  // 4. Weak password
  {
    const r = await api("/auth/register", {
      method: "POST",
      body: { email: `weak.${Date.now()}@example.com`, password: "short", name },
    });
    report.steps.push({ step: "weak-password", status: r.status });
    assert("weak password rejected", r.status === 400 || r.status === 422, String(r.status));
  }

  // 5. Login wrong password
  {
    const r = await api("/auth/login", {
      method: "POST",
      body: { email, password: "WrongPass9!" },
    });
    report.steps.push({ step: "login-wrong", status: r.status });
    assert("wrong password 401", r.status === 401, String(r.status));
  }

  // 6. Login correct
  let accessToken = null;
  let refreshToken = null;
  {
    const r = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    report.steps.push({ step: "login-ok", status: r.status });
    assert("login 200", r.status === 200, String(r.status));
    accessToken = r.json?.data?.accessToken;
    refreshToken = r.json?.data?.refreshToken;
    assert("login accessToken", Boolean(accessToken));
  }

  // 7. me
  {
    const r = await api("/auth/me", { token: accessToken });
    report.steps.push({ step: "me", status: r.status });
    assert("me 200", r.status === 200, String(r.status));
    assert("me email", r.json?.data?.email === email);
  }

  // 8. conversation create + ownership
  let conversationId = null;
  {
    const r = await api("/conversations", {
      method: "POST",
      token: accessToken,
      body: { title: "Auth E2E chat" },
    });
    report.steps.push({ step: "create-conversation", status: r.status });
    assert("create conversation", r.status === 201, String(r.status));
    conversationId = r.json?.data?.id;
    assert("conversation id", Boolean(conversationId));
  }

  // 9. record messages (no stub)
  {
    const r = await api(`/conversations/${conversationId}/messages/record`, {
      method: "POST",
      token: accessToken,
      body: {
        messages: [
          { role: "USER", content: "Lahore to Dubai on Sep 10" },
          { role: "ASSISTANT", content: "Here are flights.", provider: "flightone" },
        ],
      },
    });
    report.steps.push({ step: "record-messages", status: r.status });
    assert("record messages 201", r.status === 201, String(r.status));
  }

  // 10. unauthorized access
  {
    const r = await api(`/conversations/${conversationId}`, {
      token: "invalid.token.here",
    });
    report.steps.push({ step: "unauthorized-get", status: r.status });
    assert("invalid token rejected", r.status === 401 || r.status === 403, String(r.status));
  }

  // 11. logout
  {
    const r = await api("/auth/logout", {
      method: "POST",
      token: accessToken,
      body: { refreshToken },
    });
    report.steps.push({ step: "logout", status: r.status });
    assert("logout ok", r.status === 200, String(r.status));
  }

  report.status = process.exitCode ? "FAIL" : "PASS";
  writeFileSync(resolve(__dir, "../e2e-auth.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.status} → e2e-auth.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
