/**
 * Phase 3 expense management — receipts, OCR boundary, per-diem, approvals, export.
 * Organization-scoped. Never fabricates OCR fields or external payroll delivery.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import {
  getVaultStorage,
  getVaultStorageCapability,
  validateUploadPayload,
  decodeBase64Content,
  buildStorageKey,
} from "../vault/vault.storage.js";
import { requireCompanyMembership } from "./corporate.service.js";

export const EXPENSE_CATEGORIES = [
  "FLIGHT",
  "HOTEL",
  "MEALS",
  "TRANSPORT",
  "PER_DIEM",
  "OTHER",
];

export const EXPENSE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "REIMBURSEMENT_PENDING",
  "REIMBURSED",
];

const EXPENSE_SELECT = {
  id: true,
  companyId: true,
  ownerUserId: true,
  bookingId: true,
  expenseDate: true,
  category: true,
  amountMinor: true,
  currency: true,
  merchant: true,
  description: true,
  status: true,
  perDiemPolicyId: true,
  perDiemAmountMinor: true,
  perDiemConfigured: true,
  ocrStatus: true,
  ocrProvider: true,
  ocrExtracted: true,
  ocrProvenance: true,
  receiptContentType: true,
  receiptByteSize: true,
  receiptOriginalFilename: true,
  reimbursementExportedAt: true,
  reimbursementExportKind: true,
  approverUserId: true,
  decisionNote: true,
  decidedAt: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
};

function auditExpense(userId, action, resourceId, metadata) {
  return writeAudit({
    userId,
    action,
    resourceType: "Expense",
    resourceId,
    metadata: metadata ?? null,
  }).catch(() => {});
}

function publicExpense(row) {
  if (!row) return null;
  const { receiptStorageKey, ...rest } = row;
  return {
    ...rest,
    hasReceipt: Boolean(row.receiptByteSize || receiptStorageKey || row.receiptOriginalFilename),
  };
}

export function getExpenseOcrCapability(env = process.env) {
  const provider = (env.EXPENSE_OCR_PROVIDER || env.OCR_PROVIDER || "unconfigured").trim().toLowerCase();
  const url = (env.EXPENSE_OCR_HTTP_URL || env.OCR_HTTP_URL || "").trim();
  if (provider === "http" && url) {
    return { provider: "http", configured: true, reason: null };
  }
  return {
    provider: provider === "http" ? "http" : "unconfigured",
    configured: false,
    reason:
      "Receipt OCR is not configured. Uploaded files are stored when vault storage is available; merchant, amount, date, and tax are never invented.",
  };
}

export function getFinanceExportCapability(env = process.env) {
  const provider = (env.EXPENSE_FINANCE_EXPORT_PROVIDER || "unconfigured").trim().toLowerCase();
  const url = (env.EXPENSE_FINANCE_EXPORT_HTTP_URL || "").trim();
  if (provider === "http" && url) {
    return { provider: "http", configured: true, reason: null };
  }
  return {
    provider: "unconfigured",
    configured: false,
    reason:
      "External finance/payroll integration is not configured. You can download a local export; FlightOne will not claim the file was submitted to accounting.",
  };
}

function sanitizeReceiptOcrFields(input) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  if (typeof input.merchant === "string" && input.merchant.trim()) {
    out.merchant = input.merchant.trim().slice(0, 200);
  }
  if (Number.isInteger(input.amountMinor) && input.amountMinor >= 0) {
    out.amountMinor = input.amountMinor;
  }
  if (typeof input.currency === "string" && /^[A-Za-z]{3}$/.test(input.currency.trim())) {
    out.currency = input.currency.trim().toUpperCase();
  }
  if (typeof input.date === "string") {
    const d = new Date(input.date);
    if (!Number.isNaN(d.getTime())) out.date = d.toISOString().slice(0, 10);
  }
  if (Number.isInteger(input.taxMinor) && input.taxMinor >= 0) {
    out.taxMinor = input.taxMinor;
  }
  return out;
}

async function extractReceiptOcr({ contentBase64, contentType }) {
  const cap = getExpenseOcrCapability();
  if (!cap.configured) {
    return {
      status: "UNCONFIGURED",
      provider: cap.provider,
      fields: {},
      provenance: {
        source: "unconfigured",
        at: new Date().toISOString(),
        warnings: ["ocr_provider_unconfigured"],
      },
    };
  }
  const url = (process.env.EXPENSE_OCR_HTTP_URL || process.env.OCR_HTTP_URL || "").trim();
  const key = (process.env.EXPENSE_OCR_HTTP_API_KEY || process.env.OCR_HTTP_API_KEY || "").trim();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        documentType: "RECEIPT",
        contentType,
        hasBinary: Boolean(contentBase64),
        contentBase64,
      }),
    });
    if (!res.ok) {
      return {
        status: "FAILED",
        provider: "http",
        fields: {},
        provenance: {
          source: "http",
          at: new Date().toISOString(),
          warnings: [`ocr_http_status_${res.status}`],
        },
      };
    }
    const body = await res.json().catch(() => null);
    const fields = sanitizeReceiptOcrFields(body?.fields || body);
    return {
      status: Object.keys(fields).length ? "PROCESSED" : "PROCESSED",
      provider: "http",
      fields,
      provenance: {
        source: "http",
        at: new Date().toISOString(),
        warnings: Array.isArray(body?.warnings) ? body.warnings : [],
      },
    };
  } catch {
    return {
      status: "FAILED",
      provider: "http",
      fields: {},
      provenance: {
        source: "http",
        at: new Date().toISOString(),
        warnings: ["ocr_http_error"],
      },
    };
  }
}

async function assertBookingLink(userId, companyId, bookingId, membership) {
  if (!bookingId) return null;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, metadata: true, product: true, status: true },
  });
  if (!booking) throw new AppError(404, "Trip/booking not found");
  const tagged = booking.metadata?.companyId;
  if (tagged !== companyId) {
    throw new AppError(403, "Booking is not associated with this company");
  }
  if (membership.role === "MEMBER" && booking.userId !== userId) {
    throw new AppError(403, "You can only link your own company trips");
  }
  return booking;
}

export async function listPerDiemPolicies(userId, companyId) {
  await requireCompanyMembership(userId, companyId);
  const items = await prisma.perDiemPolicy.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return {
    configured: items.some((p) => p.isActive),
    items,
    emptyReason: items.length ? null : "No corporate per-diem policy is configured.",
  };
}

export async function upsertPerDiemPolicy(userId, companyId, body = {}) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN"] });
  if (!Number.isInteger(body.dailyAmountMinor) || body.dailyAmountMinor < 0) {
    throw new AppError(400, "dailyAmountMinor is required");
  }
  const currency = String(body.currency || "USD").trim().toUpperCase();
  const name = String(body.name || "Standard per diem").trim().slice(0, 120);
  if (body.id) {
    const existing = await prisma.perDiemPolicy.findUnique({ where: { id: body.id } });
    if (!existing || existing.companyId !== companyId) {
      throw new AppError(404, "Per-diem policy not found");
    }
  }
  const row = body.id
    ? await prisma.perDiemPolicy.update({
        where: { id: body.id },
        data: {
          name,
          dailyAmountMinor: body.dailyAmountMinor,
          currency,
          isActive: body.isActive != null ? Boolean(body.isActive) : true,
        },
      })
    : await prisma.perDiemPolicy.create({
        data: {
          companyId,
          name,
          dailyAmountMinor: body.dailyAmountMinor,
          currency,
          isActive: body.isActive != null ? Boolean(body.isActive) : true,
        },
      });
  if (body.id && row.companyId !== companyId) {
    throw new AppError(404, "Per-diem policy not found");
  }
  await auditExpense(userId, "corporate.per_diem.upsert", row.id, { companyId });
  return row;
}

export async function quotePerDiem(userId, companyId, { days } = {}) {
  await requireCompanyMembership(userId, companyId);
  const n = Number.isInteger(days) && days > 0 ? days : 1;
  const policy = await prisma.perDiemPolicy.findFirst({
    where: { companyId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!policy) {
    return {
      configured: false,
      amountMinor: null,
      currency: null,
      days: n,
      reason: "No corporate per-diem policy is configured.",
    };
  }
  return {
    configured: true,
    policyId: policy.id,
    amountMinor: policy.dailyAmountMinor * n,
    dailyAmountMinor: policy.dailyAmountMinor,
    currency: policy.currency,
    days: n,
  };
}

export async function createExpense(userId, companyId, body = {}) {
  const membership = await requireCompanyMembership(userId, companyId);
  if (!Number.isInteger(body.amountMinor) || body.amountMinor < 0) {
    throw new AppError(400, "amountMinor is required");
  }
  const category = String(body.category || "OTHER").trim().toUpperCase();
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new AppError(400, "Invalid expense category");
  }
  const expenseDate = body.expenseDate ? new Date(body.expenseDate) : new Date();
  if (Number.isNaN(expenseDate.getTime())) {
    throw new AppError(400, "expenseDate is invalid");
  }
  await assertBookingLink(userId, companyId, body.bookingId || null, membership);

  let perDiemConfigured = false;
  let perDiemAmountMinor = null;
  let perDiemPolicyId = null;
  if (category === "PER_DIEM") {
    const quote = await quotePerDiem(userId, companyId, { days: body.days || 1 });
    perDiemConfigured = quote.configured;
    if (!quote.configured) {
      throw new AppError(400, quote.reason);
    }
    perDiemAmountMinor = quote.amountMinor;
    perDiemPolicyId = quote.policyId;
  }

  const ocrCap = getExpenseOcrCapability();
  const row = await prisma.expense.create({
    data: {
      companyId,
      ownerUserId: userId,
      bookingId: body.bookingId || null,
      expenseDate,
      category,
      amountMinor: category === "PER_DIEM" && perDiemAmountMinor != null ? perDiemAmountMinor : body.amountMinor,
      currency: String(body.currency || "USD").trim().toUpperCase(),
      merchant: body.merchant ? String(body.merchant).trim().slice(0, 200) : null,
      description: body.description ? String(body.description).trim().slice(0, 500) : null,
      perDiemPolicyId,
      perDiemAmountMinor,
      perDiemConfigured,
      ocrStatus: ocrCap.configured ? "UNPROCESSED" : "UNCONFIGURED",
      ocrProvider: ocrCap.provider,
      ocrProvenance: {
        source: ocrCap.configured ? "pending" : "unconfigured",
        at: new Date().toISOString(),
      },
    },
    select: EXPENSE_SELECT,
  });
  await auditExpense(userId, "corporate.expense.create", row.id, {
    companyId,
    category,
    amountMinor: row.amountMinor,
  });
  return publicExpense(row);
}

export async function listExpenses(userId, companyId, { status, page = 1, pageSize = 20 } = {}) {
  const membership = await requireCompanyMembership(userId, companyId);
  const take = Math.min(Number(pageSize) || 20, 50);
  const skip = ((Number(page) || 1) - 1) * take;
  const where = {
    companyId,
    ...(membership.role === "MEMBER" ? { ownerUserId: userId } : {}),
    ...(status ? { status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: EXPENSE_SELECT,
    }),
    prisma.expense.count({ where }),
  ]);
  return {
    items: items.map(publicExpense),
    total,
    page: Number(page) || 1,
    pageSize: take,
    ocr: getExpenseOcrCapability(),
    financeExport: getFinanceExportCapability(),
  };
}

async function loadOwnedExpense(userId, companyId, expenseId, { forApproval = false } = {}) {
  const membership = await requireCompanyMembership(
    userId,
    companyId,
    forApproval ? { allowedRoles: ["APPROVER", "ADMIN"] } : {},
  );
  const row = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { ...EXPENSE_SELECT, receiptStorageKey: true },
  });
  if (!row || row.companyId !== companyId) {
    throw new AppError(404, "Expense not found");
  }
  if (membership.role === "MEMBER" && row.ownerUserId !== userId) {
    throw new AppError(404, "Expense not found");
  }
  return { row, membership };
}

export async function getExpense(userId, companyId, expenseId) {
  const { row } = await loadOwnedExpense(userId, companyId, expenseId);
  return publicExpense(row);
}

export async function updateExpense(userId, companyId, expenseId, body = {}) {
  const { row } = await loadOwnedExpense(userId, companyId, expenseId);
  if (row.ownerUserId !== userId) {
    throw new AppError(403, "Only the owner may update this expense");
  }
  if (row.status !== "DRAFT" && row.status !== "REJECTED") {
    throw new AppError(409, `Cannot update an expense in status ${row.status}`);
  }
  const data = {};
  if (body.amountMinor != null) {
    if (!Number.isInteger(body.amountMinor) || body.amountMinor < 0) {
      throw new AppError(400, "amountMinor is invalid");
    }
    data.amountMinor = body.amountMinor;
  }
  if (body.merchant !== undefined) data.merchant = body.merchant ? String(body.merchant).trim().slice(0, 200) : null;
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim().slice(0, 500) : null;
  }
  if (body.category) {
    const category = String(body.category).trim().toUpperCase();
    if (!EXPENSE_CATEGORIES.includes(category)) throw new AppError(400, "Invalid expense category");
    data.category = category;
  }
  if (body.expenseDate) {
    const d = new Date(body.expenseDate);
    if (Number.isNaN(d.getTime())) throw new AppError(400, "expenseDate is invalid");
    data.expenseDate = d;
  }
  if (body.bookingId !== undefined) {
    const membership = await requireCompanyMembership(userId, companyId);
    await assertBookingLink(userId, companyId, body.bookingId || null, membership);
    data.bookingId = body.bookingId || null;
  }
  if (row.status === "REJECTED") data.status = "DRAFT";
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data,
    select: EXPENSE_SELECT,
  });
  await auditExpense(userId, "corporate.expense.update", expenseId, { companyId, fields: Object.keys(data) });
  return publicExpense(updated);
}

export async function attachReceipt(userId, companyId, expenseId, body = {}) {
  const { row } = await loadOwnedExpense(userId, companyId, expenseId);
  if (row.ownerUserId !== userId) {
    throw new AppError(403, "Only the owner may attach a receipt");
  }
  const storageCap = getVaultStorageCapability();
  const buffer = decodeBase64Content(body.contentBase64);
  const meta = validateUploadPayload({
    contentType: body.contentType,
    originalFilename: body.originalFilename || "receipt",
    byteLength: buffer.length,
  });

  let fileUrl = null;
  if (storageCap.canUpload) {
    const storageKey = buildStorageKey({
      ownerUserId: userId,
      documentId: expenseId,
      originalFilename: meta.originalFilename,
    });
    const stored = await getVaultStorage().put({
      storageKey,
      buffer,
      contentType: meta.contentType,
    });
    fileUrl = stored.fileUrl;
  }

  const ocr = await extractReceiptOcr({
    contentBase64: body.contentBase64,
    contentType: meta.contentType,
  });

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      receiptStorageKey: fileUrl,
      receiptContentType: meta.contentType,
      receiptByteSize: meta.byteLength,
      receiptOriginalFilename: meta.originalFilename,
      ocrStatus: fileUrl || ocr.status === "UNCONFIGURED" ? ocr.status : ocr.status,
      ocrProvider: ocr.provider,
      ocrExtracted: ocr.fields,
      ocrProvenance: {
        ...ocr.provenance,
        stored: Boolean(fileUrl),
        storageConfigured: storageCap.canUpload,
      },
    },
    select: EXPENSE_SELECT,
  });
  await auditExpense(userId, "corporate.expense.receipt", expenseId, {
    companyId,
    ocrStatus: updated.ocrStatus,
    stored: Boolean(fileUrl),
  });
  return {
    ...publicExpense(updated),
    storage: {
      configured: storageCap.canUpload,
      reason: storageCap.canUpload ? null : storageCap.reasons?.[0] || "Receipt storage is not configured.",
    },
  };
}

export async function downloadReceipt(userId, companyId, expenseId) {
  const { row } = await loadOwnedExpense(userId, companyId, expenseId);
  if (!row.receiptStorageKey) {
    throw new AppError(404, "No receipt file is stored for this expense");
  }
  const buffer = await getVaultStorage().get({ fileUrl: row.receiptStorageKey });
  return {
    contentType: row.receiptContentType || "application/octet-stream",
    filename: row.receiptOriginalFilename || "receipt",
    contentBase64: buffer.toString("base64"),
  };
}

export async function submitExpense(userId, companyId, expenseId) {
  const { row } = await loadOwnedExpense(userId, companyId, expenseId);
  if (row.ownerUserId !== userId) {
    throw new AppError(403, "Only the owner may submit this expense");
  }
  if (row.status !== "DRAFT" && row.status !== "REJECTED") {
    throw new AppError(409, `Cannot submit an expense in status ${row.status}`);
  }
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: "PENDING_APPROVAL",
      submittedAt: new Date(),
      approverUserId: null,
      decisionNote: null,
      decidedAt: null,
    },
    select: EXPENSE_SELECT,
  });
  await auditExpense(userId, "corporate.expense.submit", expenseId, { companyId, status: updated.status });
  try {
    const approvers = await prisma.companyMembership.findMany({
      where: { companyId, role: { in: ["APPROVER", "ADMIN"] } },
      select: { userId: true },
    });
    const rows = [];
    for (const a of approvers) {
      if (a.userId === userId) continue;
      for (const channel of ["APP", "EMAIL"]) {
        rows.push({
          userId: a.userId,
          channel,
          dedupeKey: `corporate:expense:submit:${updated.id}:${a.userId}:${channel}`,
          title: "Expense approval requested",
          body: `An expense (${updated.currency} ${(updated.amountMinor / 100).toFixed(2)}) is waiting for approval.`,
          payload: { module: "corporate", kind: "expense.submit", expenseId: updated.id, companyId },
        });
      }
    }
    if (rows.length) await enqueueNotificationOutbox(rows);
  } catch {
    /* notifications are best-effort */
  }
  return publicExpense(updated);
}

