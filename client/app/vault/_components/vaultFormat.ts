import type { VaultDocType } from "@/lib/api/vault.api";

export function formatVaultDate(value: string | null | undefined) {
  if (!value) return "No expiry";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatVaultDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function getDaysUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const now = Date.now();
  const target = new Date(dateIso).getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export type ExpiryTone = "ok" | "warn" | "danger" | "muted";

export function expiryDisplay(expiresAt: string | null | undefined): {
  tone: ExpiryTone;
  label: string;
} {
  const days = getDaysUntil(expiresAt);
  if (days === null) {
    return { tone: "muted", label: "No expiration date" };
  }
  if (days < 0) {
    return { tone: "danger", label: `Expired · ${formatVaultDate(expiresAt)}` };
  }
  if (days <= 90) {
    return {
      tone: "warn",
      label: `Expiring in ${days}d · ${formatVaultDate(expiresAt)}`,
    };
  }
  return { tone: "ok", label: `Valid · Exp ${formatVaultDate(expiresAt)}` };
}

export function formatByteSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Lucide metaphor for document type — passport / lock / file. */
export function vaultDocIconKind(
  type: VaultDocType | string,
): "passport" | "visa" | "ticket" | "loyalty" | "lock" | "file" {
  switch (type) {
    case "PASSPORT":
    case "NATIONAL_ID":
    case "RESIDENCE_PERMIT":
      return "passport";
    case "VISA":
    case "TRAVEL_CERT":
      return "visa";
    case "TICKET":
    case "HOTEL_VOUCHER":
    case "INSURANCE":
      return "ticket";
    case "FF_CARD":
    case "LOYALTY_CARD":
      return "loyalty";
    case "OTHER":
      return "file";
    default:
      return "lock";
  }
}
