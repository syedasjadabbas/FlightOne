const GCS_HOST_PATTERNS = [
  /^https:\/\/storage\.googleapis\.com\/.+/i,
  /^https:\/\/[a-z0-9._-]+\.storage\.googleapis\.com\/.+/i,
];

const LOCAL_URL_PATTERN = /^local:\/\/.+/i;

export function isAllowedGcsUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return GCS_HOST_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isLocalStorageUrl(value) {
  if (typeof value !== "string") return false;
  return LOCAL_URL_PATTERN.test(value.trim());
}

/** True when the value is a known storage URL we persist (GCS or local://). */
export function isAllowedStorageUrl(value) {
  return isAllowedGcsUrl(value) || isLocalStorageUrl(value);
}

/**
 * Extract object key from a public GCS URL.
 * Supports path-style and virtual-hosted-style URLs.
 */
export function objectKeyFromGcsUrl(fileUrl) {
  if (!isAllowedGcsUrl(fileUrl)) return null;
  try {
    const u = new URL(fileUrl.trim());
    if (/^storage\.googleapis\.com$/i.test(u.hostname)) {
      // https://storage.googleapis.com/<bucket>/<object...>
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      if (parts.length < 2) return null;
      return decodeURIComponent(parts.slice(1).join("/"));
    }
    // https://<bucket>.storage.googleapis.com/<object...>
    if (/\.storage\.googleapis\.com$/i.test(u.hostname)) {
      return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    }
  } catch {
    return null;
  }
  return null;
}

export function objectKeyFromLocalUrl(fileUrl) {
  if (!isLocalStorageUrl(fileUrl)) return null;
  return fileUrl.trim().slice("local://".length);
}
