/**
 * Module 16 — AI Knowledge Platform integration tests.
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
const kb = await import("./knowledge.service.js");

const suffix = Date.now();
const userIds = [];
const docIds = [];

const permsOps = {
  global: ["knowledge:write", "knowledge:read", "ops:dashboard:read"],
  byCompany: {},
};
const permsCustomer = { global: [], byCompany: {} };

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.kb.${label}.${suffix}@example.com`,
      name: `Kb ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of docIds) {
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: id } }).catch(() => {});
    await prisma.knowledgeDocument.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 16 AI Knowledge Platform", () => {
  it("creates DRAFT then publish; retrieve only published", async () => {
    const user = await createUser("pub");
    const draft = await kb.createKnowledgeDocument(
      {
        title: `Cancellation SOP ${suffix}`,
        category: "SOP",
        visibility: "INTERNAL",
        content:
          "FlightOne cancellation SOP: verify booking status, then open a Module 14 refund case, then confirm with the customer.",
        publish: false,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(draft.id);
    assert.equal(draft.status, "DRAFT");

    let r = await kb.retrieveKnowledge({
      query: "cancellation SOP FlightOne",
      permissions: permsCustomer,
    });
    assert.equal(r.coverage, "none");

    const published = await kb.publishDocument(draft.id, {
      userId: user.id,
      permissions: permsOps,
    });
    assert.equal(published.status, "PUBLISHED");

    r = await kb.retrieveKnowledge({
      query: "cancellation SOP FlightOne",
      permissions: permsCustomer,
    });
    assert.notEqual(r.coverage, "none");
    assert.ok(r.hits.some((h) => h.documentId === draft.id));
    assert.equal(r.retrievalMethod, "keyword_overlap");
  });

  it("version precedence: v2 published preferred over archived v1", async () => {
    const user = await createUser("ver");
    const v1 = await kb.createKnowledgeDocument(
      {
        title: `Baggage policy ${suffix}`,
        category: "AIRLINE_POLICY",
        visibility: "CUSTOMER_SAFE",
        content: "Version one baggage allowance is one bag twenty three kilograms only.",
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(v1.id);

    const v2 = await kb.createNewVersion(
      v1.id,
      {
        content:
          "Version two baggage allowance is two bags thirty two kilograms for business class.",
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(v2.id);
    assert.equal(v2.version, 2);
    assert.equal(v2.status, "PUBLISHED");

    const old = await prisma.knowledgeDocument.findUnique({ where: { id: v1.id } });
    assert.equal(old.status, "ARCHIVED");

    const r = await kb.retrieveKnowledge({
      query: "baggage allowance bags kilograms",
      permissions: permsCustomer,
    });
    assert.ok(r.hits.length >= 1);
    assert.equal(r.hits[0].version, 2);
    assert.ok(r.hits[0].content?.includes("Version two") || r.hits[0].excerpt?.includes("Version two"));
  });

  it("archive excludes from retrieval", async () => {
    const user = await createUser("arch");
    const doc = await kb.createKnowledgeDocument(
      {
        title: `Archive SOP ${suffix}`,
        category: "SOP",
        content: "Unique archive-token-xyz123 must not answer after archive.",
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(doc.id);
    await kb.archiveDocument(doc.id, { userId: user.id, permissions: permsOps });
    const r = await kb.retrieveKnowledge({
      query: "archive-token-xyz123",
      permissions: permsOps,
      mode: "ops",
    });
    assert.ok(!r.hits.some((h) => h.documentId === doc.id));
  });

  it("expired knowledge excluded", async () => {
    const user = await createUser("exp");
    const doc = await kb.createKnowledgeDocument(
      {
        title: `Expired policy ${suffix}`,
        category: "TRAVEL_POLICY",
        content: "Expired-token-abc999 should not be used as current policy.",
        publish: true,
        expiresAt: new Date(Date.now() - 60_000),
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(doc.id);
    const r = await kb.retrieveKnowledge({
      query: "Expired-token-abc999 current policy",
      permissions: permsOps,
      mode: "ops",
    });
    assert.ok(!r.hits.some((h) => h.documentId === doc.id));
  });

  it("RESTRICTED not leaked to customers; ops can retrieve", async () => {
    const user = await createUser("rest");
    const doc = await kb.createKnowledgeDocument(
      {
        title: `Supplier contract ${suffix}`,
        category: "SUPPLIER_CONTRACT",
        visibility: "RESTRICTED",
        content: "Confidential commission-term-secret-7788 must never leak to customers.",
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(doc.id);

    const customer = await kb.retrieveKnowledge({
      query: "commission-term-secret-7788 supplier contract",
      permissions: permsCustomer,
      mode: "ava",
    });
    assert.ok(!customer.hits.some((h) => h.documentId === doc.id));

    const ops = await kb.retrieveKnowledge({
      query: "commission-term-secret-7788 supplier contract",
      permissions: permsOps,
      mode: "ops",
    });
    assert.ok(ops.hits.some((h) => h.documentId === doc.id && h.content?.includes("commission-term-secret-7788")));

    // Client mode=ops without ops permissions must NOT elevate to RESTRICTED
    const forgedOps = await kb.retrieveKnowledge({
      query: "commission-term-secret-7788 supplier contract",
      permissions: permsCustomer,
      mode: "ops",
    });
    assert.ok(!forgedOps.hits.some((h) => h.documentId === doc.id));
  });

  it("INTERNAL summary_only does not dump source text to customers", async () => {
    const user = await createUser("intsum");
    const secret = `internal-sop-secret-${suffix}-never-excerpt`;
    const doc = await kb.createKnowledgeDocument(
      {
        title: `Internal SOP ${suffix}`,
        category: "SOP",
        visibility: "INTERNAL",
        content: `FlightOne internal procedure: ${secret}. Do not expose raw wording.`,
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(doc.id);

    const customer = await kb.retrieveKnowledge({
      query: `Internal SOP ${secret}`,
      permissions: permsCustomer,
      mode: "ava",
    });
    const hit = customer.hits.find((h) => h.documentId === doc.id);
    if (hit) {
      assert.equal(hit.content, null);
      assert.equal(hit.disclose, "summary_only");
      assert.ok(!String(hit.excerpt || "").includes(secret));
    }
  });

  it("customer list/get forbidden; Ava no-knowledge fallback honest", async () => {
    await assert.rejects(
      () => kb.listKnowledgeDocuments({}, { permissions: permsCustomer }),
      (e) => e.statusCode === 403,
    );

    const g = await kb.buildAvaKnowledgeGuidance(
      permsCustomer,
      "What is FlightOne's zygomorphic quantum teleportation policy zx9q-unique?",
    );
    assert.equal(g.coverage, "none");
    assert.match(g.promptBlock, /unavailable|Do NOT invent/i);
  });

  it("category validation rejects non-PRD category", async () => {
    const user = await createUser("cat");
    await assert.rejects(
      () =>
        kb.createKnowledgeDocument(
          {
            title: "Bad",
            category: "OTHER",
            content: "Should fail category check.",
          },
          { userId: user.id, permissions: permsOps },
        ),
      (e) => e.statusCode === 400,
    );
  });

  it("duplicate documentKey+version rejected; publish idempotent archive of peers", async () => {
    const user = await createUser("dup");
    const key = `kb-dup-${suffix}`;
    const a = await kb.createKnowledgeDocument(
      {
        documentKey: key,
        title: "Dup A",
        category: "SOP",
        content: "First version content for duplicate protection test.",
        version: 1,
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(a.id);
    await assert.rejects(
      () =>
        kb.createKnowledgeDocument(
          {
            documentKey: key,
            title: "Dup B",
            category: "SOP",
            content: "Second attempt same version must fail.",
            version: 1,
          },
          { userId: user.id, permissions: permsOps },
        ),
      (e) => e.statusCode === 409,
    );
  });

  it("Ava guidance cites published source with version", async () => {
    const user = await createUser("ava");
    const doc = await kb.createKnowledgeDocument(
      {
        title: `Corporate travel policy ${suffix}`,
        category: "CORPORATE_TRAVEL_POLICY",
        visibility: "INTERNAL",
        content:
          "Corporate travel policy requires advance approval for business class on flights under six hours.",
        publish: true,
      },
      { userId: user.id, permissions: permsOps },
    );
    docIds.push(doc.id);
    const g = await kb.buildAvaKnowledgeGuidance(
      permsCustomer,
      "What is our corporate travel policy for business class?",
    );
    assert.notEqual(g.coverage, "none");
    assert.match(g.promptBlock, /Corporate travel policy/i);
    assert.match(g.promptBlock, /v1/);
    assert.ok(g.hits.some((h) => h.disclose === "summary_only" || h.disclose === "full"));
  });

  it("extractTextFromUpload empty fails without indexing", () => {
    const r = kb.extractTextFromUpload({
      filename: "empty.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("   "),
    });
    assert.equal(r.ok, false);
    assert.equal(r.ingestionStatus, "FAILED");
  });
});
