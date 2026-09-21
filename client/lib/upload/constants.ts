export const UPLOAD_DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const GCS_PUBLIC_URL_PATTERNS = [
  /^https:\/\/storage\.googleapis\.com\/.+/i,
  /^https:\/\/[a-z0-9._-]+\.storage\.googleapis\.com\/.+/i,
] as const;

export const GCS_UPLOAD_COPY = {
  missingSignerUrl: "NEXT_PUBLIC_GCS_SIGNER_URL is not configured",
  signFailed: "Could not create signed upload URL",
  invalidFileUrl: "Signed upload response did not return a valid GCS file URL",
  uploadFailed: "Could not upload file to Google Cloud Storage",
} as const;
