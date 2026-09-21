/**
 * Browser → GCS signed upload (same flow as serene crm-client).
 * 1) POST /uploads/sign → uploadUrl + fileUrl
 * 2) PUT bytes to uploadUrl
 * 3) Caller persists fileUrl on the domain API (vault/groups/etc.)
 */
import { API_BASE_URL } from "@/lib/api/baseApi";
import { useAuthStore } from "@/store/auth.store";
import {
  GCS_PUBLIC_URL_PATTERNS,
  GCS_UPLOAD_COPY,
  UPLOAD_DEFAULT_CONTENT_TYPE,
} from "@/lib/upload/constants";

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isGcsPublicUrl(value: string) {
  return GCS_PUBLIC_URL_PATTERNS.some((pattern) => pattern.test(value));
}

function inferMimeTypeFromName(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return null;
}

function normalizeMimeType(value: string): string {
  return value.trim().toLowerCase();
}

type SignResponse = {
  success?: boolean;
  data?: {
    uploadUrl: string;
    fileUrl: string;
    headers?: Record<string, string>;
  };
  uploadUrl?: string;
  fileUrl?: string;
  headers?: Record<string, string>;
};

export async function uploadFileToGcs(
  file: File,
  opts: { folder: string },
): Promise<{
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const normalizedContentType = normalizeMimeType(
    file.type?.trim() ||
      inferMimeTypeFromName(file.name) ||
      UPLOAD_DEFAULT_CONTENT_TYPE,
  );
  const key = `${opts.folder}/${Date.now()}-${sanitizeName(file.name)}`;
  const signerUrl =
    process.env.NEXT_PUBLIC_GCS_SIGNER_URL || `${API_BASE_URL}/uploads/sign`;

  if (!signerUrl) {
    throw new Error(GCS_UPLOAD_COPY.missingSignerUrl);
  }

  const token = useAuthStore.getState().accessToken;
  const signRes = await fetch(signerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      objectKey: key,
      contentType: normalizedContentType,
    }),
  });
  if (!signRes.ok) {
    throw new Error(GCS_UPLOAD_COPY.signFailed);
  }

  const signedJson = (await signRes.json()) as SignResponse;
  const signed = signedJson.data ?? signedJson;
  const uploadUrl = signed.uploadUrl;
  const fileUrl = signed.fileUrl;
  const headers = signed.headers;

  if (!uploadUrl || !fileUrl || !isGcsPublicUrl(fileUrl)) {
    throw new Error(GCS_UPLOAD_COPY.invalidFileUrl);
  }

  const putHeaders: Record<string, string> = { ...(headers ?? {}) };
  if (!Object.keys(putHeaders).some((k) => k.toLowerCase() === "content-type")) {
    putHeaders["content-type"] = normalizedContentType;
  }

  const body = await file.arrayBuffer();
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: putHeaders,
    body,
  });
  if (!putRes.ok) {
    throw new Error(GCS_UPLOAD_COPY.uploadFailed);
  }

  return {
    url: fileUrl,
    originalName: file.name,
    mimeType: normalizedContentType,
    sizeBytes: file.size,
  };
}
