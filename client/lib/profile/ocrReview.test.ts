/**
 * Module 02 OCR review honesty + confirm planning tests.
 */
import { describe, expect, it } from "vitest";
import {
  buildOcrConfirmPlan,
  classifyOcrOutcome,
  editableFieldsFromExtraction,
  emptyEditableFields,
  hasExtractedApplyFields,
  ocrStatusMessage,
  type OcrExtractionResult,
} from "./ocrReview";

function extraction(
  overrides: Partial<OcrExtractionResult> & {
    fields?: OcrExtractionResult["fields"];
  } = {},
): OcrExtractionResult {
  return {
    provider: "http",
    fields: {},
    confidence: null,
    warnings: [],
    rawTextEcho: null,
    ...overrides,
  };
}

describe("classifyOcrOutcome", () => {
  it("reports processing while request is in flight", () => {
    expect(classifyOcrOutcome({ processing: true })).toBe("processing");
    expect(ocrStatusMessage("processing")).toMatch(/Scanning your document/i);
  });

  it("reports failure when the API call fails — never success", () => {
    expect(classifyOcrOutcome({ apiError: true })).toBe("failure");
    expect(ocrStatusMessage("failure")).toMatch(/Could not read the document/i);
    expect(ocrStatusMessage("failure")).not.toMatch(/extracted fields for review/i);
  });

  it("reports unconfigured when provider warns or is unconfigured", () => {
    expect(
      classifyOcrOutcome({
        extraction: extraction({
          provider: "unconfigured",
          warnings: ["ocr_provider_unconfigured"],
        }),
      }),
    ).toBe("unconfigured");
    expect(
      classifyOcrOutcome({
        extraction: extraction({
          provider: "http",
          warnings: ["ocr_http_url_not_configured"],
        }),
      }),
    ).toBe("unconfigured");
    expect(ocrStatusMessage("unconfigured")).toMatch(/Automatic scanning is unavailable/i);
    expect(ocrStatusMessage("unconfigured")).not.toMatch(/extracted fields for review/i);
  });

  it("reports failure for HTTP provider error warnings", () => {
    expect(
      classifyOcrOutcome({
        extraction: extraction({
          warnings: ["ocr_http_status_503"],
        }),
      }),
    ).toBe("failure");
  });

  it("reports success only when real apply fields were extracted", () => {
    expect(
      classifyOcrOutcome({
        extraction: extraction({
          fields: { documentNumber: "AB1234567", countryCode: "PK" },
          confidence: 0.9,
        }),
      }),
    ).toBe("success");
    expect(hasExtractedApplyFields({ fullName: "ONLY NAME" })).toBe(false);
    expect(
      classifyOcrOutcome({
        extraction: extraction({ fields: { fullName: "ONLY NAME" } }),
      }),
    ).toBe("empty");
  });

  it("reports empty when configured OCR returns no identity fields", () => {
    expect(
      classifyOcrOutcome({
        extraction: extraction({ provider: "http", fields: {}, warnings: [] }),
      }),
    ).toBe("empty");
  });
});

describe("editableFieldsFromExtraction + confirm plan", () => {
  it("pre-fills editable fields from extraction for review", () => {
    const edited = editableFieldsFromExtraction({
      documentNumber: "X999",
      countryCode: "ae",
      issuedAt: "2020-01-15T00:00:00.000Z",
      expiresAt: "2030-01-15",
    });
    expect(edited.documentNumber).toBe("X999");
    expect(edited.countryCode).toBe("AE");
    expect(edited.issuedAt).toBe("2020-01-15");
    expect(edited.expiresAt).toBe("2030-01-15");
  });

  it("plans apply for unchanged OCR fields", () => {
    const extract = extraction({
      fields: { documentNumber: "P123", countryCode: "PK", expiresAt: "2031-06-01" },
    });
    const plan = buildOcrConfirmPlan(
      editableFieldsFromExtraction(extract.fields),
      extract,
    );
    expect(plan.canConfirm).toBe(true);
    expect(plan.acceptedFields).toEqual(
      expect.arrayContaining(["documentNumber", "countryCode", "expiresAt"]),
    );
    expect(plan.patch).toEqual({});
  });

  it("plans PATCH for manually corrected fields", () => {
    const extract = extraction({
      fields: { documentNumber: "P123", countryCode: "PK" },
    });
    const edited = {
      ...editableFieldsFromExtraction(extract.fields),
      documentNumber: "P999CORRECTED",
      countryCode: "PK",
    };
    const plan = buildOcrConfirmPlan(edited, extract);
    expect(plan.acceptedFields).toEqual(["countryCode"]);
    expect(plan.patch).toEqual({ documentNumber: "P999CORRECTED" });
    expect(plan.canConfirm).toBe(true);
  });

  it("plans PATCH-only when OCR was unconfigured / empty", () => {
    const extract = extraction({
      provider: "unconfigured",
      warnings: ["ocr_provider_unconfigured"],
      fields: {},
    });
    const edited = {
      ...emptyEditableFields(),
      documentNumber: "MANUAL123",
      countryCode: "PK",
    };
    const plan = buildOcrConfirmPlan(edited, extract);
    expect(plan.acceptedFields).toEqual([]);
    expect(plan.patch).toEqual({
      documentNumber: "MANUAL123",
      countryCode: "PK",
    });
  });

  it("cannot confirm with blank review form", () => {
    const plan = buildOcrConfirmPlan(emptyEditableFields(), extraction());
    expect(plan.canConfirm).toBe(false);
  });
});
