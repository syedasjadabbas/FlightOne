import dotenv from "dotenv";
dotenv.config();
process.env.ALLOW_SIMULATED_PAYMENT = "true";
const base = "http://localhost:8084/api/v1";
const suffix = Date.now();

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const { default: prisma } = await import("../config/prisma.js");
const email = `fo.m14.e2e.${suffix}@example.com`;
const reg = await api("/auth/register", {
  method: "POST",
  body: { email, password: "TestPass123!", name: "M14" },
});
const token = reg.json.data.accessToken;
const userId = reg.json.data.user.id;

const booking = await prisma.booking.create({
  data: {
    userId,
    product: "FLIGHT",
    status: "TICKETED",
    currency: "USD",
    amountMinor: 10000,
    netMinor: 9000,
    marginMinor: 1000,
    supplierCode: "GALILEO",
    fareRules: {
      refundable: true,
      penaltyBps: 1000,
      agencyFeeBps: 0,
      processingTimelineDays: 5,
      changeFeeMinor: 500,
      changeAllowed: true,
    },
  },
});
await prisma.payment.create({
  data: {
    userId,
    bookingId: booking.id,
    status: "CAPTURED",
    provider: "SIMULATED",
    currency: "USD",
    amountMinor: 10000,
    providerPaymentId: `sim_${booking.id}`,
    idempotencyKey: `e2e-${booking.id}`,
  },
});

const elig = await api(`/refunds/eligibility/${booking.id}`, { token });
const calc = await api("/refunds/calculate", {
  method: "POST",
  token,
  body: { bookingId: booking.id },
});
const c = await api("/refunds/cases", {
  method: "POST",
  token,
  body: {
    bookingId: booking.id,
    calculationId: calc.json.data.id,
    idempotencyKey: `e2e-case-${booking.id}`,
  },
});
const c2 = await api("/refunds/cases", {
  method: "POST",
  token,
  body: {
    bookingId: booking.id,
    calculationId: calc.json.data.id,
    idempotencyKey: `e2e-case-${booking.id}`,
  },
});
await api(`/refunds/cases/${c.json.data.id}/submit`, { method: "POST", token });
console.log("FLOW_A", {
  elig: elig.json.data.status,
  calc: calc.json.data.refundableMinor,
  dataStatus: calc.json.data.dataStatus,
  timeline: calc.json.data.processingTimelineStatus,
  dedupe: c2.json.data.deduplicated,
});

const ex = await api("/refunds/exchange/calculate", {
  method: "POST",
  token,
  body: { bookingId: booking.id, newFareMinor: 12000, kind: "REISSUE" },
});
const exReq = await api("/refunds/exchange/request", {
  method: "POST",
  token,
  body: { bookingId: booking.id, servicingRequestId: ex.json.data.id },
});
console.log("FLOW_C", {
  dataStatus: ex.json.data.dataStatus,
  executed: exReq.json.data.executed,
  status: exReq.json.data.status,
});

const b2 = await prisma.booking.create({
  data: {
    userId,
    product: "HOTEL",
    status: "RESERVED",
    currency: "USD",
    amountMinor: 20000,
    netMinor: 18000,
    marginMinor: 2000,
    supplierCode: "RATEHAWK",
    fareRules: {
      refundable: true,
      freeCancelUntil: new Date(Date.now() + 86400000 * 2).toISOString(),
      agencyFeeBps: 0,
    },
  },
});
const cancel = await api("/refunds/cancellation/request", {
  method: "POST",
  token,
  body: { bookingId: b2.id, reason: "e2e cancel" },
});
console.log("FLOW_B", {
  status: cancel.json.data.refundCase.status,
  dataStatus: cancel.json.data.calculation.dataStatus,
  refundable: cancel.json.data.calculation.refundableMinor,
});

const sched = await api("/refunds/schedule-change", {
  method: "POST",
  token,
  body: { bookingId: booking.id },
});
console.log("FLOW_D", {
  kind: sched.json.data.servicingRequest.kind,
  penalty: sched.json.data.calculation.supplierPenaltyMinor,
});

for (const p of ["/refunds", "/ops/refunds"]) {
  const r = await fetch(`http://localhost:3000${p}`);
  console.log("UI", p, r.status);
}

await prisma.$disconnect();
