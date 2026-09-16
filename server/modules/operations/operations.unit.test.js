/**
 * Module 15 — Operations Platform unit tests (no DB).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

describe("Module 15 Operations unit", () => {
  const prev = {};

  before(() => {
    for (const k of [
      "OPS_CRM_BASE_URL",
      "OPS_CRM_API_KEY",
      "OPS_MIDOFFICE_BASE_URL",
      "OPS_MIDOFFICE_API_KEY",
      "OPS_BACKOFFICE_BASE_URL",
      "OPS_BACKOFFICE_API_KEY",
      "OPS_ACCOUNTING_BASE_URL",
      "OPS_ACCOUNTING_API_KEY",
      "OPS_COMMISSION_BPS",
    ]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("CRM adapter reports UNCONFIGURED without credentials", async () => {
    const { getCrmCapability, pushCrmEvent } = await import(
      "./integrations/crm/crm.adapter.js"
    );
    const cap = getCrmCapability();
    assert.equal(cap.state, "UNCONFIGURED");
    assert.equal(cap.configured, false);
    const push = await pushCrmEvent({
      id: "evt1",
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: "b1",
      payload: {},
      createdAt: new Date(),
    });
    assert.equal(push.status, "SKIPPED_UNCONFIGURED");
  });

  it("mid/back/accounting adapters fail closed when unconfigured", async () => {
    const mid = await import("./integrations/midoffice/midoffice.adapter.js");
    const back = await import("./integrations/backoffice/backoffice.adapter.js");
    const acct = await import("./integrations/accounting/accounting.adapter.js");
    assert.equal(mid.getMidOfficeCapability().state, "UNCONFIGURED");
    assert.equal(back.getBackOfficeCapability().state, "UNCONFIGURED");
    assert.equal(acct.getAccountingCapability().state, "UNCONFIGURED");
    const evt = { id: "e", type: "BOOKING_CREATED", aggregateType: "Booking", aggregateId: "b", payload: {} };
    assert.equal((await mid.pushMidOfficeEvent(evt)).status, "SKIPPED_UNCONFIGURED");
    assert.equal((await back.pushBackOfficeEvent(evt)).status, "SKIPPED_UNCONFIGURED");
    assert.equal((await acct.pushAccountingEvent(evt)).status, "SKIPPED_UNCONFIGURED");
  });

  it("finance capability is internal/verified", async () => {
    const { getFinanceCapability } = await import("./integrations/finance/finance.service.js");
    const cap = getFinanceCapability();
    assert.equal(cap.configured, true);
    assert.equal(cap.state, "VERIFIED");
  });

  it("reconciliation capability is internal", async () => {
    const { getReconciliationCapability } = await import(
      "./integrations/reconciliation/reconciliation.service.js"
    );
    const cap = getReconciliationCapability();
    assert.equal(cap.configured, true);
  });
});
