/**
 * Module 02 — OCR review helpers (pure).
 * Classifies provider outcomes honestly and plans confirm/save against
 * existing `/ocr` + `/ocr/apply` + PATCH document APIs.
 */

export const OCR_APPLY_FIELD_KEYS = [
  "documentNumber",
  "countryCode",
  "documentSubtype",
  "issuedAt",
  "expiresAt",
] as const;

export type OcrApplyFieldKey = (typeof OCR_APPLY_FIELD_KEYS)[number];

export type OcrIdentityFields = {
  documentNumber?: string;
  countryCode?: string;
  documentSubtype?: string;
  issuedAt?: string;
  expiresAt?: string;
  fullName?: string;
  nationality?: string;
};

export type OcrExtractionResult = {
  provider: string;
  fields: OcrIdentityFields;
  confidence: number | null;
  warnings: string[];
  rawTextEcho: string | null;
};

export type OcrUiStatus =
  | "idle"
  | "processing"
  | "success"
  | "empty"
  | "unconfigured"
  | "failure";

const UNCONFIGURED_WARNINGS = new Set([
  "ocr_provider_unconfigured",
  "ocr_http_url_not_configured",
  "unknown_ocr_provider",
]);

function warningLooksUnconfigured(w: string): boolean {
  if (UNCONFIGURED_WARNINGS.has(w)) return true;
  if (w.startsWith("unknown_ocr_provider:")) return true;
  return false;
}

function warningLooksFailure(w: string): boolean {
  return (
    w.startsWith("ocr_http_status_") ||
    w.startsWith("ocr_http_error") ||
    w === "ocr_http_fetch_unavailable" ||
    w === "ocr_http_invalid_json"
  );
}

export function hasExtractedApplyFields(fields: OcrIdentityFields | null | undefined): boolean {
  if (!fields) return false;
  return OCR_APPLY_FIELD_KEYS.some((k) => {
    const v = fields[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/**
 * Honest UI status from OCR API error and/or extraction payload.
 * Never treats unconfigured/empty as a successful field extraction.
 */
export function classifyOcrOutcome(args: {
  processing?: boolean;
  apiError?: boolean;
  extraction?: OcrExtractionResult | null;
}): OcrUiStatus {
  if (args.processing) return "processing";
  if (args.apiError) return "failure";
  const extraction = args.extraction;
  if (!extraction) return "idle";

  const warnings = Array.isArray(extraction.warnings) ? extraction.warnings : [];
  if (
    extraction.provider === "unconfigured" ||
    warnings.some(warningLooksUnconfigured)
  ) {
    return "unconfigured";
  }
  if (warnings.some(warningLooksFailure)) {
    return "failure";
  }
  if (hasExtractedApplyFields(extraction.fields)) {
    return "success";
  }
  return "empty";
}

export function ocrStatusMessage(status: OcrUiStatus): string {
  switch (status) {
    case "processing":
      return "Scanning your document for details…";
    case "success":
      return "Document scanned. Please review the details below and confirm.";
    case "empty":
      return "Could not automatically read details from this file. Please enter them manually below.";
    case "unconfigured":
      return "Automatic scanning is unavailable for this file. Please enter your details below.";
    case "failure":
      return "Could not read the document clearly. Please enter details manually or upload a clearer scan.";
    default:
      return "Upload a document to automatically fill in your details.";
  }
}

export type EditableOcrFields = {
  documentNumber: string;
  countryCode: string;
  documentSubtype: string;
  issuedAt: string;
  expiresAt: string;
};

export function emptyEditableFields(): EditableOcrFields {
  return {
    documentNumber: "",
    countryCode: "",
    documentSubtype: "",
    issuedAt: "",
    expiresAt: "",
  };
}

export function editableFieldsFromExtraction(
  fields: OcrIdentityFields | null | undefined,
): EditableOcrFields {
  const base = emptyEditableFields();
  if (!fields) return base;
  return {
    documentNumber: fields.documentNumber?.trim() || "",
    countryCode: fields.countryCode?.trim().toUpperCase() || "",
    documentSubtype: fields.documentSubtype?.trim() || "",
    issuedAt: fields.issuedAt?.trim().slice(0, 10) || "",
    expiresAt: fields.expiresAt?.trim().slice(0, 10) || "",
  };
}

function norm(value: string): string {
  return value.trim();
}

/**
 * Decide how to persist user-confirmed fields using existing backend endpoints.
 * - Unchanged OCR values → POST /ocr/apply (acceptedFields)
 * - Corrected / manually entered values → PATCH /documents/:id
 */
export function buildOcrConfirmPlan(
  edited: EditableOcrFields,
  extraction: OcrExtractionResult | null | undefined,
): {
  acceptedFields: OcrApplyFieldKey[];
  patch: Partial<{
    documentNumber: string;
    countryCode: string;
    documentSubtype: string;
    issuedAt: string;
    expiresAt: string;
  }>;
  canConfirm: boolean;
} {
  const extract = extraction?.fields ?? {};
  const acceptedFields: OcrApplyFieldKey[] = [];
  const patch: Partial<{
    documentNumber: string;
    countryCode: string;
    documentSubtype: string;
    issuedAt: string;
    expiresAt: string;
  }> = {};

  for (const key of OCR_APPLY_FIELD_KEYS) {
    const editedVal = norm(edited[key] ?? "");
    if (!editedVal) continue;
    const extractedVal = norm(String(extract[key] ?? ""));
    if (extractedVal && editedVal === extractedVal) {
      acceptedFields.push(key);
    } else {
      if (key === "countryCode") {
        if (editedVal.length === 2) patch.countryCode = editedVal.toUpperCase();
      } else if (key === "documentNumber") {
        if (editedVal.length >= 3) patch.documentNumber = editedVal;
      } else {
        patch[key] = editedVal;
      }
    }
  }

  return {
    acceptedFields,
    patch,
    canConfirm: acceptedFields.length > 0 || Object.keys(patch).length > 0,
  };
}

export function isIdentityVaultType(
  type: string,
): type is "PASSPORT" | "NATIONAL_ID" | "VISA" | "RESIDENCE_PERMIT" {
  return (
    type === "PASSPORT" ||
    type === "NATIONAL_ID" ||
    type === "VISA" ||
    type === "RESIDENCE_PERMIT"
  );
}
