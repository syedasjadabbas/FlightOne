/**
 * Module 07 — Vault binary storage providers.
 *
 * Fail-closed when unconfigured. Local provider is for development/tests only
 * (VAULT_STORAGE_PROVIDER=local + VAULT_LOCAL_ROOT). Never invent cloud credentials.
 *
 * Object keys are opaque server-side paths; callers must never accept client-supplied
 * absolute paths (path-traversal prevention).
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { AppError } from "../../lib/customError.js";

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
  return {
    provider: localReady ? "local" : provider === "local" ? "local_misconfigured" : "unconfigured",
    configured: localReady,
    canUpload: localReady,
    canDownload: localReady,
    maxBytes: VAULT_MAX_BYTES,
    allowedMimeTypes: [...VAULT_ALLOWED_MIME],
    reasons: localReady
      ? []
      : provider === "local" && !root
        ? ["VAULT_LOCAL_ROOT is required when VAULT_STORAGE_PROVIDER=local"]
        : ["Vault binary storage is not configured — set VAULT_STORAGE_PROVIDER=local and VAULT_LOCAL_ROOT for dev/test"],
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
  // ownerId/docId/filename — three segments minimum
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

  return {
    name: "local",
    async put({ storageKey, buffer }) {
      const abs = await absolutePathFor(storageKey);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buffer);
      return { storageKey, byteSize: buffer.length };
    },
    async get({ storageKey }) {
      const abs = await absolutePathFor(storageKey);
      try {
        return await fs.readFile(abs);
      } catch (e) {
        if (e && e.code === "ENOENT") {
          throw new AppError(404, "Vault file not found");
        }
        throw e;
      }
    },
    async remove({ storageKey }) {
      try {
        const abs = await absolutePathFor(storageKey);
        await fs.unlink(abs);
      } catch (e) {
        if (e && e.code !== "ENOENT") throw e;
      }
    },
  };
}

/** Resolve the active storage provider (fail-closed by default). */
export function getVaultStorage() {
  const cap = getVaultStorageCapability();
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
  // Strip data-URL prefix if present.
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