export async function decideExpense(userId, companyId, expenseId, { decision, note } = {}) {
  const { row } = await loadOwnedExpense(userId, companyId, expenseId, { forApproval: true });
  if (row.ownerUserId === userId) {
    throw new AppError(403, "You cannot approve or reject your own expense");
  }
  if (row.status !== "PENDING_APPROVAL" && row.status !== "SUBMITTED") {
    throw new AppError(409, `Cannot decide an expense in status ${row.status}`);
  }
  const d = String(decision || "").toUpperCase();
  if (d !== "APPROVE" && d !== "REJECT") {
    throw new AppError(400, "decision must be APPROVE or REJECT");
  }
  const status = d === "APPROVE" ? "REIMBURSEMENT_PENDING" : "REJECTED";
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status,
      approverUserId: userId,
      decisionNote: note ? String(note).trim().slice(0, 500) : null,
      decidedAt: new Date(),
    },
    select: EXPENSE_SELECT,
  });
  await auditExpense(userId, "corporate.expense.decide", expenseId, {
    companyId,
    decision: d,
    status,
  });
  try {
    const rows = ["APP", "EMAIL"].map((channel) => ({
      userId: row.ownerUserId,
      channel,
      dedupeKey: `corporate:expense:decision:${updated.id}:${status}:${channel}`,
      title: d === "APPROVE" ? "Expense approved" : "Expense rejected",
      body:
        d === "APPROVE"
          ? "Your expense was approved and is pending reimbursement."
          : `Your expense was rejected${note ? `: ${note}` : "."}`,
      payload: { module: "corporate", kind: "expense.decision", expenseId: updated.id, companyId, status },
    }));
    await enqueueNotificationOutbox(rows);
  } catch {
    /* best-effort */
  }
  return publicExpense(updated);
}

