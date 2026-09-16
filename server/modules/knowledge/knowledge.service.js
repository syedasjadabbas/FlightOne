/**
 * Module 16 — AI Knowledge Platform service.
 * Deterministic keyword retrieval; fail-closed on missing/expired/restricted knowledge.
 */
import { randomUUID } from "node:crypto";
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { KNOWLEDGE_CATEGORIES } from "./knowledge.validators.js";

const MAX_PAGE_SIZE = 100;
const MAX_CHUNK_CHARS = 800;
const DEFAULT_RETRIEVE_LIMIT = 5;
const CANDIDATE_POOL_SIZE = 200;
const MIN_SCORE_THRESHOLD = 0.25;
const HIGH_COVERAGE_THRESHOLD = 0.6;
const CONFLICT_SCORE_DELTA = 0.12;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "was", "were", "be", "been", "with", "that", "this", "it", "as", "by",
  "at", "from", "what", "how", "do", "does", "can", "i", "you", "we", "they",
  "will", "not", "no", "any", "all", "if", "so", "but", "my", "our", "your",
]);

const DOCUMENT_LIST_SELECT = {
  id: true,
  documentKey: true,
  title: true,
  category: true,
  visibility: true,
  status: true,
  version: true,
  source: true,
  ownerUserId: true,
  effectiveFrom: true,
  expiresAt: true,
  lastVerifiedAt: true,
  ingestionStatus: true,
  ingestionError: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const DOCUMENT_DETAIL_SELECT = {
  ...DOCUMENT_LIST_SELECT,
  content: true,
};

export function tokenize(text) {
  const matches = String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  return Array.from(new Set(matches.filter((t) => t.length > 1 && !STOPWORDS.has(t))));
}

function splitLongParagraph(paragraph, maxChars) {
  const pieces = [];
  let remaining = paragraph;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;
    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

export function chunkDocumentContent(content, maxChars = MAX_CHUNK_CHARS) {
  const paragraphs = String(content || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      pieces.push(...splitLongParagraph(paragraph, maxChars));
    } else {
      pieces.push(paragraph);
    }
  }

  const chunks = [];
  let buffer = "";
  for (const piece of pieces) {
    const candidate = buffer ? `${buffer}\n\n${piece}` : piece;
    if (candidate.length > maxChars && buffer) {
      chunks.push(buffer);
      buffer = piece;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) chunks.push(buffer);

  if (chunks.length > 0) return chunks;
  const fallback = String(content || "").trim();
  return fallback ? [fallback] : [];
}

export function canManageKnowledge(permissions) {
  if (permissions instanceof Set) {
    return permissions.has("*") || permissions.has("knowledge:write") || permissions.has("ops:dashboard:read");
  }
  return (
    hasPermissionEff(permissions, "knowledge:write") ||
    hasPermissionEff(permissions, "ops:dashboard:read")
  );
}

export function canReadKnowledgeAdmin(permissions) {
  if (permissions instanceof Set) {
    return (
      permissions.has("*") ||
      permissions.has("knowledge:read") ||
      permissions.has("knowledge:write") ||
      permissions.has("ops:dashboard:read")
    );
  }
  return (
    canManageKnowledge(permissions) ||
    hasPermissionEff(permissions, "knowledge:read")
  );
}

function isOpsRetrieve(permissions, mode = "ava") {
  // Client-supplied mode="ops" alone must NEVER elevate — requires real ops/knowledge perms.
  return mode === "ops" && canReadKnowledgeAdmin(permissions);
}

function allowedVisibilitiesForRetrieve(permissions, mode = "ava") {
  if (isOpsRetrieve(permissions, mode) || canReadKnowledgeAdmin(permissions)) {
    return ["CUSTOMER_SAFE", "INTERNAL", "RESTRICTED"];
  }
  // Customers / Ava without ops: CUSTOMER_SAFE + INTERNAL (summary-only), never RESTRICTED
  return ["CUSTOMER_SAFE", "INTERNAL"];
}

function isCurrentlyValid(doc, now = new Date()) {
  if (doc.status === "EXPIRED" || doc.status === "ARCHIVED" || doc.status === "DRAFT") {
    return false;
  }
  if (doc.status !== "PUBLISHED") return false;
  if (doc.effectiveFrom && doc.effectiveFrom > now) return false;
  if (doc.expiresAt && doc.expiresAt <= now) return false;
  if (doc.ingestionStatus !== "READY") return false;
  return true;
}

async function expireDueDocuments(tx = prisma) {
  const now = new Date();
  await tx.knowledgeDocument.updateMany({
    where: {
      status: "PUBLISHED",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED", isActive: false },
  });
}

async function replaceChunks(tx, documentId, content) {
  const chunkContents = chunkDocumentContent(content);
  if (chunkContents.length === 0) {
    throw new AppError(400, "content must contain at least one non-empty paragraph");
  }
  await tx.knowledgeChunk.deleteMany({ where: { documentId } });
  await tx.knowledgeChunk.createMany({
    data: chunkContents.map((chunkText, ordinal) => ({
      documentId,
      ordinal,
      content: chunkText,
    })),
  });
  return chunkContents.length;
}

/**
 * Extract plain text from an upload buffer. Unsupported formats → UNSUPPORTED.
 */
export function extractTextFromUpload({ filename, mimeType, buffer }) {
  const name = String(filename || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  const allowed =
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(txt|md|markdown|json)$/.test(name);

  if (!allowed) {
    return {
      ok: false,
      ingestionStatus: "UNSUPPORTED",
      error: `Unsupported file type (${mime || name || "unknown"}). Use .txt, .md, or .json.`,
    };
  }
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { ok: false, ingestionStatus: "FAILED", error: "Empty upload buffer" };
  }
  if (buffer.length > 2_000_000) {
    return { ok: false, ingestionStatus: "FAILED", error: "File exceeds 2MB limit" };
  }
  // Reject obvious executables by magic bytes
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { ok: false, ingestionStatus: "FAILED", error: "Executable content rejected" };
  }
  const text = buffer.toString("utf8").trim();
  if (!text) {
    return { ok: false, ingestionStatus: "FAILED", error: "Extracted text is empty" };
  }
  return { ok: true, ingestionStatus: "READY", content: text };
}

export async function createKnowledgeDocument(body, { userId, permissions } = {}) {
  if (!canManageKnowledge(permissions)) {
    throw new AppError(403, "Forbidden");
  }
  const chunkContents = chunkDocumentContent(body.content);
  if (chunkContents.length === 0) {
    throw new AppError(400, "content must contain at least one non-empty paragraph");
  }
  if (!KNOWLEDGE_CATEGORIES.includes(body.category)) {
    throw new AppError(400, "Invalid knowledge category");
  }

  const documentKey = body.documentKey || randomUUID();
  const version = body.version || 1;
  const publish = Boolean(body.publish);
  const status = publish ? "PUBLISHED" : "DRAFT";

  const existing = await prisma.knowledgeDocument.findUnique({
    where: { documentKey_version: { documentKey, version } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, "A version with this documentKey already exists");
  }

  const document = await prisma.$transaction(async (tx) => {
    if (publish) {
      await tx.knowledgeDocument.updateMany({
        where: { documentKey, status: "PUBLISHED" },
        data: { status: "ARCHIVED", isActive: false },
      });
    }

    const created = await tx.knowledgeDocument.create({
      data: {
        documentKey,
        title: body.title,
        category: body.category,
        visibility: body.visibility || "INTERNAL",
        status,
        version,
        source: body.source ?? null,
        ownerUserId: userId || null,
        effectiveFrom: body.effectiveFrom ?? null,
        expiresAt: body.expiresAt ?? null,
        lastVerifiedAt: body.lastVerifiedAt ?? (publish ? new Date() : null),
        content: body.content,
        ingestionStatus: "READY",
        isActive: publish,
      },
      select: DOCUMENT_DETAIL_SELECT,
    });

    await tx.knowledgeChunk.createMany({
      data: chunkContents.map((chunkText, ordinal) => ({
        documentId: created.id,
        ordinal,
        content: chunkText,
      })),
    });

    return { ...created, chunkCount: chunkContents.length };
  });

  await writeAudit({
    userId,
    action: publish ? "knowledge.document.publish" : "knowledge.document.create",
    resourceType: "KnowledgeDocument",
    resourceId: document.id,
    metadata: {
      documentKey,
      version,
      category: document.category,
      visibility: document.visibility,
      status: document.status,
    },
  });

  return document;
}

export async function createNewVersion(documentId, body, { userId, permissions } = {}) {
  if (!canManageKnowledge(permissions)) throw new AppError(403, "Forbidden");
  const current = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: DOCUMENT_DETAIL_SELECT,
  });
  if (!current) throw new AppError(404, "Knowledge document not found");

  const max = await prisma.knowledgeDocument.aggregate({
    where: { documentKey: current.documentKey },
    _max: { version: true },
  });
  const nextVersion = (max._max.version || current.version) + 1;

  const categoryMap = {
    VISA: "VISA_RULE",
    CORPORATE: "CORPORATE_TRAVEL_POLICY",
    OTHER: "TRAVEL_POLICY",
  };
  const category = categoryMap[current.category] || current.category;

  return createKnowledgeDocument(
    {
      documentKey: current.documentKey,
      title: body.title || current.title,
      category,
      visibility: body.visibility || current.visibility,
      source: body.source !== undefined ? body.source : current.source,
      version: nextVersion,
      content: body.content,
      effectiveFrom: body.effectiveFrom !== undefined ? body.effectiveFrom : current.effectiveFrom,
      expiresAt: body.expiresAt !== undefined ? body.expiresAt : current.expiresAt,
      lastVerifiedAt: body.lastVerifiedAt ?? null,
      publish: Boolean(body.publish),
    },
    { userId, permissions },
  );
}

export async function publishDocument(documentId, { userId, permissions } = {}) {
  if (!canManageKnowledge(permissions)) throw new AppError(403, "Forbidden");
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: { ...DOCUMENT_LIST_SELECT, content: true, ingestionStatus: true },
  });
  if (!doc) throw new AppError(404, "Knowledge document not found");
  if (doc.ingestionStatus !== "READY") {
    throw new AppError(400, `Cannot publish: ingestionStatus=${doc.ingestionStatus}`);
  }
  if (!doc.content?.trim()) {
    throw new AppError(400, "Cannot publish empty content");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocument.updateMany({
      where: {
        documentKey: doc.documentKey,
        status: "PUBLISHED",
        id: { not: documentId },
      },
      data: { status: "ARCHIVED", isActive: false },
    });
    return tx.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: "PUBLISHED",
        isActive: true,
        lastVerifiedAt: new Date(),
      },
      select: DOCUMENT_DETAIL_SELECT,
    });
  });

  await writeAudit({
    userId,
    action: "knowledge.document.publish",
    resourceType: "KnowledgeDocument",
    resourceId: documentId,
    metadata: { documentKey: doc.documentKey, version: doc.version },
  });

  return updated;
}

