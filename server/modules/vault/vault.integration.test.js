/**
 * Module 07 — Traveller Vault security + lifecycle integration tests.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

dotenv.config();

process.env.FLIGHTONE_API_LISTEN = "false";
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fo-vault-int-"));
process.env.VAULT_STORAGE_PROVIDER = "local";
process.env.VAULT_LOCAL_ROOT = vaultRoot;

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");
const vaultService = await import("./vault.service.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.vault.${label}.${suffix}@example.com`,
      name: `Vault ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

function authHeader(user) {
  const token = signAccessToken({ sub: user.id, email: user.email });
  return { Authorization: `Bearer ${token}` };
}

function httpRequest(method, pathName, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
          method,
          headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          resolve({ status: res.status, body: json, headers: res.headers });
        } else {
          const buf = Buffer.from(await res.arrayBuffer());
          resolve({ status: res.status, body: buf, headers: res.headers });
        }
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
  });
}

const tinyPdfB64 = Buffer.from("%PDF-1.4 vault-test").toString("base64");

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of users) {
    await prisma.vaultShareLink
      .deleteMany({ where: { createdByUserId: id } })
      .catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.travellerIdentityDocument
      .deleteMany({ where: { ownerUserId: id } })
      .catch(() => {});
    await prisma.travellerCompanion.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
  await fs.rm(vaultRoot, { recursive: true, force: true }).catch(() => {});
});

describe("vault Module 07", () => {
  it("exposes capability and rejects unauthenticated upload", async () => {
    const cap = await httpRequest("GET", "/api/v1/vault/capability", {
      headers: authHeader(await createUser("cap")),
    });
    assert.equal(cap.status, 200);
    assert.equal(cap.body.data.configured, true);
    assert.equal(cap.body.data.canUpload, true);

    const unauth = await httpRequest("POST", "/api/v1/vault/upload", {
      body: {
        type: "PASSPORT",
        title: "P",
        contentType: "application/pdf",
        originalFilename: "p.pdf",
        contentBase64: tinyPdfB64,
      },
    });
    assert.equal(unauth.status, 401);
  });

  it("authenticated upload + download; strips storageKey from responses", async () => {
    const user = await createUser("up");
    const up = await httpRequest("POST", "/api/v1/vault/upload", {
      headers: authHeader(user),
      body: {
        type: "PASSPORT",
        title: "My passport",
        contentType: "application/pdf",
        originalFilename: "passport.pdf",
        contentBase64: tinyPdfB64,
        expiresAt: "2031-01-01T00:00:00.000Z",
      },
    });
    assert.equal(up.status, 201);
    assert.equal(up.body.data.hasBinary, true);
    assert.equal(up.body.data.storageKey, undefined);
    assert.equal(up.body.data.contentSha256, undefined);
    assert.equal(up.body.data.encryptedNote, undefined);
    assert.ok(String(up.body.data.fileUrl || "").startsWith("local://"));
    assert.ok(!String(JSON.stringify(up.body)).includes(vaultRoot));

    const dl = await httpRequest("GET", `/api/v1/vault/${up.body.data.id}/download`, {
      headers: authHeader(user),
    });
    assert.equal(dl.status, 200);
    assert.ok(Buffer.isBuffer(dl.body));
    assert.equal(dl.body.toString(), "%PDF-1.4 vault-test");
  });

  it("blocks cross-user retrieval and download", async () => {
    const a = await createUser("xa");
    const b = await createUser("xb");
    const created = await vaultService.uploadDocument(a.id, {}, {
      type: "VISA",
      title: "Visa",
      contentType: "application/pdf",
      originalFilename: "visa.pdf",
      contentBase64: tinyPdfB64,
    });

    const get = await httpRequest("GET", `/api/v1/vault/${created.id}`, {
      headers: authHeader(b),
    });
    assert.equal(get.status, 404);

    const dl = await httpRequest("GET", `/api/v1/vault/${created.id}/download`, {
      headers: authHeader(b),
    });
    assert.equal(dl.status, 404);
  });

  it("rejects invalid MIME and oversized payloads", async () => {
    const user = await createUser("bad");
    const badType = await httpRequest("POST", "/api/v1/vault/upload", {
      headers: authHeader(user),
      body: {
        type: "OTHER",
        title: "exe",
        contentType: "application/x-msdownload",
        originalFilename: "x.exe",
        contentBase64: Buffer.from("MZ").toString("base64"),
      },
    });
    assert.equal(badType.status, 400);

    const huge = Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString("base64");
    const badSize = await httpRequest("POST", "/api/v1/vault/upload", {
      headers: authHeader(user),
      body: {
        type: "OTHER",
        title: "huge",
        contentType: "application/pdf",
        originalFilename: "huge.pdf",
        contentBase64: huge,
      },
    });
    // Service rejects at 400; Express may also reject earlier at 413 if body limit is lower.
    assert.ok([400, 413].includes(badSize.status));

    await assert.rejects(
      () =>
        vaultService.uploadDocument(user.id, {}, {
          type: "OTHER",
          title: "huge-svc",
          contentType: "application/pdf",
          originalFilename: "huge.pdf",
          contentBase64: Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString("base64"),
        }),
      (err) => err.statusCode === 400,
    );
  });

  it("rejects metadata tampering of storage/ownership fields", async () => {
    const user = await createUser("tamp");
    const created = await vaultService.createDocument(user.id, {}, {
      type: "INSURANCE",
      title: "Policy",
    });
    await assert.rejects(
      () =>
        vaultService.updateDocument(user.id, {}, created.id, {
          storageKey: "hack/key",
        }),
      (err) => err.statusCode === 400,
    );

    const httpTamper = await httpRequest("POST", "/api/v1/vault/", {
      headers: authHeader(user),
      body: {
        type: "OTHER",
        title: "x",
        contentBase64: tinyPdfB64,
      },
    });
    // strict schema rejects unknown/binary fields on metadata create
    assert.ok(httpTamper.status === 400 || httpTamper.status === 422);
  });

  it("replaces binary and supersedes prior version", async () => {
    const user = await createUser("rep");
    const v1 = await vaultService.uploadDocument(user.id, {}, {
      type: "PASSPORT",
      title: "P",
      contentType: "application/pdf",
      originalFilename: "p.pdf",
      contentBase64: tinyPdfB64,
    });
    const v2 = await vaultService.replaceDocumentBinary(user.id, {}, v1.id, {
      contentType: "application/pdf",
      originalFilename: "p2.pdf",
      contentBase64: Buffer.from("%PDF-replaced").toString("base64"),
    });
    assert.equal(v2.version, 2);
    assert.equal(v2.supersedesId, v1.id);
    assert.equal(v2.hasBinary, true);

    const old = await prisma.vaultDocument.findUnique({ where: { id: v1.id } });
    assert.equal(old.isActive, false);

    await assert.rejects(
      () => vaultService.downloadDocument(user.id, {}, v1.id),
      (err) => err.statusCode === 409,
    );

    const file = await vaultService.downloadDocument(user.id, {}, v2.id);
    assert.equal(file.buffer.toString(), "%PDF-replaced");
  });

  it("blocks companion document linking across users", async () => {
    const a = await createUser("ca");
    const b = await createUser("cb");
    const companionB = await prisma.travellerCompanion.create({
      data: {
        ownerUserId: b.id,
        fullName: "B companion",
        kind: "COMPANION",
      },
    });
    await assert.rejects(
      () =>
        vaultService.createDocument(a.id, {}, {
          type: "PASSPORT",
          title: "Steal",
          companionId: companionB.id,
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("platform ticket ingest is immutable and user-scoped", async () => {
    const a = await createUser("ticket-a");
    const b = await createUser("ticket-b");
    const [ticket] = await vaultService.ingestBookingDocuments({
      userId: a.id,
      bookingId: `bk-${suffix}`,
      product: "FLIGHT",
      ticketNumbers: ["176-111"],
      externalRef: "PNR-REAL",
      currency: "USD",
      amountMinor: 12000,
      travellerSnapshot: { givenName: "Ada", surname: "Lovelace" },
    });
    assert.equal(ticket.type, "TICKET");
    assert.equal(ticket.hasBinary, true);
    assert.equal(ticket.fileMeta?.printableStatus, "stored");
    assert.equal(ticket.fileMeta?.externalRef, "PNR-REAL");

    const file = await vaultService.downloadDocument(a.id, {}, ticket.id);
    assert.ok(file.buffer.toString("utf8").startsWith("%PDF"));
    assert.ok(file.buffer.toString("utf8").includes("PNR-REAL"));
    assert.ok(file.buffer.toString("utf8").includes("176-111"));

    await assert.rejects(
      () => vaultService.updateDocument(a.id, {}, ticket.id, { title: "hack" }),
      (err) => err.statusCode === 409,
    );
    await assert.rejects(
      () => vaultService.deleteDocument(a.id, {}, ticket.id),
      (err) => err.statusCode === 409,
    );
    await assert.rejects(
      () => vaultService.getDocumentById(b.id, {}, ticket.id),
      (err) => err.statusCode === 404,
    );
  });

  it("refuses printable generation without confirmation artifacts", async () => {
    const user = await createUser("no-conf");
    const [ticket] = await vaultService.ingestBookingDocuments({
      userId: user.id,
      bookingId: `bk-noconf-${suffix}`,
      product: "FLIGHT",
      ticketNumbers: null,
      externalRef: null,
    });
    // Still creates metadata stub for FLIGHT product, but no fabricated PDF bytes.
    assert.equal(ticket.type, "TICKET");
    assert.equal(ticket.hasBinary, false);
    assert.equal(ticket.fileMeta?.printableStatus, "insufficient_confirmation");
  });

  it("fail-closed when storage unconfigured (never fakes success)", async () => {
    const prev = process.env.VAULT_STORAGE_PROVIDER;
    process.env.VAULT_STORAGE_PROVIDER = "unconfigured";
    delete process.env.VAULT_LOCAL_ROOT;
    // Re-import capability reads env live — getVaultStorage reads env live.
    const user = await createUser("unconf");
    await assert.rejects(
      () =>
        vaultService.uploadDocument(user.id, {}, {
          type: "OTHER",
          title: "x",
          contentType: "application/pdf",
          originalFilename: "x.pdf",
          contentBase64: tinyPdfB64,
        }),
      (err) => err.statusCode === 503 && err.code === "VAULT_STORAGE_UNCONFIGURED",
    );
    process.env.VAULT_STORAGE_PROVIDER = prev || "local";
    process.env.VAULT_LOCAL_ROOT = vaultRoot;
  });

  it("profile link uses owned vaultDocumentId only", async () => {
    const identityDocumentService = await import(
      "../profile/identityDocument.service.js"
    );
    const a = await createUser("prof-a");
    const b = await createUser("prof-b");
    const vaultA = await vaultService.createDocument(a.id, {}, {
      type: "PASSPORT",
      title: "A",
    });
    const vaultB = await vaultService.createDocument(b.id, {}, {
      type: "PASSPORT",
      title: "B",
    });

    const linked = await identityDocumentService.createIdentityDocument(a.id, {
      type: "PASSPORT",
      documentNumber: "P1",
      vaultDocumentId: vaultA.id,
    });
    assert.equal(linked.vaultDocumentId, vaultA.id);

    await assert.rejects(
      () =>
        identityDocumentService.createIdentityDocument(a.id, {
          type: "VISA",
          documentNumber: "V1",
          vaultDocumentId: vaultB.id,
        }),
      (err) => err.statusCode === 404,
    );
  });
});
