/**
 * Module 06 — Corporate invoicing.
 * Snapshots authoritative Booking money fields; never trusts client totals.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { buildSimplePdf } from "../vault/vault.printables.js";
import {
  INVOICEABLE_BOOKING_STATUSES,
} from "./corporate.constants.js";
import { requireCompanyMembership } from "./corporate.service.js";

const MAX_PAGE_SIZE = 100;

const INVOICE_SELECT = {
  id: true,
  companyId: true,
  invoiceNumber: true,
  bookingId: true,
  status: true,
  currency: true,
  netMinor: true,
  amountMinor: true,
  marginMinor: true,
  billingCycle: true,
  companyName: true,
  projectCode: true,
  projectCodeName: true,
  product: true,
  externalRef: true,
  travellerName: true,
  issuedAt: true,
  issuedByUserId: true,
  paidAt: true,
  voidedAt: true,
  createdAt: true,
  updatedAt: true,
};

function auditInvoice(userId, action, resourceId, metadata) {
  void writeAudit({
    userId,
    action,
    resourceType: "CorporateInvoice",
    resourceId,
    metadata,
  });
}

function travellerNameFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const full = snapshot.fullName || snapshot.name;
  if (full) return String(full).slice(0, 200);
  const given = snapshot.givenName || snapshot.firstName;
  const sur = snapshot.surname || snapshot.lastName;
  if (given || sur) return [given, sur].filter(Boolean).join(" ").slice(0, 200);
  return null;
}

function formatMoneyLine(amountMinor, currency) {
  return `${currency} ${(Number(amountMinor) / 100).toFixed(2)}`;
}

/**
 * Atomically allocate the next invoice sequence value for a company.
 * @returns {Promise<number>}
 */
async function allocateInvoiceSequence(tx, companyId) {
  const rows = await tx.$queryRaw`
    INSERT INTO "CorporateInvoiceSequence" ("companyId", "nextValue")
    VALUES (${companyId}, 1)
    ON CONFLICT ("companyId")
    DO UPDATE SET "nextValue" = "CorporateInvoiceSequence"."nextValue" + 1
    RETURNING "nextValue"
  `;
  const nextValue = Array.isArray(rows) ? rows[0]?.nextValue : rows?.nextValue;
  if (!Number.isInteger(nextValue) || nextValue < 1) {
    throw new AppError(500, "Failed to allocate invoice number");
  }
  return nextValue;
}

function buildInvoiceNumber(companyId, seq) {
  const suffix = String(companyId).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "CO";
  return `INV-${suffix}-${String(seq).padStart(6, "0")}`;
}

async function getCompanyInvoiceOrThrow(companyId, invoiceId) {
  const invoice = await prisma.corporateInvoice.findFirst({
    where: { id: invoiceId, companyId },
    select: INVOICE_SELECT,
  });
  if (!invoice) throw new AppError(404, "Invoice not found");
  return invoice;
}

async function assertInvoiceVisibleToMember(membership, invoice) {
  if (membership.role === "MEMBER") {
    const booking = await prisma.booking.findUnique({
      where: { id: invoice.bookingId },
      select: { userId: true },
    });
    if (!booking || booking.userId !== membership.userId) {
      throw new AppError(403, "Forbidden");
    }
  }
}

/**
 * List invoices for a company. MEMBERs only see invoices for their own bookings.
 */
