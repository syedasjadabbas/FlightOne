/**
 * Debugs "email accepted by diagnose-email.mjs but users never get their
 * verification email" — that script calls dispatchEmail() directly, which
 * bypasses the real code path. Signup/login actually writes to
 * NotificationOutbox and relies on two things to deliver it:
 *   1. An inline fire-and-forget drain right after enqueue (best-effort,
 *      errors are swallowed — see auth.service.js's `.catch(() => {})`).
 *   2. A PM2 cron worker (workers/notification-outbox-drain.js, every 5min
 *      per ecosystem.config.cjs) as the real backstop.
 * If step 2 isn't actually running on this box (e.g. deployed with
 * `pm2 start app.js` instead of `pm2 start ecosystem.config.cjs`), rows
 * queue up in NotificationOutbox forever and nothing ever resends them.
 *
 * This script inspects the real table — the source of truth — instead of
 * guessing, then optionally drains it manually so you can see the real
 * per-row failure reason immediately.
 *
 * Usage:
 *   node scripts/diagnose-notification-outbox.mjs                 # inspect only
 *   node scripts/diagnose-notification-outbox.mjs --drain         # inspect + manually drain PENDING rows now
 *   node scripts/diagnose-notification-outbox.mjs --email=user@example.com   # filter to one user's rows (looked up by email)
 */
import "dotenv/config";
import prisma from "../config/prisma.js";
import { drainNotificationOutbox } from "../lib/notifications/drain.js";

const args = process.argv.slice(2);
const shouldDrain = args.includes("--drain");
const emailArg = args.find((a) => a.startsWith("--email="))?.split("=")[1];

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
function step(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(title);
  console.log("─".repeat(60));
}

