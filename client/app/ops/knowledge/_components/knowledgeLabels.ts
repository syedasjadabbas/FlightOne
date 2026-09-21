import type {
  KnowledgeCategory,
  KnowledgeStatus,
  KnowledgeVisibility,
} from "@/lib/api/knowledge.api";

export const CATEGORIES: KnowledgeCategory[] = [
  "SOP",
  "AIRLINE_POLICY",
  "SUPPLIER_RULE",
  "CORPORATE_TRAVEL_POLICY",
  "VISA_RULE",
  "SUPPLIER_CONTRACT",
  "VISA_PROCEDURE",
  "CORPORATE_AGREEMENT",
  "TRAVEL_POLICY",
];

const LABEL_OVERRIDES: Partial<Record<string, string>> = {
  SOP: "SOP",
  CUSTOMER_SAFE: "Customer-safe",
};

export function humanizeToken(value: string): string {
  if (LABEL_OVERRIDES[value]) return LABEL_OVERRIDES[value]!;
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c,
  label: humanizeToken(c),
}));

export const STATUS_OPTIONS: { value: KnowledgeStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "EXPIRED", label: "Expired" },
];

export const VISIBILITY_OPTIONS: { value: KnowledgeVisibility; label: string }[] = [
  { value: "CUSTOMER_SAFE", label: "Customer-safe" },
  { value: "INTERNAL", label: "Internal" },
  { value: "RESTRICTED", label: "Restricted" },
];

export function statusTone(status: KnowledgeStatus): "neutral" | "ok" | "warn" {
  if (status === "PUBLISHED") return "ok";
  if (status === "ARCHIVED" || status === "EXPIRED") return "warn";
  return "neutral";
}