export async function archiveDocument(documentId, { userId, permissions } = {}) {
  if (!canManageKnowledge(permissions)) throw new AppError(403, "Forbidden");
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: { id: true, documentKey: true, version: true },
  });
  if (!doc) throw new AppError(404, "Knowledge document not found");

  const updated = await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: "ARCHIVED", isActive: false },
    select: DOCUMENT_DETAIL_SELECT,
  });

  await writeAudit({
    userId,
    action: "knowledge.document.archive",
    resourceType: "KnowledgeDocument",
    resourceId: documentId,
    metadata: { documentKey: doc.documentKey, version: doc.version },
  });

  return updated;
}

export async function updateMetadata(documentId, body, { userId, permissions } = {}) {
  if (!canManageKnowledge(permissions)) throw new AppError(403, "Forbidden");
  const existing = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Knowledge document not found");

  const updated = await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.effectiveFrom !== undefined ? { effectiveFrom: body.effectiveFrom } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
      ...(body.lastVerifiedAt !== undefined ? { lastVerifiedAt: body.lastVerifiedAt } : {}),
    },
    select: DOCUMENT_DETAIL_SELECT,
  });

  await writeAudit({
    userId,
    action: "knowledge.document.update",
    resourceType: "KnowledgeDocument",
    resourceId: documentId,
    metadata: { fields: Object.keys(body || {}) },
  });

  return updated;
}

