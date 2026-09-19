/**
 * Phase 2 Visa Vault — client display helpers for expiry / visa status.
 * Mirrors server computeVisaDisplayStatus; API visaMeta.visaStatus is authoritative.
 */

export type VaultVisaHolderStatus = "ISSUED" | "PENDING" | "IN_PROCESS" | "CANCELLED";

export type VaultVisaDisplayStatus =
  | "ISSUED"
  | "PENDING"
  | "IN_PROCESS"
  | "CANCELLED"
  | "EXPIRED"
  | "EXPIRING"
  | "SUPERSEDED";

export const VISA_TYPE_OPTIONS = [
  { value: "tourist", label: "Tourist / Visit" },
  { value: "business", label: "Business" },
  { value: "transit", label: "Transit" },
  { value: "student", label: "Student / Education" },
  { value: "work", label: "Work / Employment" },
  { value: "family", label: "Family visit" },
  { value: "umrah", label: "Umrah / Pilgrimage" },
  { value: "e-visa", label: "eVisa" },
  { value: "other", label: "Other" },
] as const;

export const VISA_HOLDER_STATUS_OPTIONS = [
  { value: "ISSUED", label: "Issued / held" },
  { value: "PENDING", label: "Pending submission" },
  { value: "IN_PROCESS", label: "In process" },
  { value: "CANCELLED", label: "Cancelled / revoked" },
] as const;

export const VISA_DESTINATION_OPTIONS = [
  { value: "AE", label: "United Arab Emirates (AE)" },
  { value: "SA", label: "Saudi Arabia (SA)" },
  { value: "TR", label: "Turkey (TR)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "US", label: "United States (US)" },
  { value: "DE", label: "Germany / Schengen (DE)" },
  { value: "TH", label: "Thailand (TH)" },
  { value: "MY", label: "Malaysia (MY)" },
  { value: "SG", label: "Singapore (SG)" },
  { value: "QA", label: "Qatar (QA)" },
  { value: "CA", label: "Canada (CA)" },
  { value: "CN", label: "China (CN)" },
  { value: "AU", label: "Australia (AU)" },
  { value: "FR", label: "France (FR)" },
  { value: "IT", label: "Italy (IT)" },
];

export const VAULT_TYPE_LABELS: Record<string, string> = {
  PASSPORT: "Passport",
  NATIONAL_ID: "National ID",
  RESIDENCE_PERMIT: "Residence Permit",
  VISA: "Visa",
  TICKET: "Ticket",
  HOTEL_VOUCHER: "Hotel Voucher",
  INSURANCE: "Insurance",
  FF_CARD: "Frequent Flyer",
  LOYALTY_CARD: "Loyalty Card",
  TRAVEL_CERT: "Travel Certificate",
  OTHER: "Other",
};

export const VAULT_TYPE_ORDER = [
  "PASSPORT",
  "NATIONAL_ID",
  "RESIDENCE_PERMIT",
  "VISA",
  "TICKET",
  "HOTEL_VOUCHER",
  "INSURANCE",
  "FF_CARD",
  "LOYALTY_CARD",
  "TRAVEL_CERT",
  "OTHER",
] as const;

export function daysUntilExpiry(dateIso: string | null | undefined, now = Date.now()): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function computeVisaDisplayStatus(args: {
  holderStatus?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  now?: number;
}): VaultVisaDisplayStatus {
  if (args.isActive === false) return "SUPERSEDED";
  if (args.holderStatus === "CANCELLED") return "CANCELLED";
  const days = daysUntilExpiry(args.expiresAt, args.now);
  if (days !== null && days < 0) return "EXPIRED";
  if (args.holderStatus === "PENDING") return "PENDING";
  if (args.holderStatus === "IN_PROCESS") return "IN_PROCESS";
  if (days !== null && days <= 90) return "EXPIRING";
  return "ISSUED";
}

export function visaStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "ISSUED":
      return "Issued";
    case "PENDING":
      return "Pending";
    case "IN_PROCESS":
      return "In process";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    case "EXPIRING":
      return "Expiring soon";
    case "SUPERSEDED":
      return "Superseded";
    default:
      return "Visa";
  }
}
