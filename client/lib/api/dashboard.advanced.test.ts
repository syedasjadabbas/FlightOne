import { describe, expect, it } from "vitest";
import { dashboardApi } from "@/lib/api/dashboard.api";

describe("dashboard advanced API", () => {
  it("registers overview and advanced analytics endpoints", () => {
    expect(Object.keys(dashboardApi.endpoints)).toEqual(
      expect.arrayContaining(["getDashboardOverview", "getAdvancedAnalytics"]),
    );
  });
});