export async function markExpenseReimbursed(userId, companyId, expenseId) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN"] });
  const row = await prisma.expense.findUnique({ where: { id: expenseId }, select: EXPENSE_SELECT });
  if (!row || row.companyId !== companyId) throw new AppError(404, "Expense not found");
  if (row.status !== "REIMBURSEMENT_PENDING" && row.status !== "APPROVED") {
    throw new AppError(409, `Cannot reimburse an expense in status ${row.status}`);
  }
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: "REIMBURSED" },
    select: EXPENSE_SELECT,
  });
  await auditExpense(userId, "corporate.expense.reimburse", expenseId, { companyId });
  try {
    await enqueueNotificationOutbox(
      ["APP", "EMAIL"].map((channel) => ({
        userId: row.ownerUserId,
        channel,
        dedupeKey: `corporate:expense:reimbursed:${updated.id}:${channel}`,
        title: "Expense reimbursed",
        body: "Your expense was marked reimbursed.",
        payload: { module: "corporate", kind: "expense.reimbursed", expenseId: updated.id, companyId },
      })),
    );
  } catch {
    /* best-effort */
  }
  return publicExpense(updated);
}

export async function exportReimbursableExpenses(userId, companyId) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN", "APPROVER"] });
  const cap = getFinanceExportCapability();
  const items = await prisma.expense.findMany({
    where: {
      companyId,
      status: { in: ["APPROVED", "REIMBURSEMENT_PENDING", "REIMBURSED"] },
    },
    orderBy: { expenseDate: "asc" },
    select: EXPENSE_SELECT,
  });
  const header = [
    "id",
    "ownerUserId",
    "expenseDate",
    "category",
    "amountMinor",
    "currency",
    "merchant",
    "status",
    "bookingId",
  ];
  const lines = [header.join(",")];
  for (const e of items) {
    const date = e.expenseDate instanceof Date ? e.expenseDate.toISOString().slice(0, 10) : "";
    const cells = [
      e.id,
      e.ownerUserId,
      date,
      e.category,
      String(e.amountMinor),
      e.currency,
      JSON.stringify(e.merchant || ""),
      e.status,
      e.bookingId || "",
    ];
    lines.push(cells.join(","));
  }
  const csv = `${lines.join("\n")}\n`;
  const exportedAt = new Date();
  await prisma.expense.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: {
      reimbursementExportedAt: exportedAt,
      reimbursementExportKind: cap.configured ? "http" : "local_csv",
    },
  });
  await auditExpense(userId, "corporate.expense.export", companyId, {
    companyId,
    count: items.length,
    kind: cap.configured ? "http" : "local_csv",
    submittedExternally: false,
  });
  return {
    format: "csv",
    filename: `flightone-expenses-${companyId.slice(0, 8)}.csv`,
    contentBase64: Buffer.from(csv, "utf8").toString("base64"),
    count: items.length,
    integration: cap,
    submittedExternally: false,
  };
}