export async function getKnowledgeDocument(documentId, { permissions } = {}) {
  if (!canReadKnowledgeAdmin(permissions)) {
    throw new AppError(403, "Forbidden");
  }
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: {
      ...DOCUMENT_DETAIL_SELECT,
      chunks: {
        orderBy: { ordinal: "asc" },
        select: { id: true, ordinal: true, content: true },
      },
    },
  });
  if (!doc) throw new AppError(404, "Knowledge document not found");
  return { ...doc, chunkCount: doc.chunks.length };
}

export async function listKnowledgeDocuments(query = {}, { permissions } = {}) {
  if (!canReadKnowledgeAdmin(permissions)) {
    throw new AppError(403, "Forbidden");
  }
  await expireDueDocuments();

  const take = Math.min(query.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = query.page || 1;
  const skip = (currentPage - 1) * take;

  const where = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.documentKey ? { documentKey: query.documentKey } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { content: { contains: query.q, mode: "insensitive" } },
            { source: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take,
      select: { ...DOCUMENT_LIST_SELECT, _count: { select: { chunks: true } } },
    }),
    prisma.knowledgeDocument.count({ where }),
  ]);

  return {
    items: items.map(({ _count, ...doc }) => ({ ...doc, chunkCount: _count.chunks })),
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

/**
 * Retrieve published, currently-valid knowledge with permission-aware visibility.
 * Deterministic keyword/term-overlap — not vector search.
 */
export async function retrieveKnowledge({
  query,
  limit,
  categories,
  permissions = { global: [], byCompany: {} },
  mode = "ava",
} = {}) {
  await expireDueDocuments();

  const terms = tokenize(query);
  const take = Math.min(limit || DEFAULT_RETRIEVE_LIMIT, 20);
  if (terms.length === 0) {
    return {
      hits: [],
      coverage: "none",
      possibleConflict: false,
      retrievalMethod: "keyword_overlap",
      retrievedAt: new Date().toISOString(),
    };
  }

  const visibilities = allowedVisibilitiesForRetrieve(permissions, mode);
  const now = new Date();

  const candidates = await prisma.knowledgeChunk.findMany({
    where: {
      document: {
        status: "PUBLISHED",
        isActive: true,
        ingestionStatus: "READY",
        visibility: { in: visibilities },
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
        ...(categories?.length ? { category: { in: categories } } : {}),
      },
      OR: terms.map((term) => ({ content: { contains: term, mode: "insensitive" } })),
    },
    select: {
      id: true,
      documentId: true,
      ordinal: true,
      content: true,
      document: {
        select: {
          documentKey: true,
          title: true,
          category: true,
          visibility: true,
          version: true,
          status: true,
          lastVerifiedAt: true,
          effectiveFrom: true,
          expiresAt: true,
          source: true,
        },
      },
    },
    take: CANDIDATE_POOL_SIZE,
  });

  const isOps = isOpsRetrieve(permissions, mode) || canReadKnowledgeAdmin(permissions);

  const scored = candidates
    .filter((c) => isCurrentlyValid({ ...c.document, ingestionStatus: "READY", status: "PUBLISHED" }, now))
    .map((chunk) => {
      const chunkTermSet = new Set(tokenize(chunk.content));
      const matchedCount = terms.filter((t) => chunkTermSet.has(t)).length;
      let score = matchedCount / terms.length;

      const disclose =
        chunk.document.visibility === "CUSTOMER_SAFE"
          ? "full"
          : chunk.document.visibility === "INTERNAL"
            ? isOps
              ? "full"
              : "summary_only"
            : isOps
              ? "full"
              : "hidden";

      // Customers never see RESTRICTED content text
      if (disclose === "hidden") return null;

      // summary_only: title/category guidance only — never dump INTERNAL source text
      const safeSummary = `[INTERNAL summary] ${chunk.document.title} (${chunk.document.category} v${chunk.document.version}) — use as guidance only; do not invent policy details.`;

      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentKey: chunk.document.documentKey,
        title: chunk.document.title,
        content: disclose === "full" ? chunk.content : null,
        excerpt: disclose === "full" ? chunk.content : safeSummary,
        category: chunk.document.category,
        visibility: chunk.document.visibility,
        version: chunk.document.version,
        source: isOps ? chunk.document.source : null,
        lastVerifiedAt: chunk.document.lastVerifiedAt,
        effectiveFrom: chunk.document.effectiveFrom,
        expiresAt: chunk.document.expiresAt,
        ordinal: chunk.ordinal,
        disclose,
        score: Math.round(score * 1000) / 1000,
      };
    })
    .filter(Boolean);

  const hits = scored
    .filter((h) => h.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score || b.version - a.version)
    .slice(0, take);

  // Prefer higher version of same documentKey if both appear
  const byKey = new Map();
  for (const h of hits) {
    const prev = byKey.get(h.documentKey);
    if (!prev || h.version > prev.version || (h.version === prev.version && h.score > prev.score)) {
      byKey.set(h.documentKey, h);
    }
  }
  const deduped = Array.from(byKey.values()).sort((a, b) => b.score - a.score);

  const coverage =
    deduped.length === 0
      ? "none"
      : deduped[0].score >= HIGH_COVERAGE_THRESHOLD
        ? "high"
        : "low";

  let possibleConflict = false;
  if (deduped.length >= 2) {
    const top = deduped[0];
    const rival = deduped.find(
      (h) => h.documentKey !== top.documentKey && Math.abs(h.score - top.score) <= CONFLICT_SCORE_DELTA,
    );
    possibleConflict = Boolean(rival);
  }

  return {
    hits: deduped,
    coverage,
    possibleConflict,
    retrievalMethod: "keyword_overlap",
    retrievedAt: new Date().toISOString(),
  };
}