export async function listInvoices(actorUserId, companyId, { page, pageSize } = {}) {
  const membership = await requireCompanyMembership(actorUserId, companyId);
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  let bookingIdsFilter = null;
  if (membership.role === "MEMBER") {
    const owned = await prisma.booking.findMany({
      where: {
        userId: actorUserId,
        metadata: { path: ["companyId"], equals: companyId },
      },
      select: { id: true },
    });
    bookingIdsFilter = owned.map((b) => b.id);
    if (!bookingIdsFilter.length) {
      return { items: [], page: currentPage, pageSize: take, total: 0, totalPages: 0 };
    }
  }

  const where = {
    companyId,
    ...(bookingIdsFilter ? { bookingId: { in: bookingIdsFilter } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.corporateInvoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip,
      take,
      select: INVOICE_SELECT,
    }),
    prisma.corporateInvoice.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getInvoice(actorUserId, companyId, invoiceId) {
  const membership = await requireCompanyMembership(actorUserId, companyId);
  const invoice = await getCompanyInvoiceOrThrow(companyId, invoiceId);
  await assertInvoiceVisibleToMember(membership, invoice);
  return invoice;
}

/**
 * Issue (or return existing) corporate invoice for a committed booking.
 * Totals come only from Booking — client cannot supply amounts.
 */
export async function issueInvoice(actorUserId, companyId, { bookingId }) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });

  if (!bookingId || typeof bookingId !== "string") {
    throw new AppError(400, "bookingId is required");
  }

  const existing = await prisma.corporateInvoice.findUnique({
    where: { companyId_bookingId: { companyId, bookingId: bookingId.trim() } },
    select: INVOICE_SELECT,
  });
  if (existing) return existing;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, billingCycle: true, isActive: true },
  });
  if (!company) throw new AppError(404, "Company not found");
  if (!company.isActive) throw new AppError(409, "Company is inactive");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId.trim() },
    select: {
      id: true,
      userId: true,
      status: true,
      product: true,
      currency: true,
      amountMinor: true,
      netMinor: true,
      marginMinor: true,
      externalRef: true,
      travellerSnapshot: true,
      metadata: true,
      payments: {
        where: { status: { in: ["CAPTURED", "AUTHORIZED"] } },
        select: {
          id: true,
          status: true,
          provider: true,
          amountMinor: true,
          currency: true,
          // Explicitly omit paymentMethodToken / secrets
        },
        take: 5,
      },
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");

  const bookingCompanyId =
    booking.metadata?.companyId && typeof booking.metadata.companyId === "string"
      ? booking.metadata.companyId
      : null;
  if (!bookingCompanyId || bookingCompanyId !== companyId) {
    throw new AppError(403, "Booking is not associated with this company");
  }
  if (!INVOICEABLE_BOOKING_STATUSES.includes(booking.status)) {
    throw new AppError(
      409,
      `Booking status ${booking.status} is not eligible for invoicing`,
    );
  }

  const paid = booking.payments.some((p) => p.status === "CAPTURED");
  const status = paid ? "PAID" : "ISSUED";

  const projectCode =
    typeof booking.metadata?.projectCode === "string" ? booking.metadata.projectCode : null;
  const projectCodeName =
    typeof booking.metadata?.projectCodeName === "string"
      ? booking.metadata.projectCodeName
      : null;

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const seq = await allocateInvoiceSequence(tx, companyId);
      const invoiceNumber = buildInvoiceNumber(companyId, seq);
      return tx.corporateInvoice.create({
        data: {
          companyId,
          invoiceNumber,
          bookingId: booking.id,
          status,
          currency: booking.currency,
          netMinor: booking.netMinor,
          amountMinor: booking.amountMinor,
          marginMinor: booking.marginMinor,
          billingCycle: company.billingCycle ?? null,
          companyName: company.name,
          projectCode,
          projectCodeName,
          product: booking.product,
          externalRef: booking.externalRef ?? null,
          travellerName: travellerNameFromSnapshot(booking.travellerSnapshot),
          issuedByUserId: actorUserId,
          paidAt: paid ? new Date() : null,
        },
        select: INVOICE_SELECT,
      });
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const raced = await prisma.corporateInvoice.findUnique({
        where: { companyId_bookingId: { companyId, bookingId: booking.id } },
        select: INVOICE_SELECT,
      });
      if (raced) return raced;
    }
    throw err;
  }

  auditInvoice(actorUserId, "corporate.invoice.issue", created.id, {
    companyId,
    bookingId: booking.id,
    invoiceNumber: created.invoiceNumber,
    amountMinor: created.amountMinor,
    currency: created.currency,
    status: created.status,
  });

  return created;
}

export async function updateInvoiceStatus(actorUserId, companyId, invoiceId, { status }) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  const invoice = await getCompanyInvoiceOrThrow(companyId, invoiceId);

  if (invoice.status === "VOID") {
    throw new AppError(409, "Voided invoices cannot be updated");
  }
  if (status === invoice.status) return invoice;

  const data = { status };
  if (status === "PAID") {
    data.paidAt = new Date();
    data.voidedAt = null;
  } else if (status === "VOID") {
    data.voidedAt = new Date();
  } else if (status === "ISSUED") {
    data.paidAt = null;
    data.voidedAt = null;
  }

  const updated = await prisma.corporateInvoice.update({
    where: { id: invoice.id },
    data,
    select: INVOICE_SELECT,
  });

  auditInvoice(actorUserId, "corporate.invoice.status", updated.id, {
    companyId,
    from: invoice.status,
    to: updated.status,
  });
  return updated;
}

/**
 * PDF download — server-authoritative snapshot only; no card tokens/PANs.
 */
export async function getInvoicePdf(actorUserId, companyId, invoiceId) {
  const membership = await requireCompanyMembership(actorUserId, companyId);
  const invoice = await getCompanyInvoiceOrThrow(companyId, invoiceId);
  await assertInvoiceVisibleToMember(membership, invoice);

  const lines = [
    `Invoice: ${invoice.invoiceNumber}`,
    `Status: ${invoice.status}`,
    `Company: ${invoice.companyName}`,
    `Issued: ${invoice.issuedAt.toISOString().slice(0, 10)}`,
    invoice.billingCycle ? `Billing cycle: ${invoice.billingCycle}` : null,
    `Booking: ${invoice.bookingId}`,
    invoice.externalRef ? `Confirmation: ${invoice.externalRef}` : null,
    invoice.product ? `Product: ${invoice.product}` : null,
    invoice.travellerName ? `Traveller: ${invoice.travellerName}` : null,
    invoice.projectCode
      ? `Project: ${invoice.projectCode}${invoice.projectCodeName ? ` — ${invoice.projectCodeName}` : ""}`
      : null,
    `Currency: ${invoice.currency}`,
    `Total: ${formatMoneyLine(invoice.amountMinor, invoice.currency)}`,
    `(Amounts from FlightOne booking record at issue time)`,
  ].filter(Boolean);

  const pdf = buildSimplePdf({
    title: `FlightOne Invoice ${invoice.invoiceNumber}`,
    lines,
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    contentType: "application/pdf",
    filename: `${invoice.invoiceNumber}.pdf`,
    contentBase64: pdf.toString("base64"),
  };
}
