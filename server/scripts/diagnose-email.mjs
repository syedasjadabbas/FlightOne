/**
 * Email-sending diagnostic — run this directly on the box that's failing
 * (e.g. the VM) to find out exactly where mail delivery breaks: env config,
 * DNS/network reachability to Resend, or the API call itself.
 *
 * Exercises the *real* production code path (getEmailCapability / dispatchEmail
 * from lib/notifications/providers/email.provider.js) — this is not a
 * reimplementation, so a pass here means prod would also send.
 *
 * Usage:
 *   node scripts/diagnose-email.mjs you@example.com
 *   node scripts/diagnose-email.mjs you@example.com --send   # also sends a real test email
 *
 * Without --send it only checks config + connectivity (no email is sent).
 * Never prints the API key or full email addresses — only masked forms.
 */
import "dotenv/config";
import dns from "node:dns/promises";
import os from "node:os";
import tls from "node:tls";
import { performance } from "node:perf_hooks";
import {
  dispatchEmail,
  getEmailCapability,
  maskEmail,
} from "../lib/notifications/providers/email.provider.js";

const RESEND_HOST = "api.resend.com";
const args = process.argv.slice(2);
const targetEmail = args.find((a) => !a.startsWith("--"));
const shouldSend = args.includes("--send");

let stepNum = 0;
function step(title) {
  stepNum += 1;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`STEP ${stepNum}: ${title}`);
  console.log("─".repeat(60));
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}
function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
}
function fail(msg) {
  console.log(`  ❌ ${msg}`);
}
function info(msg) {
  console.log(`  ℹ️  ${msg}`);
}

function maskSecret(value) {
  if (!value) return "(not set)";
  const v = String(value);
  if (v.length <= 8) return `${v.slice(0, 2)}***`;
  return `${v.slice(0, 6)}...${v.slice(-4)} (len ${v.length})`;
}