async function main() {
  console.log("FlightOne — NotificationOutbox Diagnostic");
  console.log(`Started: ${new Date().toISOString()}`);

  let userId = null;
  if (emailArg) {
    const user = await prisma.user.findUnique({
      where: { email: emailArg.trim().toLowerCase() },
      select: { id: true, email: true },
    });
    if (!user) {
      fail(`No user found with email ${emailArg}`);
      process.exit(1);
    }
    userId = user.id;
    info(`Filtering to userId=${userId} (${emailArg})`);
  }

  // ── Overall counts by status, EMAIL channel only ────────────────────────
  step("EMAIL outbox rows by status (all time)");
  const grouped = await prisma.notificationOutbox.groupBy({
    by: ["status"],
    where: { channel: "EMAIL", ...(userId ? { userId } : {}) },
    _count: { _all: true },
  });
  if (grouped.length === 0) {
    fail(
      "Zero EMAIL rows ever recorded in NotificationOutbox" +
        (userId ? " for this user" : "") +
        ". This means enqueueNotificationOutbox() was never called or is failing " +
        "before it reaches the DB — check auth.service.js's " +
        "`await enqueueNotificationOutbox(rows).catch(...)` is actually being hit " +
        "(e.g. registerUser/resendVerificationCode is throwing earlier).",
    );
  } else {
    for (const g of grouped) {
      const line = `${g.status}: ${g._count._all}`;
      if (g.status === "SENT") ok(line);
      else if (g.status === "FAILED") fail(line);
      else warn(line);
    }
  }

  // ── PENDING rows stuck for a while → worker isn't draining them ────────
  step("Stuck PENDING rows (worker cron may not be running)");
  const stuckPending = await prisma.notificationOutbox.findMany({
    where: {
      channel: "EMAIL",
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }, // older than 10 min
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, userId: true, dedupeKey: true, createdAt: true, payload: true },
  });
  if (stuckPending.length > 0) {
    fail(
      `${stuckPending.length} EMAIL row(s) have been PENDING for over 10 minutes. ` +
        "If the notification-outbox-drain PM2 cron job (every 5min) were actually running on " +
        "this box, these would have been picked up already. Check on the VM: `pm2 list` — " +
        "is 'notification-outbox-drain' present and recently restarted? If it's missing, this " +
        "deploy likely started the app with `pm2 start app.js` instead of " +
        "`pm2 start ecosystem.config.cjs`, so none of the cron workers (including this one) ever ran.",
    );
    for (const row of stuckPending.slice(0, 5)) {
      const ageMin = Math.round((Date.now() - row.createdAt.getTime()) / 60000);
      console.log(
        `      - id=${row.id} userId=${row.userId} kind=${row.payload?.kind || "?"} age=${ageMin}min`,
      );
    }
  } else {
    ok("No stuck PENDING rows older than 10 minutes.");
  }

  // ── FAILED rows → real delivery errors, with reasons ────────────────────
  step("Recent FAILED EMAIL rows (real delivery error, last 20)");
  const failedRows = await prisma.notificationOutbox.findMany({
    where: { channel: "EMAIL", status: "FAILED", ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, userId: true, createdAt: true, payload: true },
  });
  if (failedRows.length === 0) {
    ok("No FAILED EMAIL rows.");
  } else {
    fail(`${failedRows.length} FAILED row(s) found:`);
    for (const row of failedRows) {
      const reason = row.payload?.deliveryError?.reason || "unknown";
      const attempts = row.payload?.delivery?.attempts ?? "?";
      console.log(
        `      - id=${row.id} userId=${row.userId} reason=${reason} attempts=${attempts} at=${row.createdAt.toISOString()}`,
      );
    }
    const reasons = new Set(failedRows.map((r) => r.payload?.deliveryError?.reason || "unknown"));
    if ([...reasons].some((r) => r.includes("resend_status_4"))) {
      fail("Some failures are 4xx from Resend — check RESEND_API_KEY validity and that RESEND_FROM_EMAIL's domain is verified in the Resend dashboard.");
    }
    if ([...reasons].some((r) => r === "email_recipient_missing")) {
      fail("email_recipient_missing — the outbox row had no resolvable recipient email (payload.email/to/recipientEmail all empty AND User.email lookup failed).");
    }
    if ([...reasons].some((r) => r === "email_not_configured")) {
      fail("email_not_configured — RESEND_API_KEY/NOTIFY_EMAIL_WEBHOOK_URL were unset AT THE TIME this row was drained (may differ from current env if it changed since).");
    }
  }

  // ── Most recent SENT rows → confirm the happy path really does work ────
  step("Most recent SENT EMAIL rows (confirms delivery pipeline works at all)");
  const sentRows = await prisma.notificationOutbox.findMany({
    where: { channel: "EMAIL", status: "SENT", ...(userId ? { userId } : {}) },
    orderBy: { sentAt: "desc" },
    take: 5,
    select: { id: true, userId: true, sentAt: true, payload: true },
  });
  if (sentRows.length === 0) {
    warn("No SENT EMAIL rows found at all — this pipeline may have never successfully delivered anything.");
  } else {
    for (const row of sentRows) {
      const provider = row.payload?.delivery?.provider || "?";
      const messageId = row.payload?.delivery?.messageId || "?";
      ok(`id=${row.id} sentAt=${row.sentAt?.toISOString()} provider=${provider} messageId=${messageId}`);
    }
  }

  // ── Optional: manually drain PENDING now ────────────────────────────────
  if (shouldDrain) {
    step("Manually draining PENDING rows now");
    const result = await drainNotificationOutbox({ limit: 50 });
    info(`drained=${result.drained} failed=${result.failed} deferred=${result.deferred}`);
    for (const r of result.results) {
      if (r.status === "SENT") ok(`${r.id} (${r.channel}) → SENT`);
      else if (r.status === "FAILED") fail(`${r.id} (${r.channel}) → FAILED: ${r.reason}`);
      else warn(`${r.id} (${r.channel}) → still PENDING: ${r.reason} (attempt ${r.attempt})`);
    }
  } else {
    console.log("\n(Pass --drain to manually drain PENDING rows now and see live results.)");
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("DONE");
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("\n💥 Diagnostic crashed unexpectedly:");
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
