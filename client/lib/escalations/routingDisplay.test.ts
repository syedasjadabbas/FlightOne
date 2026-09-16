import { describe, expect, it } from "vitest";
import {
  customerRoutingStatusMessage,
  formatOpsRoutingLabel,
} from "./routingDisplay";

describe("Module 13 routing display copy", () => {
  it("never claims assignment without assignedToUserId", () => {
    const msg = customerRoutingStatusMessage({
      status: "OPEN",
      assignedToUserId: null,
      routing: {
        pool: "VIP",
        status: "POOL_ROUTED",
        eligibleConsultantCount: 2,
        availabilityClaimed: false,
        autoAssigned: false,
      },
    });
    expect(msg).toMatch(/specialist queue/i);
    expect(msg).not.toMatch(/has been assigned/i);
    expect(msg).not.toMatch(/available now/i);
  });

  it("explains unrouted / no eligible consultant honestly", () => {
    const msg = customerRoutingStatusMessage({
      status: "OPEN",
      routing: { pool: "VIP", status: "UNROUTED_NO_ELIGIBLE", eligibleConsultantCount: 0 },
    });
    expect(msg).toMatch(/manual handling/i);
    expect(msg).not.toMatch(/consultant has been assigned/i);
  });

  it("shows assignment only when assignedToUserId is set", () => {
    expect(
      customerRoutingStatusMessage({
        status: "ASSIGNED",
        assignedToUserId: "u1",
        routing: { pool: "GENERAL", status: "POOL_ROUTED" },
      }),
    ).toMatch(/has been assigned/i);
  });

  it("formats ops routing label without inventing SLA", () => {
    expect(
      formatOpsRoutingLabel({
        pool: "MEDICAL",
        status: "POOL_ROUTED",
        eligibleConsultantCount: 1,
      }),
    ).toBe("MEDICAL · POOL_ROUTED · eligible 1");
    expect(formatOpsRoutingLabel(null)).toBeNull();
  });
});
