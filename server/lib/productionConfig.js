/**
 * Production startup configuration guards.
 * Dev/test are intentionally permissive; production fails closed on unsafe defaults.
 * Never logs secret values.
 */
export class ProductionConfigError extends Error {
  constructor(messages) {
    const list = Array.isArray(messages) ? messages : [messages];
    super(`Unsafe production configuration:\n- ${list.join("\n- ")}`);
    this.name = "ProductionConfigError";
    this.code = "UNSAFE_PRODUCTION_CONFIG";
    this.messages = list;
  }
}

export function isProductionEnv(env = process.env) {
  return (env.NODE_ENV || "").trim() === "production";
}

/** Obvious example / placeholder JWT secrets — never accept in production. */
export function isObviousExampleJwtSecret(value) {
  if (typeof value !== "string") return true;
  const s = value.trim();
  if (s.length < 32) return true;
  const lower = s.toLowerCase();
  if (lower.includes("change-me") || lower.includes("changeme")) return true;
  if (lower.includes("test-jwt-secret") || lower.includes("dev-secret")) return true;
  if (lower.includes("your-secret") || lower.includes("your_secret")) return true;
  if (lower.includes("replace-me") || lower.includes("replace_me")) return true;
  if (/\btodo\b/i.test(s)) return true;
  // Placeholder copy from .env.example style docs — not real entropy.
  if (lower.includes("in-production") && lower.includes("min-32")) return true;
  return false;
}

export function isLocalhostCorsOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return true;
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.includes("*")) return true;
  return parts.every((p) => /localhost|127\.0\.0\.1/i.test(p));
}

export function isObviousExampleBootstrapEmail(email) {
  if (typeof email !== "string" || !email.trim()) return true;
  const e = email.trim().toLowerCase();
  return e === "admin@example.com" || e.endsWith("@example.com") || e.endsWith("@example.org");
}

export function isObviousExampleBootstrapPassword(password) {
  if (typeof password !== "string" || password.length < 12) return true;
  return /changeme|change-me|password|admin123|ChangeMe123!|secret123|letmein/i.test(
    password,
  );
}

/**
 * Validate production process env. No-op outside production.
 * @throws {ProductionConfigError}
 */
export function assertProductionConfigSafe(env = process.env) {
  if (!isProductionEnv(env)) return;

  const errors = [];

  if (isObviousExampleJwtSecret(env.JWT_SECRET)) {
    errors.push(
      "JWT_SECRET must be a strong non-example secret (min 32 characters; not a placeholder)",
    );
  }

  if (!env.FIELD_ENCRYPTION_KEY?.trim()) {
    errors.push("FIELD_ENCRYPTION_KEY is required in production for PII field encryption");
  }

  if (isLocalhostCorsOrigin(env.CORS_ORIGIN)) {
    errors.push(
      "CORS_ORIGIN must list real frontend origin(s); localhost/* defaults are not allowed in production",
    );
  }

  if (env.ALLOW_SIMULATED_PAYMENT === "true") {
    errors.push("ALLOW_SIMULATED_PAYMENT must not be enabled in production");
  }

  if (env.ALLOW_SIMULATED_BOOKING === "true") {
    errors.push("ALLOW_SIMULATED_BOOKING must not be enabled in production");
  }

  if (env.PASSWORD_RESET_RETURN_TOKEN === "true") {
    errors.push("PASSWORD_RESET_RETURN_TOKEN must not be enabled in production");
  }

  if (env.AUTH_RETURN_REFRESH_IN_BODY === "true") {
    errors.push("AUTH_RETURN_REFRESH_IN_BODY must not be enabled in production");
  }

  const vault = (env.VAULT_STORAGE_PROVIDER || "unconfigured").trim().toLowerCase();
  if (vault === "local") {
    errors.push(
      "VAULT_STORAGE_PROVIDER=local is development-only and not allowed in production",
    );
  }
  if (vault === "gcs") {
    if (!env.GCLOUD_PROJECT_ID?.trim()) {
      errors.push("GCLOUD_PROJECT_ID is required when VAULT_STORAGE_PROVIDER=gcs");
    }
    if (!env.GCLOUD_BUCKET?.trim()) {
      errors.push("GCLOUD_BUCKET is required when VAULT_STORAGE_PROVIDER=gcs");
    }
    const hasCreds = Boolean(
      env.GCP_KEY_BASE64?.trim() ||
        env.GCP_KEY_FILE_PATH?.trim() ||
        env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
    );
    if (!hasCreds) {
      errors.push(
        "GCP_KEY_FILE_PATH (or GCP_KEY_BASE64 / GOOGLE_APPLICATION_CREDENTIALS) is required when VAULT_STORAGE_PROVIDER=gcs",
      );
    }
  }

  if (errors.length) {
    throw new ProductionConfigError(errors);
  }
}

/**
 * Bootstrap admin credentials for prisma seed — fail closed in production.
 * @throws {ProductionConfigError}
 */
export function assertProductionBootstrapAdminSafe(env = process.env) {
  if (!isProductionEnv(env)) return;

  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  const errors = [];
  if (isObviousExampleBootstrapEmail(email)) {
    errors.push(
      "BOOTSTRAP_ADMIN_EMAIL must be set to a real non-example address in production",
    );
  }
  if (isObviousExampleBootstrapPassword(password)) {
    errors.push(
      "BOOTSTRAP_ADMIN_PASSWORD must be a strong non-example password in production (min 12 chars)",
    );
  }

  if (errors.length) {
    throw new ProductionConfigError(errors);
  }
}
