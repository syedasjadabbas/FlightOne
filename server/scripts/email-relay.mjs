import http from "node:http";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const PORT = Number(process.env.RELAY_PORT) || 8085;
const API_KEY = process.env.NOTIFY_WEBHOOK_API_KEY || "fo-local-dev-relay-secret";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== "false";
const SMTP_USER = process.env.SMTP_USER || "asjadabbaszaidi@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || `"FlightOne Support" <${SMTP_USER}>`;

if (!SMTP_PASS) {
  console.error("❌ ERROR: SMTP_PASS is missing in .env file.");
  process.exit(1);
}

const { default: prisma } = await import("../config/prisma.js");

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Verify SMTP connection on startup
transporter.verify((error) => {
  if (error) {
    console.error("❌ Gmail SMTP connection failed:", error.message);
  } else {
    console.log(`✅ Gmail SMTP server connection verified (${SMTP_USER})`);
  }
});

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook/email") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Not Found" }));
  }

  // Check auth header if key configured
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

      // Look up user email from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      });

      if (!user || !user.email) {
        console.error(`❌ User not found for id: ${userId}`);
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "User not found" }));
      }

      const otp = extraPayload?.otp;
      const isVerification = extraPayload?.kind === "email_verification_otp";
      const recipient = user.email;

      console.log(`📧 Sending ${isVerification ? "email verification" : "password reset"} code to: ${recipient}`);

      const mailTitle = title || (isVerification ? "Verify your FlightOne email address" : "Password Reset Code");
      const intro = isVerification
        ? `Hi ${user.name || "there"},<br/><br/>Use the verification code below to verify your FlightOne account email address:`
        : `Hi ${user.name || "there"},<br/><br/>Use the verification code below to reset your FlightOne account password:`;
      const disclaimer = isVerification
        ? `This code is valid for <strong>10 minutes</strong> and can only be used once. If you did not create a FlightOne account, please ignore this email.`
        : `This code is valid for <strong>10 minutes</strong> and can only be used once. If you did not request a password reset, please ignore this email.`;

      const html = `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 22px; font-weight: 700; color: #022c43; letter-spacing: -0.5px;">Flight<span style="color: #00b4d8;">One</span></span>
          </div>
          <h2 style="color: #022c43; font-size: 20px; font-weight: 600; margin-top: 0;">${mailTitle}</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.5; margin-bottom: 20px;">${intro}</p>
          ${
            otp
              ? `
            <div style="margin: 24px 0; padding: 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
              <span style="font-family: monospace, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #022c43;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 12px;">${disclaimer}</p>
          `
              : `<p style="color: #334155; font-size: 15px; line-height: 1.5;">${body}</p>`
          }
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">© ${new Date().getFullYear()} FlightOne. All rights reserved.</p>
        </div>
      `;

      const mailOptions = {
        from: FROM_EMAIL,
        to: recipient,
        subject: mailTitle,
        text: `${body}\n\nVerification Code: ${otp || ""}`,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`🚀 Email delivered successfully to ${recipient}! Message ID: ${info.messageId}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, provider: "gmail-smtp-relay", messageId: info.messageId }));
    } catch (err) {
      console.error("❌ Failed to process webhook or send email:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 FlightOne Local Email Webhook Relay active`);
  console.log(`📍 Listening on: http://localhost:${PORT}/webhook/email`);
  console.log(`==================================================\n`);
});
