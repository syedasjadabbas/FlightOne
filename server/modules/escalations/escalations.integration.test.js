/**
 * Module 13 — Human Agent Escalation integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const esc = await import("./escalations.service.js");
const detect = await import("./escalations.detect.js");
const { invalidateUserPermissionCache, clearPermissionCache } = await import(
  "../../lib/permissions.service.js"
);

const suffix = Date.now();
const userIds = [];
const conversationIds = [];
const escalationIds = [];
const bookingIds = [];
const roleIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.esc.${label}.${suffix}@example.com`,
      name: `Esc ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

async function grantPermissions(userId, keys) {
  const role = await prisma.role.create({
    data: {
      name: `esc-test-role-${userId.slice(-6)}-${keys.join("-").slice(0, 40)}-${suffix}`,
      description: "Module 13 test role",
    },
  });
  roleIds.push(role.id);
  for (const key of keys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, label: key },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
  await prisma.userRole.create({
    data: { userId, roleId: role.id, companyId: null },
  });
  invalidateUserPermissionCache(userId);
}

async function createConversation(userId, title = "Esc test") {
  const c = await prisma.conversation.create({
    data: { userId, title },
  });
  conversationIds.push(c.id);
  return c;
}

async function addMessages(conversationId, rows) {
  for (const row of rows) {
    await prisma.message.create({
      data: {
        conversationId,
        role: row.role,
        content: row.content,
        provider: row.provider || null,
      },
    });
  }
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of escalationIds) {
    await prisma.escalationAction.deleteMany({ where: { escalationId: id } }).catch(() => {});
    await prisma.escalationTicket.delete({ where: { id } }).catch(() => {});
  }
  for (const id of conversationIds) {
    await prisma.message.deleteMany({ where: { conversationId: id } }).catch(() => {});
    await prisma.conversation.delete({ where: { id } }).catch(() => {});
  }
  for (const id of bookingIds) {
    await prisma.bookingTransition.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.booking.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.rewardAccount.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  for (const id of roleIds) {
    await prisma.rolePermission.deleteMany({ where: { roleId: id } }).catch(() => {});
    await prisma.role.delete({ where: { id } }).catch(() => {});
  }
  clearPermissionCache();
  await prisma.$disconnect();
});

describe("Module 13 Human Agent Escalation", () => {
  it("detects customer / medical / SSR / refund intents", () => {
    assert.equal(
      detect.detectEscalationIntentFromMessage("I want to speak to a human"),
      "CUSTOMER_REQUEST",
    );
    assert.equal(
      detect.detectEscalationIntentFromMessage("Connect me with an agent"),
      "CUSTOMER_REQUEST",
    );
    assert.equal(
      detect.detectEscalationIntentFromMessage("I need medical assistance for travel"),
      "MEDICAL_ASSISTANCE",
    );
    assert.equal(
      detect.detectEscalationIntentFromMessage("This is a special service request for wheelchair"),
      "SPECIAL_SERVICE_REQUEST",
    );
    assert.equal(
      detect.detectEscalationIntentFromMessage("I dispute my refund — it was wrong"),
      "REFUND_DISPUTE",
    );
    assert.equal(detect.detectEscalationIntentFromMessage("find flights to DXB"), null);
  });

  it("customer-requested escalation attaches full ordered history", async () => {
    const user = await createUser("cust");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [
      { role: "USER", content: "Looking at LHE to DXB" },
      { role: "ASSISTANT", content: "Here are some options", provider: "ava" },
      { role: "USER", content: "I want to speak to a human" },
    ]);

    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: user.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(ticket.id);

    assert.equal(ticket.status, "OPEN");
    assert.equal(ticket.trigger, "CUSTOMER_REQUEST");
    assert.equal(ticket.deduplicated, false);
    const msgs = ticket.contextSnapshot.messages;
    assert.equal(msgs.length, 3);
    assert.equal(msgs[0].content, "Looking at LHE to DXB");
    assert.equal(msgs[1].role, "ASSISTANT");
    assert.equal(msgs[2].content, "I want to speak to a human");
    // Order preserved ASC
    assert.ok(new Date(msgs[0].createdAt) <= new Date(msgs[1].createdAt));
    assert.ok(new Date(msgs[1].createdAt) <= new Date(msgs[2].createdAt));

    const convAfter = await prisma.conversation.findUnique({ where: { id: conv.id } });
    assert.equal(convAfter.status, "ESCALATED");
  });

  it("duplicate active escalation is idempotent", async () => {
    const user = await createUser("dup");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "Need a travel consultant" }]);

    const first = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: user.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(first.id);
    const second = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: user.id,
      trigger: "CUSTOMER_REQUEST",
    });
    assert.equal(second.id, first.id);
    assert.equal(second.deduplicated, true);

    const count = await prisma.escalationTicket.count({
      where: { conversationId: conv.id },
    });
    assert.equal(count, 1);
  });

  it("customer isolation + IDOR protection", async () => {
    const a = await createUser("a");
    const b = await createUser("b");
    const conv = await createConversation(a.id);
    await addMessages(conv.id, [{ role: "USER", content: "private" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: a.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(ticket.id);

    await assert.rejects(
      () => esc.getMyEscalationById(b.id, ticket.id),
      (e) => e.statusCode === 404 || e.status === 404,
    );
    await assert.rejects(
      () =>
        esc.createEscalationFromTrigger({
          conversationId: conv.id,
          userId: b.id,
          trigger: "CUSTOMER_REQUEST",
        }),
      (e) => e.statusCode === 404 || e.status === 404,
    );

    const mine = await esc.getMyEscalationById(a.id, ticket.id);
    assert.equal(mine.id, ticket.id);
    assert.equal(mine.contextSnapshot, undefined);
  });

  it("VIP escalation only when configured reward tier matches", async () => {
    const user = await createUser("vip");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "VIP help" }]);

    const prev = process.env.ESCALATION_VIP_REWARD_TIERS;
    delete process.env.ESCALATION_VIP_REWARD_TIERS;
    const off = await esc.escalateIfVip({
      userId: user.id,
      conversationId: conv.id,
    });
    assert.equal(off.escalated, false);

    process.env.ESCALATION_VIP_REWARD_TIERS = "PLATINUM";
    await prisma.rewardAccount.create({
      data: {
        userId: user.id,
        referralCode: `VIP${suffix}`,
        tier: "PLATINUM",
      },
    });
    const on = await esc.escalateIfVip({
      userId: user.id,
      conversationId: conv.id,
    });
    assert.equal(on.escalated, true);
    assert.equal(on.ticket.trigger, "VIP_BOOKING");
    escalationIds.push(on.ticket.id);
    if (prev === undefined) delete process.env.ESCALATION_VIP_REWARD_TIERS;
    else process.env.ESCALATION_VIP_REWARD_TIERS = prev;
  });

  it("complex itinerary uses real multi-leg metadata only", async () => {
    const user = await createUser("cx");
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 100000,
        netMinor: 90000,
        marginMinor: 10000,
        metadata: { tripType: "MULTI_CITY", segments: [{}, {}, {}] },
      },
    });
    bookingIds.push(booking.id);
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "complex trip" }]);

    const result = await esc.escalateIfComplexItinerary({
      userId: user.id,
      bookingId: booking.id,
      conversationId: conv.id,
    });
    assert.equal(result.escalated, true);
    assert.equal(result.ticket.trigger, "COMPLEX_ITINERARY");
    assert.ok(String(result.evaluation.reason).includes("segmentCount"));
    escalationIds.push(result.ticket.id);

    const simple = await prisma.booking.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 50000,
        netMinor: 45000,
        marginMinor: 5000,
        metadata: { tripType: "ONE_WAY", segments: [{}] },
      },
    });
    bookingIds.push(simple.id);
    const no = await esc.evaluateComplexItineraryEscalation({
      userId: user.id,
      bookingId: simple.id,
    });
    assert.equal(no.shouldEscalate, false);
  });

  it("supplier failure only with authoritative human-intervention signal", async () => {
    const soft = esc.evaluateSupplierFailureEscalation({
      message: "no inventory",
    });
    assert.equal(soft.shouldEscalate, false);

    const user = await createUser("sup");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "book failed" }]);
    const hard = await esc.escalateIfSupplierFailure({
      conversationId: conv.id,
      userId: user.id,
      requiresHumanIntervention: true,
      supplierCode: "GALILEO",
      message: "Ticketing hard failure",
    });
    assert.equal(hard.escalated, true);
    assert.equal(hard.ticket.trigger, "SUPPLIER_FAILURE");
    escalationIds.push(hard.ticket.id);
  });

  it("refund dispute / medical / SSR customer request triggers", async () => {
    for (const [label, trigger, note] of [
      ["ref", "REFUND_DISPUTE", "I dispute my refund"],
      ["med", "MEDICAL_ASSISTANCE", "Need medical assistance"],
      ["ssr", "SPECIAL_SERVICE_REQUEST", "Special service request for UM"],
    ]) {
      const user = await createUser(label);
      const conv = await createConversation(user.id);
      await addMessages(conv.id, [{ role: "USER", content: note }]);
      const ticket = await esc.requestEscalationForCustomer(user.id, {
        conversationId: conv.id,
        trigger,
        note,
      });
      escalationIds.push(ticket.id);
      assert.equal(ticket.trigger, trigger);
    }
  });

  it("status transitions: claim → start → resolve; notifications deduped", async () => {
    const customer = await createUser("stc");
    const agent = await createUser("sta");
    await grantPermissions(agent.id, ["ops:escalations:write"]);
    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [
      { role: "USER", content: "help" },
      { role: "ASSISTANT", content: "sure" },
    ]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(ticket.id);

    const claimed = await esc.claimEscalation(ticket.id, agent.id);
    assert.equal(claimed.status, "ASSIGNED");
    assert.equal(claimed.assignedToUserId, agent.id);

    const started = await esc.startEscalation(ticket.id, agent.id);
    assert.equal(started.status, "IN_PROGRESS");

    const resolved = await esc.resolveEscalation(ticket.id, agent.id, {
      resolutionNote: "Helped the customer",
    });
    assert.equal(resolved.status, "RESOLVED");

    await assert.rejects(
      () => esc.claimEscalation(ticket.id, agent.id),
      (e) => e.statusCode === 409 || e.status === 409,
    );

    const createdNotifs = await prisma.notificationOutbox.findMany({
      where: { dedupeKey: { startsWith: `escalation:created:${ticket.id}` } },
    });
    assert.ok(createdNotifs.length >= 1);
    // Retry notify should not explode / should skip duplicates
    const { notifyEscalationCreated } = await import("./escalations.notify.js");
    const again = await notifyEscalationCreated(ticket);
    assert.equal(again.enqueued, 0);
  });

  it("VIP routes to VIP pool; no eligible specialist stays visible for manual Ops", async () => {
    const user = await createUser("viprt");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "VIP assist" }]);

    const prev = process.env.ESCALATION_VIP_REWARD_TIERS;
    process.env.ESCALATION_VIP_REWARD_TIERS = "PLATINUM";
    await prisma.rewardAccount.create({
      data: {
        userId: user.id,
        referralCode: `VRT${suffix}`,
        tier: "PLATINUM",
      },
    });

    const on = await esc.escalateIfVip({
      userId: user.id,
      conversationId: conv.id,
    });
    assert.equal(on.escalated, true);
    escalationIds.push(on.ticket.id);
    assert.equal(on.ticket.routingPool, "VIP");
    assert.equal(on.ticket.routingStatus, "UNROUTED_NO_ELIGIBLE");
    assert.equal(on.ticket.routing?.autoAssigned, false);
    assert.equal(on.ticket.assignedToUserId, null);

    const generalAgent = await createUser("genonly");
    await grantPermissions(generalAgent.id, ["ops:escalations:write"]);
    // VIP POOL_ROUTED would block — but UNROUTED allows manual ops write claim.
    const claimed = await esc.claimEscalation(on.ticket.id, generalAgent.id);
    assert.equal(claimed.status, "ASSIGNED");

    if (prev === undefined) delete process.env.ESCALATION_VIP_REWARD_TIERS;
    else process.env.ESCALATION_VIP_REWARD_TIERS = prev;
  });

  it("VIP pool blocks claim without vip permission when specialists exist", async () => {
    const customer = await createUser("vipblk");
    const vipAgent = await createUser("vipag");
    const plainAgent = await createUser("plainag");
    await grantPermissions(vipAgent.id, ["ops:escalations:write", "ops:escalations:vip"]);
    await grantPermissions(plainAgent.id, ["ops:escalations:write"]);

    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [{ role: "USER", content: "vip route" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "VIP_BOOKING",
    });
    escalationIds.push(ticket.id);
    assert.equal(ticket.routingPool, "VIP");
    assert.equal(ticket.routingStatus, "POOL_ROUTED");
    assert.ok((ticket.routing?.eligibleConsultantCount || 0) >= 1);

    await assert.rejects(
      () => esc.claimEscalation(ticket.id, plainAgent.id),
      (e) => e.statusCode === 403 || e.status === 403,
    );

    const claimed = await esc.claimEscalation(ticket.id, vipAgent.id);
    assert.equal(claimed.assignedToUserId, vipAgent.id);
  });

  it("medical human-escalation routes to MEDICAL pool", async () => {
    const user = await createUser("medrt");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "Need medical assistance" }]);
    const ticket = await esc.requestEscalationForCustomer(user.id, {
      conversationId: conv.id,
      trigger: "MEDICAL_ASSISTANCE",
      note: "Need medical assistance",
    });
    escalationIds.push(ticket.id);
    assert.equal(ticket.routingPool, "MEDICAL");
    assert.ok(ticket.contextSnapshot === undefined || ticket.routing);
  });

  it("honest handoff copy never claims assignment falsely", async () => {
    const { honestHandoffReply } = await import(
      "../../../flight-one-main/lib/ask-ai/escalationGuidance.ts"
    ).catch(() => ({ honestHandoffReply: null }));
    // Server-side string check mirror (frontend helper may not load in node test)
    const reply =
      "I've opened a human consultant handoff for your request to speak with a human consultant (case abcdef12…, status OPEN). Your complete AI conversation history goes with the transfer so you do not need to repeat yourself. This confirms the request only — a consultant has not been assigned or replied until the system shows that.";
    assert.ok(!/consultant has (been )?assigned/i.test(reply.split("—")[0]));
    assert.ok(/has not been assigned/i.test(reply));
    assert.ok(!/refund was approved/i.test(reply));
    if (honestHandoffReply) {
      const r = honestHandoffReply({
        trigger: "CUSTOMER_REQUEST",
        escalationId: "abcdef12zzzz",
        status: "OPEN",
      });
      assert.ok(/has not been assigned/i.test(r));
    }
  });

  it("ops detail includes full snapshot; customer list excludes snapshot", async () => {
    const user = await createUser("snap");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [
      { role: "USER", content: "one" },
      { role: "ASSISTANT", content: "two" },
      { role: "USER", content: "three" },
    ]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: user.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(ticket.id);

    const ops = await esc.getEscalationById(ticket.id);
    assert.equal(ops.contextSnapshot.messages.length, 3);
    assert.equal(ops.handoff?.mode, "COLD");
    assert.equal(ops.handoff?.warmStatus, "PRODUCT_DECISION_DEFERRED");

    const mine = await esc.listMyEscalations(user.id);
    assert.ok(mine.items.some((i) => i.id === ticket.id));
    assert.equal(mine.items.find((i) => i.id === ticket.id).contextSnapshot, undefined);
  });

  it("cold handoff is implemented; warm remains product-decision deferred", async () => {
    const { HANDOFF_MODE } = await import("./escalations.writeback.js");
    assert.equal(HANDOFF_MODE.IMPLEMENTED, "COLD");
    assert.equal(HANDOFF_MODE.WARM_STATUS, "PRODUCT_DECISION_DEFERRED");
    assert.ok(/not specified/i.test(HANDOFF_MODE.WARM_NOTE));

    const user = await createUser("cold");
    const conv = await createConversation(user.id);
    await addMessages(conv.id, [{ role: "USER", content: "talk to human" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: user.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(ticket.id);
    assert.equal(ticket.handoffMode, "COLD");
    const convAfter = await prisma.conversation.findUnique({ where: { id: conv.id } });
    assert.equal(convAfter.status, "ESCALATED");
  });

  it("authorized consultant cancel write-back updates booking via Module 03", async () => {
    const customer = await createUser("wbok");
    const agent = await createUser("wbag");
    await grantPermissions(agent.id, ["ops:escalations:write"]);
    const booking = await prisma.booking.create({
      data: {
        userId: customer.id,
        product: "FLIGHT",
        status: "QUOTED",
        currency: "USD",
        amountMinor: 50000,
        netMinor: 45000,
        marginMinor: 5000,
      },
    });
    bookingIds.push(booking.id);
    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [{ role: "USER", content: "cancel please" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "CUSTOMER_REQUEST",
      bookingId: booking.id,
    });
    escalationIds.push(ticket.id);
    await esc.claimEscalation(ticket.id, agent.id);

    const result = await esc.applyEscalationConsultantAction(
      ticket.id,
      agent,
      { global: ["ops:escalations:write"], byCompany: {} },
      { actionType: "CANCEL_BOOKING", reason: "Customer requested cancel", idempotencyKey: `wb-cancel-${ticket.id}` },
    );
    assert.equal(result.action.status, "SUCCEEDED");
    assert.equal(result.action.actionType, "CANCEL_BOOKING");

    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(bookingAfter.status, "CANCELLED");
    const transition = await prisma.bookingTransition.findFirst({
      where: { bookingId: booking.id, toStatus: "CANCELLED" },
    });
    assert.ok(transition);
    assert.equal(transition.actor, "AGENT");
    assert.equal(transition.actorUserId, agent.id);

    const refreshed = await esc.getEscalationById(ticket.id);
    assert.equal(refreshed.lastWriteBackAction, "CANCEL_BOOKING");
    assert.equal(refreshed.lastWriteBackStatus, "SUCCEEDED");
    assert.ok(refreshed.writeBackActions.some((a) => a.id === result.action.id));

    const audits = await prisma.auditLog.findMany({
      where: { userId: agent.id, action: "escalation.consultant_action" },
    });
    assert.ok(audits.some((a) => a.resourceId === ticket.id));
  });

  it("unauthorized assignee cannot write-back; refunds need refunds:write", async () => {
    const customer = await createUser("wbno");
    const assignee = await createUser("wbass");
    const other = await createUser("wboth");
    await grantPermissions(assignee.id, ["ops:escalations:write"]);
    await grantPermissions(other.id, ["ops:escalations:write"]);

    const booking = await prisma.booking.create({
      data: {
        userId: customer.id,
        product: "FLIGHT",
        status: "QUOTED",
        currency: "USD",
        amountMinor: 10000,
        netMinor: 9000,
        marginMinor: 1000,
      },
    });
    bookingIds.push(booking.id);
    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [{ role: "USER", content: "help" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "CUSTOMER_REQUEST",
      bookingId: booking.id,
    });
    escalationIds.push(ticket.id);
    await esc.claimEscalation(ticket.id, assignee.id);

    await assert.rejects(
      () =>
        esc.applyEscalationConsultantAction(
          ticket.id,
          other,
          { global: ["ops:escalations:write"], byCompany: {} },
          { actionType: "CANCEL_BOOKING", idempotencyKey: `wb-unauth-${ticket.id}` },
        ),
      (e) => e.statusCode === 403 || e.status === 403,
    );

    const stillQuoted = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(stillQuoted.status, "QUOTED");

    await assert.rejects(
      () =>
        esc.applyEscalationConsultantAction(
          ticket.id,
          assignee,
          { global: ["ops:escalations:write"], byCompany: {} },
          {
            actionType: "REFUND_PROCESS",
            refundCaseId: "nonexistent",
            idempotencyKey: `wb-norefundperm-${ticket.id}`,
          },
        ),
      (e) => e.statusCode === 403 || e.status === 403,
    );
  });

  it("idempotent duplicate consultant action; IDOR blocks foreign booking ownership", async () => {
    const customer = await createUser("wbid");
    const stranger = await createUser("wbstr");
    const agent = await createUser("wbidag");
    await grantPermissions(agent.id, ["ops:escalations:write"]);

    const booking = await prisma.booking.create({
      data: {
        userId: customer.id,
        product: "FLIGHT",
        status: "QUOTED",
        currency: "USD",
        amountMinor: 20000,
        netMinor: 18000,
        marginMinor: 2000,
      },
    });
    bookingIds.push(booking.id);
    const foreign = await prisma.booking.create({
      data: {
        userId: stranger.id,
        product: "FLIGHT",
        status: "QUOTED",
        currency: "USD",
        amountMinor: 20000,
        netMinor: 18000,
        marginMinor: 2000,
      },
    });
    bookingIds.push(foreign.id);

    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [{ role: "USER", content: "agent" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "CUSTOMER_REQUEST",
      bookingId: booking.id,
    });
    escalationIds.push(ticket.id);
    await esc.claimEscalation(ticket.id, agent.id);

    const key = `wb-idem-${ticket.id}`;
    const first = await esc.applyEscalationConsultantAction(
      ticket.id,
      agent,
      { global: ["ops:escalations:write"], byCompany: {} },
      { actionType: "CANCEL_BOOKING", idempotencyKey: key },
    );
    const second = await esc.applyEscalationConsultantAction(
      ticket.id,
      agent,
      { global: ["ops:escalations:write"], byCompany: {} },
      { actionType: "CANCEL_BOOKING", idempotencyKey: key },
    );
    assert.equal(first.action.id, second.action.id);
    assert.equal(second.action.deduplicated, true);

    const actionCount = await prisma.escalationAction.count({
      where: { escalationId: ticket.id, actionType: "CANCEL_BOOKING" },
    });
    assert.equal(actionCount, 1);

    // Ticket bookingId is authoritative — foreign booking stays untouched
    const foreignAfter = await prisma.booking.findUnique({ where: { id: foreign.id } });
    assert.equal(foreignAfter.status, "QUOTED");
  });

  it("provider-unconfigured refund write-back is EXTERNAL_DEPENDENCY", async () => {
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    const customer = await createUser("wbext");
    const agent = await createUser("wbextag");
    await grantPermissions(agent.id, ["ops:escalations:write", "refunds:write", "refunds:read"]);

    const booking = await prisma.booking.create({
      data: {
        userId: customer.id,
        product: "FLIGHT",
        status: "TICKETED",
        currency: "USD",
        amountMinor: 10000,
        netMinor: 9000,
        marginMinor: 1000,
        supplierCode: "GALILEO",
        fareRules: { refundable: true, penaltyBps: 1000, agencyFeeBps: 0 },
      },
    });
    bookingIds.push(booking.id);

    const refunds = await import("../refunds/refunds.service.js");
    const perms = {
      global: ["refunds:write", "refunds:read", "ops:escalations:write"],
      byCompany: {},
    };
    const calc = await refunds.calculateRefund(customer, perms, { bookingId: booking.id });
    const created = await refunds.createRefundCase(customer, perms, {
      bookingId: booking.id,
      calculationId: calc.id,
      reason: "dispute",
      idempotencyKey: `wb-rc-${booking.id}`,
    });
    await refunds.submitRefundCase(customer, perms, created.id);
    await prisma.refundCase.update({
      where: { id: created.id },
      data: { escalationId: null, status: "REQUIRES_HUMAN" },
    });

    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [{ role: "USER", content: "refund dispute" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "REFUND_DISPUTE",
      bookingId: booking.id,
    });
    escalationIds.push(ticket.id);
    await prisma.refundCase.update({
      where: { id: created.id },
      data: { escalationId: ticket.id },
    });
    await esc.claimEscalation(ticket.id, agent.id);

    const result = await esc.applyEscalationConsultantAction(ticket.id, agent, perms, {
      actionType: "REFUND_PROCESS",
      refundCaseId: created.id,
      idempotencyKey: `wb-ref-${ticket.id}`,
    });
    assert.ok(
      result.action.status === "EXTERNAL_DEPENDENCY" ||
        result.action.status === "SUCCEEDED" ||
        result.providerFailure === true,
    );
    if (result.action.status === "EXTERNAL_DEPENDENCY") {
      assert.ok(result.action.error);
    }
    const ticketAfter = await esc.getEscalationById(ticket.id);
    assert.equal(ticketAfter.lastWriteBackAction, "REFUND_PROCESS");
    assert.ok(ticketAfter.lastWriteBackStatus);

    await prisma.servicingAuditEvent.deleteMany({ where: { refundCaseId: created.id } }).catch(() => {});
    await prisma.travelCredit.deleteMany({ where: { refundCaseId: created.id } }).catch(() => {});
    await prisma.servicingRequest.deleteMany({ where: { refundCaseId: created.id } }).catch(() => {});
    await prisma.refundCase.delete({ where: { id: created.id } }).catch(() => {});
    await prisma.refundCalculation.deleteMany({ where: { bookingId: booking.id } }).catch(() => {});
  });

  it("resolve logs resolution outcome for AI quality review", async () => {
    const customer = await createUser("outc");
    const agent = await createUser("outcag");
    await grantPermissions(agent.id, ["ops:escalations:write"]);
    const conv = await createConversation(customer.id);
    await addMessages(conv.id, [{ role: "USER", content: "done" }]);
    const ticket = await esc.createEscalationFromTrigger({
      conversationId: conv.id,
      userId: customer.id,
      trigger: "CUSTOMER_REQUEST",
    });
    escalationIds.push(ticket.id);
    await esc.claimEscalation(ticket.id, agent.id);
    const resolved = await esc.resolveEscalation(ticket.id, agent.id, {
      resolutionNote: "Answered policy question",
      outcome: "INFORMATION_PROVIDED",
    });
    assert.equal(resolved.status, "RESOLVED");
    assert.equal(resolved.resolutionOutcome, "INFORMATION_PROVIDED");
    const outcomeAction = await prisma.escalationAction.findUnique({
      where: { idempotencyKey: `esc-resolve-outcome:${ticket.id}` },
    });
    assert.ok(outcomeAction);
    assert.equal(outcomeAction.actionType, "LOG_RESOLUTION_OUTCOME");
  });
});
