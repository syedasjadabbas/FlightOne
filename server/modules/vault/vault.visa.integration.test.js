/**
 * Phase 2 Visa Vault — visa metadata CRUD, ownership, and expiry overlay.
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

const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fo-visa-vault-"));
process.env.VAULT_STORAGE_PROVIDER = "local";
process.env.VAULT_LOCAL_ROOT = vaultRoot;
process.env.VISA_PROVIDER = "catalog";

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");
const vaultService = await import("./vault.service.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.visavault.${label}.${suffix}@example.com`,
      name: `VisaVault ${label}`,
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

const tinyPdfB64 = Buffer.from("%PDF-1.4 visa-vault-test").toString("base64");

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await prisma.visaRequirement.upsert({
    where: {
      nationalityCode_destinationCode: { nationalityCode: "PK", destinationCode: "AE" },
    },
    update: {
      category: "VOA",
      source: "test-catalog",
      lastVerifiedAt: new Date(),
      isActive: true,
      embassyInfo: { name: "UAE Embassy (test catalog)", address: "Test Street" },
      processingDaysMin: 3,
      processingDaysMax: 7,
      requiredDocuments: ["Passport valid 6+ months"],
    },
    create: {
      nationalityCode: "PK",
      destinationCode: "AE",
      category: "VOA",
      source: "test-catalog",
      lastVerifiedAt: new Date(),
      embassyInfo: { name: "UAE Embassy (test catalog)", address: "Test Street" },
      processingDaysMin: 3,
      processingDaysMax: 7,
      requiredDocuments: ["Passport valid 6+ months"],
    },
  });
});

after(async () => {
  for (const id of users) {
    await prisma.vaultShareLink.deleteMany({ where: { createdByUserId: id } }).catch(() => {});
    await prisma.vaultVisaRecord
      .deleteMany({ where: { document: { ownerUserId: id } } })
      .catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.visaApplication.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.travellerIdentityDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.travellerProfile.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
  await fs.rm(vaultRoot, { recursive: true, force: true }).catch(() => {});
});

describe("Visa Vault Phase 2", () => {
  it("rejects unauthenticated visa upload", async () => {
    const unauth = await httpRequest("POST", "/api/v1/vault/upload", {
      body: {
        type: "VISA",
        title: "Visa",
        contentType: "application/pdf",
        originalFilename: "visa.pdf",
        contentBase64: tinyPdfB64,
        visaMeta: { destinationCode: "AE" },
      },
    });
    assert.equal(unauth.status, 401);
  });

  it("stores visa metadata on upload and strips storage secrets", async () => {
    const user = await createUser("up");
    const up = await httpRequest("POST", "/api/v1/vault/upload", {
      headers: authHeader(user),
      body: {
        type: "VISA",
        title: "UAE visit visa",
        contentType: "application/pdf",
        originalFilename: "uae-visa.pdf",
        contentBase64: tinyPdfB64,
        issueDate: "2026-01-01T00:00:00.000Z",
        expiresAt: "2028-01-01T00:00:00.000Z",
        visaMeta: {
          destinationCode: "ae",
          visaType: "tourist",
          holderStatus: "ISSUED",
          issuingAuthority: "UAE Embassy Islamabad",
        },
      },
    });
    assert.equal(up.status, 201);
    assert.equal(up.body.data.type, "VISA");
    assert.equal(up.body.data.visaMeta.destinationCode, "AE");
    assert.equal(up.body.data.visaMeta.visaType, "tourist");
    assert.equal(up.body.data.visaMeta.visaStatus, "ISSUED");
    assert.equal(up.body.data.storageKey, undefined);
    assert.equal(up.body.data.contentSha256, undefined);
    assert.equal(up.body.data.encryptedNote, undefined);
    assert.ok(!JSON.stringify(up.body).includes(vaultRoot));
  });

  it("rejects visaMeta on non-visa documents", async () => {
    const user = await createUser("novisa");
    const res = await httpRequest("POST", "/api/v1/vault/", {
      headers: authHeader(user),
      body: {
        type: "PASSPORT",
        title: "P",
        visaMeta: { destinationCode: "AE" },
      },
    });
    assert.ok(res.status === 400 || res.status === 422);
  });

  it("blocks cross-user visa document access", async () => {
    const a = await createUser("xa");
    const b = await createUser("xb");
    const created = await vaultService.uploadDocument(a.id, {}, {
      type: "VISA",
      title: "Secret visa",
      contentType: "application/pdf",
      originalFilename: "visa.pdf",
      contentBase64: tinyPdfB64,
      visaMeta: { destinationCode: "US" },
    });

    const get = await httpRequest("GET", `/api/v1/vault/${created.id}`, {
      headers: authHeader(b),
    });
    assert.equal(get.status, 404);

    const patch = await httpRequest("PATCH", `/api/v1/vault/${created.id}`, {
      headers: authHeader(b),
      body: { visaMeta: { destinationCode: "GB" } },
    });
    assert.equal(patch.status, 404);

    const del = await httpRequest("DELETE", `/api/v1/vault/${created.id}`, {
      headers: authHeader(b),
    });
    assert.equal(del.status, 404);
  });

  it("owner can edit visa metadata in place and read attributed overlay without invention", async () => {
    const user = await createUser("edit");
    await prisma.travellerProfile.create({
      data: { userId: user.id, displayName: "Traveller", nationality: "PK" },
    });
    const created = await vaultService.createDocument(user.id, {}, {
      type: "VISA",
      title: "UAE visa",
      expiresAt: new Date("2027-06-01"),
      visaMeta: { destinationCode: "AE", visaType: "tourist" },
    });

    const patched = await httpRequest("PATCH", `/api/v1/vault/${created.id}`, {
      headers: authHeader(user),
      body: {
        visaMeta: {
          holderStatus: "IN_PROCESS",
          appointmentLocation: "Abu Dhabi VAC",
        },
      },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.id, created.id);
    assert.equal(patched.body.data.version, 1);
    assert.equal(patched.body.data.visaMeta.holderStatus, "IN_PROCESS");
    assert.equal(patched.body.data.visaMeta.appointmentLocation, "Abu Dhabi VAC");
    assert.equal(patched.body.data.visaMeta.destinationCode, "AE");

    const detail = await httpRequest("GET", `/api/v1/vault/${created.id}`, {
      headers: authHeader(user),
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.visaIntelligence.isFact, true);
    assert.equal(detail.body.data.visaIntelligence.category, "VOA");
    assert.equal(
      detail.body.data.visaIntelligence.embassyInfo.name,
      "UAE Embassy (test catalog)",
    );
    assert.equal(detail.body.data.visaIntelligence.processingDaysMax, 7);
  });

  it("does not invent embassy data when destination has no catalog row", async () => {
    const user = await createUser("unknown");
    await prisma.travellerProfile.create({
      data: { userId: user.id, displayName: "Traveller", nationality: "PK" },
    });
    const created = await vaultService.createDocument(user.id, {}, {
      type: "VISA",
      title: "Unknown dest",
      visaMeta: { destinationCode: "ZZ" },
    });
    const detail = await vaultService.getDocumentById(user.id, {}, created.id);
    assert.equal(detail.visaIntelligence.dataStatus, "DATA_UNAVAILABLE");
    assert.equal(detail.visaIntelligence.isFact, false);
    assert.equal(detail.visaIntelligence.embassyInfo, null);
    assert.equal(detail.visaIntelligence.processingDaysMax, null);
  });

  it("filters visa documents by destination and marks expired status", async () => {
    const user = await createUser("list");
    await vaultService.createDocument(user.id, {}, {
      type: "VISA",
      title: "AE visa",
      expiresAt: new Date("2020-01-01"),
      visaMeta: { destinationCode: "AE" },
    });
    await vaultService.createDocument(user.id, {}, {
      type: "VISA",
      title: "US visa",
      expiresAt: new Date("2028-01-01"),
      visaMeta: { destinationCode: "US" },
    });
    const listed = await vaultService.listMyDocuments(user.id, { destinationCode: "AE" });
    assert.equal(listed.total, 1);
    assert.equal(listed.items[0].visaMeta.destinationCode, "AE");
    assert.equal(listed.items[0].visaMeta.visaStatus, "EXPIRED");
    assert.equal(listed.items[0].expiryStatus, "expired");
  });

  it("soft-deletes visa documents for the owner only", async () => {
    const user = await createUser("del");
    const created = await vaultService.uploadDocument(user.id, {}, {
      type: "VISA",
      title: "To delete",
      contentType: "application/pdf",
      originalFilename: "visa.pdf",
      contentBase64: tinyPdfB64,
      visaMeta: { destinationCode: "SA" },
    });
    const del = await httpRequest("DELETE", `/api/v1/vault/${created.id}`, {
      headers: authHeader(user),
    });
    assert.equal(del.status, 200);
    assert.equal(del.body.data.isActive, false);

    const list = await vaultService.listMyDocuments(user.id);
    assert.equal(list.items.some((d) => d.id === created.id), false);
  });

  it("cannot link another user's visa application", async () => {
    const a = await createUser("app-a");
    const b = await createUser("app-b");
    const appB = await prisma.visaApplication.create({
      data: {
        userId: b.id,
        nationalityCode: "PK",
        destinationCode: "AE",
      },
    });
    await assert.rejects(
      () =>
        vaultService.createDocument(a.id, {}, {
          type: "VISA",
          title: "Steal app",
          visaMeta: { visaApplicationId: appB.id, destinationCode: "AE" },
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("rejects executable uploads for visa files", async () => {
    const user = await createUser("exe");
    const bad = await httpRequest("POST", "/api/v1/vault/upload", {
      headers: authHeader(user),
      body: {
        type: "VISA",
        title: "bad",
        contentType: "application/x-msdownload",
        originalFilename: "visa.exe",
        contentBase64: Buffer.from("MZ").toString("base64"),
        visaMeta: { destinationCode: "AE" },
      },
    });
    assert.equal(bad.status, 400);
  });
});
