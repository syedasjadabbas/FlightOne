/**
 * GCS signed-upload + server-side buffer upload.
 * Mirrors serene crm-server/modules/uploads — clients never hold GCP credentials.
 */
import { Storage } from "@google-cloud/storage";
import fs from "node:fs";
import { AppError } from "../../lib/customError.js";

/**
 * Allowed content types for browser-direct signed uploads. Mirrors
 * modules/vault/vault.storage.js's VAULT_ALLOWED_MIME — this is the only
 * live consumer of createSignedUploadUrl today. A future non-vault upload
 * feature should pass its own explicit allowlist rather than widen this one.
 */
const SIGNED_UPLOAD_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function parseCredentialsFromBase64() {
  const base64 = process.env.GCP_KEY_BASE64;
  if (!base64) return null;
  try {
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    throw new AppError(500, "GCP_KEY_BASE64 is invalid");
  }
}

function parseCredentialsFromFilePath() {
  const keyFilePath =
    process.env.GCP_KEY_FILE_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFilePath) return null;
  try {
    const raw = fs.readFileSync(keyFilePath, "utf8");
    return JSON.parse(raw);
  } catch {
    throw new AppError(500, "GCP key file path is invalid or unreadable");
  }
}

export function isGcsConfigured(env = process.env) {
  const projectId = env.GCLOUD_PROJECT_ID?.trim();
  const bucket = env.GCLOUD_BUCKET?.trim();
  if (!projectId || !bucket) return false;
  return Boolean(
    env.GCP_KEY_BASE64?.trim() ||
      env.GCP_KEY_FILE_PATH?.trim() ||
      env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

function getStorageClient() {
  const projectId = process.env.GCLOUD_PROJECT_ID?.trim();
  if (!projectId) {
    throw new AppError(500, "GCLOUD_PROJECT_ID is not configured");
  }
  const credentials = parseCredentialsFromFilePath() || parseCredentialsFromBase64();
  if (!credentials) {
    throw new AppError(
      500,
      "Set GCP_KEY_FILE_PATH (or GOOGLE_APPLICATION_CREDENTIALS) for GCS credentials",
    );
  }
  return new Storage({ projectId, credentials });
}

export function publicGcsFileUrl(bucketName, objectKey) {
  return `https://storage.googleapis.com/${bucketName}/${objectKey}`;
}

/**
 * @param {{ objectKey: string, contentType: string }} body
 * @param {{ userId: string }} actor — authenticated caller; objectKey must live under vault/<userId>/…
 */
export async function createSignedUploadUrl({ objectKey, contentType }, { userId } = {}) {
  const normalizedContentType = String(contentType || "").trim().toLowerCase();
  if (!SIGNED_UPLOAD_ALLOWED_MIME.has(normalizedContentType)) {
    throw new AppError(400, "Unsupported file type");
  }

  if (!userId) {
    throw new AppError(401, "Authentication required");
  }
  const requiredPrefix = `vault/${userId}/`;
  if (!objectKey.startsWith(requiredPrefix)) {
    throw new AppError(403, "objectKey must be scoped to the authenticated user's own vault folder");
  }

  const bucketName = process.env.GCLOUD_BUCKET?.trim();
  if (!bucketName) {
    throw new AppError(500, "GCLOUD_BUCKET is not configured");
  }

  const storage = getStorageClient();
  const file = storage.bucket(bucketName).file(objectKey);
  const expiresMs = Date.now() + 10 * 60 * 1000;

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresMs,
    contentType: normalizedContentType,
  });

  return {
    uploadUrl,
    fileUrl: publicGcsFileUrl(bucketName, objectKey),
    headers: {
      "content-type": normalizedContentType,
    },
  };
}

/**
 * Direct server-side upload for bytes already in-process (printables, legacy
 * base64 paths). Skips the signed-URL round trip used by browser clients.
 */
export async function uploadBufferToGcs({ buffer, objectKey, contentType }) {
  const bucketName = process.env.GCLOUD_BUCKET?.trim();
  if (!bucketName) {
    throw new AppError(500, "GCLOUD_BUCKET is not configured");
  }

  const storage = getStorageClient();
  await storage.bucket(bucketName).file(objectKey).save(buffer, {
    contentType,
    resumable: false,
  });

  return publicGcsFileUrl(bucketName, objectKey);
}

export async function downloadGcsObject(objectKey) {
  const bucketName = process.env.GCLOUD_BUCKET?.trim();
  if (!bucketName) {
    throw new AppError(500, "GCLOUD_BUCKET is not configured");
  }
  const storage = getStorageClient();
  const [buf] = await storage.bucket(bucketName).file(objectKey).download();
  return buf;
}

export async function deleteGcsObject(objectKey) {
  const bucketName = process.env.GCLOUD_BUCKET?.trim();
  if (!bucketName) {
    throw new AppError(500, "GCLOUD_BUCKET is not configured");
  }
  const storage = getStorageClient();
  try {
    await storage.bucket(bucketName).file(objectKey).delete({ ignoreNotFound: true });
  } catch (e) {
    if (e?.code !== 404) throw e;
  }
}
