import type { VisaCategory } from "@/lib/api/visa.api";

export const POPULAR_DESTINATIONS = [
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "TR", label: "Turkey" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "DE", label: "Germany / Schengen" },
  { code: "TH", label: "Thailand" },
  { code: "MY", label: "Malaysia" },
  { code: "SG", label: "Singapore" },
  { code: "QA", label: "Qatar" },
  { code: "CA", label: "Canada" },
  { code: "CN", label: "China" },
] as const;

export const POPULAR_NATIONALITIES = [
  { code: "PK", label: "Pakistan" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
] as const;

export const PURPOSE_OPTIONS = [
  { value: "tourism", label: "Tourism & leisure" },
  { value: "business", label: "Business & corporate" },
  { value: "transit", label: "Airport transit" },
  { value: "mice", label: "Conference & MICE" },
  { value: "family", label: "Family visit" },
  { value: "employment", label: "Work / employment" },
  { value: "study", label: "Study" },
  { value: "umrah", label: "Umrah / pilgrimage" },
] as const;

export type ChipTone = "default" | "warn" | "muted";

export function categoryLabel(category?: VisaCategory | string | null): string {
  switch (category) {
    case "VISA_FREE":
      return "Visa free";
    case "VOA":
      return "Visa on arrival";
    case "E_VISA":
      return "Electronic visa";
    case "EMBASSY":
      return "Embassy visa required";
    default:
      return "Verification required";
  }
}

export function categoryTone(category?: VisaCategory | string | null): ChipTone {
  switch (category) {
    case "EMBASSY":
      return "warn";
    case "VISA_FREE":
    case "VOA":
    case "E_VISA":
      return "default";
    default:
      return "muted";
  }
}

export function formatEmbassyKey(key: string): string {
  return key
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
