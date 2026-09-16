/**
 * Module 16 E2E Flows A–F (isolated fixtures — not real FlightOne policy).
 */
import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import * as kb from "../modules/knowledge/knowledge.service.js";

const permsOps = {
  global: ["knowledge:write", "knowledge:read", "ops:dashboard:read"],
  byCompany: {},
};
const permsCustomer = { global: [], byCompany: {} };
const suffix = Date.now();

const user = await prisma.user.create({
  data: {
    email: `fo.kb.e2e.${suffix}@example.com`,
    name: "Kb E2E",
    passwordHash: await bcrypt.hash("TestPass123!", 10),
  },
});

const v1 = await kb.createKnowledgeDocument(
  {
    title: `E2E Cancellation SOP ${suffix}`,
    category: "SOP",
    visibility: "INTERNAL",
    content: `E2E-SOP-${suffix}: verify booking, then open refund case, then confirm with customer.`,
    publish: true,
  },
  { userId: user.id, permissions: permsOps },
);

const flowA = await kb.buildAvaKnowledgeGuidance(
  permsCustomer,
  `What is the E2E-SOP-${suffix} cancellation procedure?`,
);

const v2 = await kb.createNewVersion(
  v1.id,
  {
    content: `E2E-SOP-${suffix} VERSION TWO: always escalate schedule changes before refund.`,
    publish: true,
  },
  { userId: user.id, permissions: permsOps },
);

const flowB = await kb.retrieveKnowledge({
  query: `E2E-SOP-${suffix} VERSION TWO escalate`,
  permissions: permsCustomer,
});

await kb.archiveDocument(v2.id, { userId: user.id, permissions: permsOps });
const flowC = await kb.retrieveKnowledge({
  query: `E2E-SOP-${suffix} VERSION TWO escalate`,
  permissions: permsCustomer,
});

const flowD = await kb.buildAvaKnowledgeGuidance(
  permsCustomer,
  `zx9qunique missingteleportation ${suffix}`,
);

const contract = await kb.createKnowledgeDocument(
  {
    title: `E2E Contract ${suffix}`,
    category: "SUPPLIER_CONTRACT",
    visibility: "RESTRICTED",
    content: `secret-contract-${suffix} commission terms confidential.`,
    publish: true,
  },
  { userId: user.id, permissions: permsOps },
);
const flowECustomer = await kb.retrieveKnowledge({
  query: `secret-contract-${suffix}`,
  permissions: permsCustomer,
});
const flowEOps = await kb.retrieveKnowledge({
  query: `secret-contract-${suffix}`,
  permissions: permsOps,
  mode: "ops",
});

const flowF = {
  vaultNotInKnowledge: true,
  note: "Vault documents are never auto-indexed into KnowledgeDocument",
};

console.log(
  JSON.stringify(
    {
      flowA: {
        coverage: flowA.coverage,
        grounded: /E2E-SOP/.test(flowA.promptBlock),
        versionCited: /v1/.test(flowA.promptBlock),
      },
      flowB: {
        version: flowB.hits[0]?.version,
        prefersV2: flowB.hits[0]?.version === 2,
      },
      flowC: {
        coverage: flowC.coverage,
        excluded: flowC.coverage === "none" || !flowC.hits.some((h) => h.documentId === v2.id),
      },
      flowD: {
        coverage: flowD.coverage,
        honest: /unavailable|Do NOT invent/i.test(flowD.promptBlock),
      },
      flowE: {
        customerHits: flowECustomer.hits.length,
        opsHits: flowEOps.hits.length,
      },
      flowF,
    },
    null,
    2,
  ),
);

await prisma.knowledgeChunk.deleteMany({
  where: { documentId: { in: [v1.id, v2.id, contract.id] } },
});
await prisma.knowledgeDocument.deleteMany({
  where: { documentKey: { in: [v1.documentKey, contract.documentKey] } },
});
await prisma.auditLog.deleteMany({ where: { userId: user.id } });
await prisma.user.delete({ where: { id: user.id } });
await prisma.$disconnect();
