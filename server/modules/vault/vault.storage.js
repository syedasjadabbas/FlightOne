/**
 * Module 07 — Vault binary storage providers.
 *
 * Providers:
 *  - gcs  — Google Cloud Storage (production). DB stores public GCS fileUrl only.
 *  - local — filesystem under VAULT_LOCAL_ROOT (dev/test). DB stores local://… URL.
 *
 * Fail-closed when unconfigured. Never invent cloud credentials.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { AppError } from "../../lib/customError.js";
import {
  isAllowedGcsUrl,
  isLocalStorageUrl,
  objectKeyFromGcsUrl,
  objectKeyFromLocalUrl,
} from "../../lib/storageUrl.js";
import {
  deleteGcsObject,
  downloadGcsObject,
  isGcsConfigured,
  uploadBufferToGcs,
} from "../uploads/uploads.service.js";

export const VAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export const VAULT_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function getVaultStorageCapability() {
  const provider = (process.env.VAULT_STORAGE_PROVIDER || "unconfigured").trim().toLowerCase();
  const root = process.env.VAULT_LOCAL_ROOT?.trim() || null;
  const localReady = provider === "local" && Boolean(root);
  const gcsReady = provider === "gcs" && isGcsConfigured();

  if (gcsReady) {
    return {
      provider: "gcs",
      configured: true,
      canUpload: true,
      canDownload: true,
      maxBytes: VAULT_MAX_BYTES,
      allowedMimeTypes: [...VAULT_ALLOWED_MIME],
      reasons: [],
    };
  }
  if (localReady) {
    return {
      provider: "local",
      configured: true,
      canUpload: true,
      canDownload: true,
      maxBytes: VAULT_MAX_BYTES,
      allowedMimeTypes: [...VAULT_ALLOWED_MIME],
      reasons: [],
    };
  }

  const reasons = [];
  if (provider === "gcs") {
    reasons.push(
      "VAULT_STORAGE_PROVIDER=gcs requires GCLOUD_PROJECT_ID, GCLOUD_BUCKET, and GCP_KEY_FILE_PATH (or GCP_KEY_BASE64)",
    );
  } else if (provider === "local" && !root) {
    reasons.push("VAULT_LOCAL_ROOT is required when VAULT_STORAGE_PROVIDER=local");
  } else {
    reasons.push(
      "Vault binary storage is not configured — set VAULT_STORAGE_PROVIDER=gcs (prod) or local (dev)",
    );
  }

  return {
    provider:
      provider === "gcs"
        ? "gcs_misconfigured"
        : provider === "local"
          ? "local_misconfigured"
          : "unconfigured",
    configured: false,
    canUpload: false,
    canDownload: false,
    maxBytes: VAULT_MAX_BYTES,
    allowedMimeTypes: [...VAULT_ALLOWED_MIME],
    reasons,
  };
}

export function sanitizeOriginalFilename(name) {
  const base = path.basename(String(name || "document")).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const trimmed = base.slice(0, 180);
  return trimmed || "document";
}

export function assertSafeObjectKey(storageKey) {
  if (!storageKey || typeof storageKey !== "string") {
    throw new AppError(500, "Invalid vault storage key");
  }
  if (storageKey.includes("..") || path.isAbsolute(storageKey) || storageKey.includes("\\")) {
    throw new AppError(500, "Invalid vault storage key");
  }
  const parts = storageKey.split("/");
  if (parts.length < 3 || parts.some((p) => !p || p === "." || p === "..")) {
    throw new AppError(500, "Invalid vault storage key");
  }
  return storageKey;
}

export function validateUploadPayload({ contentType, originalFilename, byteLength }) {
  if (!contentType || !VAULT_ALLOWED_MIME.has(String(contentType).toLowerCase())) {
    throw new AppError(400, "Unsupported file type");
  }
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new AppError(400, "Empty file is not allowed");
  }
  if (byteLength > VAULT_MAX_BYTES) {
    throw new AppError(400, `File exceeds maximum size of ${VAULT_MAX_BYTES} bytes`);
  }
  return {
    contentType: String(contentType).toLowerCase(),
    originalFilename: sanitizeOriginalFilename(originalFilename),
    byteLength,
  };
}

function unconfiguredProvider() {
  return {
    name: "unconfigured",
    async put() {
      const err = new AppError(503, "Vault storage is not configured");
      err.code = "VAULT_STORAGE_UNCONFIGURED";
      err.details = { capability: getVaultStorageCapability() };
      throw err;
    },
    async get() {
      const err = new AppError(503, "Vault storage is not configured");
      err.code = "VAULT_STORAGE_UNCONFIGURED";
      err.details = { capability: getVaultStorageCapability() };
      throw err;
    },
    async remove() {
      // Soft no-op — metadata soft-delete may run without bytes.
    },
  };
}

function localProvider(root) {
  const resolvedRoot = path.resolve(root);

  async function absolutePathFor(storageKey) {
    const safe = assertSafeObjectKey(storageKey);
    const abs = path.resolve(resolvedRoot, safe);
    if (!abs.startsWith(resolvedRoot + path.sep) && abs !== resolvedRoot) {
      throw new AppError(500, "Invalid vault storage key");
    }
    return abs;
  }

  function keyFromFileUrl(fileUrl) {
    if (isLocalStorageUrl(fileUrl)) {
      return assertSafeObjectKey(objectKeyFromLocalUrl(fileUrl));
    }
    // Legacy rows stored bare relative keys in storageKey / fileUrl.
    return assertSafeObjectKey(String(fileUrl).replace(/^local:\/\//i, ""));
  }

  return {
    name: "local",
    async put({ storageKey, buffer }) {
      const abs = await absolutePathFor(storageKey);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buffer);
      return { fileUrl: `local://${storageKey}`, byteSize: buffer.length };
    },
    async get({ fileUrl }) {
      const abs = await absolutePathFor(keyFromFileUrl(fileUrl));
      try {
        return await fs.readFile(abs);
      } catch (e) {
        if (e && e.code === "ENOENT") {
          throw new AppError(404, "Vault file not found");
        }
        throw e;
      }
    },
    async remove({ fileUrl }) {
      try {
        const abs = await absolutePathFor(keyFromFileUrl(fileUrl));
        await fs.unlink(abs);
      } catch (e) {
        if (e && e.code !== "ENOENT") throw e;
      }
    },
  };
}

function gcsProvider() {
  return {
    name: "gcs",
    async put({ storageKey, buffer, contentType }) {
      const safe = assertSafeObjectKey(storageKey);
      const fileUrl = await uploadBufferToGcs({
        buffer,
        objectKey: safe,
        contentType: contentType || "application/octet-stream",
      });
      return { fileUrl, byteSize: buffer.length };
    },
    async get({ fileUrl }) {
      if (!isAllowedGcsUrl(fileUrl)) {
        throw new AppError(500, "Invalid GCS file URL");
      }
      const objectKey = objectKeyFromGcsUrl(fileUrl);
      if (!objectKey) {
        throw new AppError(500, "Invalid GCS file URL");
      }
      try {
        return await downloadGcsObject(objectKey);
      } catch (e) {
        if (e?.code === 404) {
          throw new AppError(404, "Vault file not found");
        }
        throw e;
      }
    },
    async remove({ fileUrl }) {
      if (!isAllowedGcsUrl(fileUrl)) return;
      const objectKey = objectKeyFromGcsUrl(fileUrl);
      if (!objectKey) return;
      await deleteGcsObject(objectKey);
    },
  };
}

/** Resolve the active storage provider (fail-closed by default). */
export function getVaultStorage() {
  const cap = getVaultStorageCapability();
  if (cap.configured && cap.provider === "gcs") {
    return gcsProvider();
  }
  if (cap.configured && cap.provider === "local") {
    return localProvider(process.env.VAULT_LOCAL_ROOT.trim());
  }
  return unconfiguredProvider();
}

