/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: "flight-one-api",
      script: "app.js",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: "8084",
        DATABASE_POOL_SIZE: "8",
        DATABASE_POOL_TIMEOUT: "30",
      },
    },
    // One-shot workers (autorestart:false) — PM2 cron_restart is the scheduler.
    // Same pattern as docs/PREPROD_CHECKLIST.md for journey-monitor.
    {
      name: "journey-monitor",
      script: "workers/journey-monitor.js",
      autorestart: false,
      cron_restart: "*/5 * * * *",
      env: { NODE_ENV: "production" },
    },
    {
      name: "profile-document-expiry",
      script: "workers/profile-document-expiry.js",
      autorestart: false,
      // Hourly: enqueue 180/30/7-day document expiry notifications (deduped).
      cron_restart: "0 * * * *",
      env: { NODE_ENV: "production" },
    },
    {
      name: "notification-outbox-drain",
      script: "workers/notification-outbox-drain.js",
      autorestart: false,
      // Deliver PENDING NotificationOutbox rows (APP always; EMAIL/WhatsApp when configured).
      cron_restart: "*/5 * * * *",
      env: { NODE_ENV: "production" },
    },
    {
      name: "ops-outbox-drain",
      script: "workers/ops-outbox-drain.js",
      autorestart: false,
      // Deliver PENDING OpsOutboxEvent rows (CRM/mid/back/accounting when configured).
      cron_restart: "*/5 * * * *",
      env: { NODE_ENV: "production" },
    },
    {
      name: "visa-notifications",
      script: "workers/visa-notifications.js",
      autorestart: false,
      // Hourly: visa-doc expiry + apply-by (only when attributed processing days + departAt exist).
      cron_restart: "15 * * * *",
      env: { NODE_ENV: "production" },
    },
    {
      name: "rewards-expiry",
      script: "workers/rewards-expiry.js",
      autorestart: false,
      cron_restart: "30 3 * * *",
      env: { NODE_ENV: "production" },
    },
    {
      name: "vault-retention",
      script: "workers/vault-retention.js",
      autorestart: false,
      // Daily: hard-purge soft-deleted vault docs past VAULT_RETENTION_DAYS (batched).
      cron_restart: "45 4 * * *",
      env: { NODE_ENV: "production" },
    },
  ],
};
