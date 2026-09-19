import { describe, expect, it } from "vitest";
import { vaultApi } from "@/lib/api/vault.api";

describe("vault.api", () => {
  it("registers vault endpoints on baseApi", () => {
    const endpoints = Object.keys(vaultApi.endpoints);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "getVaultCapability",
        "listVaultDocuments",
        "uploadVaultDocument",
        "updateVaultDocument",
        "replaceVaultDocument",
        "deleteVaultDocument",
        "shareVaultDocument",
      ]),
    );
  });
});