export function buildStorageKey({ ownerUserId, documentId, originalFilename }) {
  const safeOwner = String(ownerUserId).replace(/[^a-zA-Z0-9_-]/g, "");
  const safeDoc = String(documentId).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeOwner || !safeDoc) {
    throw new AppError(500, "Cannot build vault storage key");
  }
  return `${safeOwner}/${safeDoc}/${sanitizeOriginalFilename(originalFilename)}`;
}

export function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function decodeBase64Content(contentBase64) {
  if (!contentBase64 || typeof contentBase64 !== "string") {
    throw new AppError(400, "contentBase64 is required");
  }
  const raw = contentBase64.includes(",")
    ? contentBase64.slice(contentBase64.indexOf(",") + 1)
    : contentBase64;
  let buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch {
    throw new AppError(400, "contentBase64 is invalid");
  }
  if (!buffer.length) {
    throw new AppError(400, "Empty file is not allowed");
  }
  if (buffer.length > VAULT_MAX_BYTES) {
    throw new AppError(400, `File exceeds maximum size of ${VAULT_MAX_BYTES} bytes`);
  }
  return buffer;
}

/** Resolve the stored URL used to fetch/delete bytes (fileUrl preferred; legacy storageKey fallback). */
export function resolveStoredFileUrl(doc) {
  if (!doc) return null;
  if (doc.fileUrl && (isAllowedGcsUrl(doc.fileUrl) || isLocalStorageUrl(doc.fileUrl))) {
    return doc.fileUrl;
  }
  if (doc.storageKey) {
    if (isAllowedGcsUrl(doc.storageKey) || isLocalStorageUrl(doc.storageKey)) {
      return doc.storageKey;
    }
    return `local://${doc.storageKey}`;
  }
  return null;
}
