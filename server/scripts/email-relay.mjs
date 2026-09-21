/**
 * Optional local email webhook relay backed by Resend.
 *
 * Prefer configuring RESEND_API_KEY on the API server so EMAIL outbox rows
 * send directly via Resend. This relay only matters when using
 * NOTIFY_EMAIL_WEBHOOK_URL=http://localhost:8085/webhook/email.
 */
import http from "node:http";
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.RELAY_PORT) || 8085;
const API_KEY = process.env.NOTIFY_WEBHOOK_API_KEY || "fo-local-dev-relay-secret";
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || "";
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  process.env.FROM_EMAIL?.trim() ||
  "FlightOne <onboarding@resend.dev>";

if (!RESEND_API_KEY) {
  console.error("❌ ERROR: RESEND_API_KEY is missing in .env file.");
  process.exit(1);
}

const { default: prisma } = await import("../config/prisma.js");
const { buildEmailHtml } = await import(
  "../lib/notifications/providers/email.provider.js"
);

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook/email") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Not Found" }));
  }

  if (API_KEY) {
    const authHeader = req.headers.authorization || "";
    const expected = `Bearer ${API_KEY}`;
    if (authHeader !== expected) {
      console.warn("⚠️ Relay rejected request: invalid Authorization header");
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    }
  }

  let bodyText = "";
  req.on("data", (chunk) => {
    bodyText += chunk;
  });

  req.on("end", async () => {
    try {
      const payload = JSON.parse(bodyText);
      const { userId, title, body, payload: extraPayload, dedupeKey } = payload;

      console.log(`\n📬 Webhook received for userId: ${userId} (${dedupeKey})`);

      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Missing userId" }));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      });

      if (!user || !user.email) {
        console.error(`❌ User not found for id: ${userId}`);
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "User not found" }));
      }

      const notification = {
        title: title || "FlightOne notification",
        body: body || "",
        payload: extraPayload ?? null,
        dedupeKey,
      };
      const html = buildEmailHtml(notification, { name: user.name });
      const otp = extraPayload?.otp;
      const text = `${body || ""}\n\nVerification Code: ${otp || ""}`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(dedupeKey
            ? { "Idempotency-Key": String(dedupeKey).slice(0, 256) }
            : {}),
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [user.email],
          subject: notification.title,
          html,
          text,
        }),
      });

      const resendJson = await resendRes.json().catch(() => ({}));
      if (!resendRes.ok) {
        throw new Error(
          resendJson?.message || `Resend HTTP ${resendRes.status}`,
        );
      }

      console.log(
        `🚀 Email delivered via Resend to ${user.email}. Message ID: ${resendJson.id}`,
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          provider: "resend-relay",
          messageId: resendJson.id,
        }),
      );
    } catch (err) {
      console.error("❌ Failed to process webhook or send email:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 FlightOne Local Email Webhook Relay (Resend)`);
  console.log(`📍 Listening on: http://localhost:${PORT}/webhook/email`);
  console.log(`==================================================\n`);
});
