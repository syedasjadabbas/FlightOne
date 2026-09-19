import { describe, expect, it } from "vitest";
import { corporateApi } from "@/lib/api/corporate.api";

describe("corporate P3-03 API", () => {
  it("registers portal, expense, and carbon endpoints", () => {
    const endpoints = Object.keys(corporateApi.endpoints);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "getCompanyPortal",
        "updateCompanyBranding",
        "configureCompanyDomain",
        "listExpenses",
        "createExpense",
        "exportExpenses",
        "getCarbonDashboard",
        "getCarbonNudges",
        "getCompanyAnalytics",
      ]),
    );
  });
});
