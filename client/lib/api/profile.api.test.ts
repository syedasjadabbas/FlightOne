/**
 * Profile API client privacy / OCR endpoint contracts (no network).
 */
import { describe, expect, it } from "vitest";
import { PROFILE_DOCUMENT_LIST_PARAMS, profileApi } from "@/lib/api/profile.api";

describe("profile API document privacy", () => {
  it("listDocuments never requests decrypted numbers by default", () => {
    expect(PROFILE_DOCUMENT_LIST_PARAMS.includeNumber).toBe("false");
  });
});

describe("profile API OCR endpoints", () => {
  it("registers runDocumentOcr and applyDocumentOcr against Module 02 routes", () => {
    const endpoints = profileApi.endpoints;
    expect(endpoints.runDocumentOcr).toBeDefined();
    expect(endpoints.applyDocumentOcr).toBeDefined();
    expect(endpoints.updateDocument).toBeDefined();

    const runDef = endpoints.runDocumentOcr as unknown as {
      initiate: unknown;
    };
    const applyDef = endpoints.applyDocumentOcr as unknown as {
      initiate: unknown;
    };
    expect(typeof runDef.initiate).toBe("function");
    expect(typeof applyDef.initiate).toBe("function");
  });
});
