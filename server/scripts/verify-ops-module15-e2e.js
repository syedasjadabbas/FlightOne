/**
 * One-shot Module 15 E2E verification (Flows A/C/D).
 */
import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import * as ops from "../modules/operations/operations.service.js";

const email = `fo.ops.e2e.${Date.now()}@example.com`;
const user = await prisma.user.create({
  data: { email, name: "Ops E2E", passwordHash: await bcrypt.hash("TestPass123!", 10) },
});
const role = await prisma.role.findFirst({ where: { name: "Super Admin" } });
if (role) {
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } }).catch(() => {});
}
const booking = await prisma.booking.create({
  data: {
    userId: user.id,
    product: "FLIGHT",
    status: "TICKETED",
    currency: "USD",
    amountMinor: 12000,
    netMinor: 10000,
    marginMinor: 2000,
    supplierCode: "GALILEO",
    externalRef: "E2E-PNR",
    metadata: {},
  },
});
const evt = await ops.enqueueOpsEvent({
  type: "BOOKING_TICKETED",
  aggregateType: "Booking",
  aggregateId: booking.id,
  idempotencyKey: `ops:e2e:ticketed:${booking.id}`,
  payload: {
    bookingId: booking.id,
    amountMinor: 12000,
    netMinor: 10000,
    currency: "USD",
  },
});
const drain = await ops.drainOutbox({ eventId: evt.id, actorUserId: user.id });
const reconNa = await ops.createReconciliationItem({
  bookingId: booking.id,
  actorUserId: user.id,
  idempotencyKey: `e2e:recon:na:${booking.id}`,
});
const reconOk = await ops.createReconciliationItem({
  bookingId: booking.id,
  invoicedMinor: 10000,
  actorUserId: user.id,
  idempotencyKey: `e2e:recon:ok:${booking.id}`,
});
const status = await ops.getIntegrationStatus();
const ava = await ops.buildAvaOperationsGuidance(user.id, booking.id);
const updated = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
const accounting = await prisma.accountingEntry.count({ where: { bookingId: booking.id } });

console.log(
  JSON.stringify(
    {
      flowA: { eventStatus: updated.status, delivered: drain.delivered, accounting },
      flowC: { unavailable: reconNa.status, matched: reconOk.status },
      flowD: {
        crm: status.crm.state,
        midoffice: status.midoffice.state,
        accountingExt: status.accounting.state,
      },
      avaHasUnconfigured: /UNCONFIGURED/i.test(ava.promptBlock),
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