async function main() {
  console.log("FlightOne — Email Delivery Diagnostic");
  console.log(`Started: ${new Date().toISOString()}`);

  // ── Step 1: runtime/environment context ──────────────────────────────
  step("Runtime environment");
  info(`Node: ${process.version}`);
  info(`Platform: ${os.platform()} ${os.release()} (${os.arch()})`);
  info(`Hostname: ${os.hostname()}`);
  info(`NODE_ENV: ${process.env.NODE_ENV || "(not set)"}`);
  info(`cwd: ${process.cwd()}`);
  const [major] = process.version.replace("v", "").split(".").map(Number);
  if (major < 18) {
    warn(`Node ${process.version} — global fetch requires Node 18+. This alone would break email sending.`);
  } else {
    ok("Node version supports global fetch");
  }

  // ── Step 2: env var configuration ─────────────────────────────────────
  step("Environment variables");
  const env = process.env;
  const vars = [
    ["RESEND_API_KEY", env.RESEND_API_KEY, true],
    ["RESEND_FROM_EMAIL", env.RESEND_FROM_EMAIL, false],
    ["FROM_EMAIL", env.FROM_EMAIL, false],
    ["NOTIFY_EMAIL_WEBHOOK_URL", env.NOTIFY_EMAIL_WEBHOOK_URL, false],
    ["NOTIFY_WEBHOOK_API_KEY", env.NOTIFY_WEBHOOK_API_KEY, true],
    ["NOTIFY_EMAIL_TIMEOUT_MS", env.NOTIFY_EMAIL_TIMEOUT_MS, false],
    ["ALLOW_SIMULATED_NOTIFICATIONS", env.ALLOW_SIMULATED_NOTIFICATIONS, false],
  ];
  for (const [name, value, secret] of vars) {
    if (value == null || value === "") {
      info(`${name}: (not set)`);
    } else {
      console.log(`  ℹ️  ${name}: ${secret ? maskSecret(value) : value}`);
    }
  }

  const capability = getEmailCapability(env);
  console.log("");
  info(`Resolved capability: ${JSON.stringify(capability)}`);
  if (capability.mode === "live" && capability.provider === "resend") {
    ok("Config resolves to: live Resend API");
  } else if (capability.mode === "live" && capability.provider === "email-webhook") {
    warn("Config resolves to: legacy webhook relay, not direct Resend — confirm NOTIFY_EMAIL_WEBHOOK_URL is reachable from this box");
  } else if (capability.mode === "simulated") {
    fail(
      "Config resolves to SIMULATED mode — no email is actually sent. " +
        "This is almost certainly why the VM 'doesn't work' while local does: " +
        "RESEND_API_KEY (and NOTIFY_EMAIL_WEBHOOK_URL) are unset on this box, " +
        "so ALLOW_SIMULATED_NOTIFICATIONS=true is silently swallowing every send.",
    );
  } else {
    fail("Config resolves to UNCONFIGURED — no email provider and no simulated fallback. Every send will fail immediately.");
  }

  if (capability.mode === "unconfigured") {
    fail("No live provider and no simulated fallback — stopping here, nothing downstream can work until this is fixed.");
    printSummaryAndExit(false);
    return;
  }

  if (capability.mode === "simulated") {
    fail("Stopping here — fix RESEND_API_KEY (or NOTIFY_EMAIL_WEBHOOK_URL) on this box, then re-run this script.");
    printSummaryAndExit(false);
    return;
  }

  // ── Step 3: DNS resolution to Resend ──────────────────────────────────
  if (capability.provider === "resend") {
    step(`DNS resolution: ${RESEND_HOST}`);
    try {
      const t0 = performance.now();
      const addrs = await dns.lookup(RESEND_HOST, { all: true });
      const ms = (performance.now() - t0).toFixed(0);
      ok(`Resolved in ${ms}ms: ${addrs.map((a) => `${a.address} (v${a.family})`).join(", ")}`);
    } catch (e) {
      fail(`DNS lookup failed: ${e.code || e.message}`);
      fail("If DNS fails here, the VM cannot reach Resend at all — check the VM's resolv.conf / outbound DNS, or a restrictive egress firewall/proxy.");
      printSummaryAndExit(false);
      return;
    }

    // ── Step 4: raw TCP + TLS reachability on 443 ──────────────────────
    step(`TCP + TLS reachability: ${RESEND_HOST}:443`);
    try {
      await new Promise((resolve, reject) => {
        const t0 = performance.now();
        const socket = tls.connect(
          { host: RESEND_HOST, port: 443, servername: RESEND_HOST, timeout: 8000 },
          () => {
            const ms = (performance.now() - t0).toFixed(0);
            ok(`TLS handshake completed in ${ms}ms (protocol: ${socket.getProtocol()})`);
            socket.end();
            resolve();
          },
        );
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("connection timed out after 8s"));
        });
        socket.on("error", reject);
      });
    } catch (e) {
      fail(`TLS connection failed: ${e.message}`);
      fail(
        "If DNS resolves but TCP/TLS fails, this VM's outbound traffic on 443 to " +
          `${RESEND_HOST} is being blocked (security group / firewall / NAT / corporate proxy). ` +
          "This is the single most common cause of 'works locally, not on the VM.'",
      );
      printSummaryAndExit(false);
      return;
    }
  }

  // ── Step 5: exercise the real dispatch path with a synthetic notification
  step(shouldSend ? "Sending a real test email via dispatchEmail()" : "Dry run: validating dispatchEmail() path (no email sent)");

  if (!targetEmail || !targetEmail.includes("@")) {
    warn("No recipient email given as an argument — skipping the live dispatchEmail() call.");
    info("Re-run as: node scripts/diagnose-email.mjs you@example.com [--send]");
    printSummaryAndExit(true);
    return;
  }

  if (!shouldSend) {
    info(`Would send to ${maskEmail(targetEmail)} — pass --send to actually dispatch a test email.`);
    printSummaryAndExit(true);
    return;
  }

  const notification = {
    id: `diag_${Date.now()}`,
    userId: null,
    title: "FlightOne email diagnostic",
    body: `This is a test email sent by scripts/diagnose-email.mjs from host ${os.hostname()} at ${new Date().toISOString()}.`,
    payload: { email: targetEmail, name: "Diagnostic" },
    dedupeKey: `diag-${Date.now()}`,
  };

  const t0 = performance.now();
  const result = await dispatchEmail(notification, { env });
  const ms = (performance.now() - t0).toFixed(0);

  console.log("");
  info(`dispatchEmail() returned in ${ms}ms:`);
  console.log(`  ${JSON.stringify(result, null, 2).split("\n").join("\n  ")}`);

  if (result.ok) {
    ok(`Email accepted by ${result.provider}${result.messageId ? ` (messageId: ${result.messageId})` : ""}`);
    ok(`Check the inbox for ${maskEmail(targetEmail)} (and spam folder) to confirm final delivery.`);
    printSummaryAndExit(true);
  } else {
    fail(`Send failed: reason=${result.reason} retryable=${result.retryable} provider=${result.provider}`);
    if (result.reason?.startsWith("resend_status_4")) {
      fail("A 4xx from Resend usually means: invalid/revoked API key, or the `from` domain in RESEND_FROM_EMAIL is not verified in the Resend dashboard for this account.");
    } else if (result.reason?.startsWith("resend_status_5")) {
      warn("5xx from Resend — likely a transient outage on their side, retry.");
    } else if (result.reason?.startsWith("email_error:")) {
      fail("Request never reached Resend or errored client-side — re-check the DNS/TLS steps above; also check for a proxy that requires HTTP_PROXY/HTTPS_PROXY env vars which `fetch` may not honor by default on this Node version.");
    }
    printSummaryAndExit(false);
  }
}

function printSummaryAndExit(passed) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(passed ? "RESULT: PASS" : "RESULT: FAIL");
  console.log("═".repeat(60));
  process.exit(passed ? 0 : 1);
}

main().catch((e) => {
  console.error("\n💥 Diagnostic crashed unexpectedly:");
  console.error(e);
  process.exit(1);
});