/** Ava grounding block — never invents policy when coverage is none. */
export async function buildAvaKnowledgeGuidance(permissions, query) {
  if (!query || !String(query).trim()) {
    return {
      promptBlock:
        "KNOWLEDGE: No query — do not invent FlightOne SOPs, airline policies, supplier rules, contracts, or visa procedures.",
      coverage: "none",
      hits: [],
    };
  }

  const result = await retrieveKnowledge({
    query,
    limit: 5,
    permissions,
    mode: "ava",
  });

  if (result.coverage === "none" || !result.hits.length) {
    return {
      promptBlock: [
        "KNOWLEDGE: No relevant PUBLISHED FlightOne internal knowledge found for this question.",
        "Do NOT invent SOPs, airline policies, supplier rules, contracts, corporate agreements, or visa procedures.",
        "Say internal knowledge is unavailable. Offer human escalation (Module 13) when the user needs a policy decision.",
      ].join(" "),
      coverage: "none",
      hits: [],
      possibleConflict: false,
      retrievalMethod: result.retrievalMethod,
    };
  }

  const lines = result.hits.map((h, i) => {
    const body =
      h.disclose === "full"
        ? h.content
        : `(INTERNAL — summarize only, do not quote or dump source text) ${h.excerpt || ""}`;
    return `[${i + 1}] ${h.title} v${h.version} (${h.category}, ${h.visibility}, doc=${h.documentId}): ${body}`;
  });

  const conflictNote = result.possibleConflict
    ? " CONFLICT: Multiple published sources scored similarly — do not silently pick one; say the answer is uncertain and offer escalation."
    : "";

  return {
    promptBlock: [
      "KNOWLEDGE (Module 16 — published FlightOne sources only):",
      ...lines,
      "Answer ONLY from these sources. Cite title + version. Never override live booking/pricing/refund/visa assessment modules with this text.",
      "Never reveal RESTRICTED or confidential contract/SOP wording to customers; summarize INTERNAL as customer-safe guidance only.",
      conflictNote,
    ]
      .filter(Boolean)
      .join(" "),
    coverage: result.coverage,
    hits: result.hits.map((h) => ({
      documentId: h.documentId,
      documentKey: h.documentKey,
      title: h.title,
      version: h.version,
      category: h.category,
      visibility: h.visibility,
      score: h.score,
      disclose: h.disclose,
    })),
    possibleConflict: result.possibleConflict,
    retrievalMethod: result.retrievalMethod,
    retrievedAt: result.retrievedAt,
  };
}

export { replaceChunks, expireDueDocuments, isCurrentlyValid };
