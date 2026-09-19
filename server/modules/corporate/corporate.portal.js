/**
 * Phase 3 white-label corporate portal — branding, custom domain, SSO config.
 * Never marks a domain VERIFIED or SSO live without a real provider.
 */
import crypto from "node:crypto";
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { encryptField } from "../../lib/fieldEncryption.js";
import { requireCompanyMembership } from "./corporate.service.js";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const HOSTNAME = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

const PORTAL_SELECT = {
  companyId: true,
  portalName: true,
  displayName: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  portalEnabled: true,
  hostname: true,
  domainStatus: true,
  domainVerificationToken: true,
  domainVerifiedAt: true,
  domainReason: true,
  ssoProviderType: true,
  ssoIssuer: true,
  ssoClientId: true,
  ssoClientSecretEnc: true,
  ssoMetadataUrl: true,
  ssoEnabled: true,
  ssoStatus: true,
  ssoReason: true,
  updatedAt: true,
  createdAt: true,
};

function auditPortal(userId, action, resourceId, metadata) {
  return writeAudit({
    userId,
    action,
    resourceType: "CompanyPortal",
    resourceId,
    metadata: metadata ?? null,
  }).catch(() => {});
}

export function getDomainVerifyCapability(env = process.env) {
  const provider = (env.CORPORATE_DOMAIN_VERIFY_PROVIDER || "unconfigured").trim().toLowerCase();
  const url = (env.CORPORATE_DOMAIN_VERIFY_HTTP_URL || "").trim();
  if (provider === "http" && url) {
    return {
      provider: "http",
      configured: true,
      reason: null,
    };
  }
  return {
    provider: provider === "http" ? "http" : "unconfigured",
    configured: false,
    reason:
      "Custom-domain verification is not configured. FlightOne will not mark a hostname as verified without a DNS/SSL check.",
  };
}

export function getSsoCapability(env = process.env) {
  const provider = (env.CORPORATE_SSO_PROVIDER || "unconfigured").trim().toLowerCase();
  if (provider === "oidc" || provider === "saml" || provider === "http") {
    const issuer = (env.CORPORATE_SSO_ISSUER || "").trim();
    if (!issuer) {
      return {
        provider,
        configured: false,
        available: false,
        reason: "SSO provider is named but issuer/metadata is missing. Sign-in will not succeed.",
      };
    }
    return {
      provider,
      configured: true,
      available: true,
      reason: null,
    };
  }
  return {
    provider: "unconfigured",
    configured: false,
    available: false,
    reason: "Corporate SSO is not configured. FlightOne will not fake a successful identity-provider login.",
  };
}

function toPublicPortal(row, { includeDomainToken = false } = {}) {
  if (!row) return null;
  return {
    companyId: row.companyId,
    branding: {
      portalName: row.portalName,
      displayName: row.displayName,
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      enabled: row.portalEnabled,
    },
    domain: {
      hostname: row.hostname,
      status: row.domainStatus,
      verifiedAt: row.domainVerifiedAt,
      reason: row.domainReason,
      verificationToken: includeDomainToken ? row.domainVerificationToken : null,
      capability: getDomainVerifyCapability(),
    },
    sso: {
      providerType: row.ssoProviderType,
      issuer: row.ssoIssuer,
      clientId: row.ssoClientId,
      metadataUrl: row.ssoMetadataUrl,
      enabled: row.ssoEnabled,
      status: row.ssoStatus,
      reason: row.ssoReason,
      hasClientSecret: Boolean(row.ssoClientSecretEnc),
      capability: getSsoCapability(),
    },
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

async function ensurePortal(company) {
  const existing = await prisma.companyPortal.findUnique({
    where: { companyId: company.id },
    select: PORTAL_SELECT,
  });
  if (existing) return existing;
  const cap = getDomainVerifyCapability();
  const ssoCap = getSsoCapability();
  return prisma.companyPortal.create({
    data: {
      companyId: company.id,
      portalName: company.name,
      displayName: company.name,
      domainStatus: "UNCONFIGURED",
      domainReason: cap.reason,
      ssoStatus: "UNCONFIGURED",
      ssoReason: ssoCap.reason,
    },
    select: PORTAL_SELECT,
  });
}

export async function getCompanyPortal(userId, companyId) {
  const membership = await requireCompanyMembership(userId, companyId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError(404, "Company not found");
  const row = await ensurePortal(company);
  return toPublicPortal(row, { includeDomainToken: membership.role === "ADMIN" });
}

export async function updateCompanyBranding(userId, companyId, body = {}) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN"] });
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError(404, "Company not found");
  await ensurePortal(company);

  const data = {};
  if (body.portalName != null) data.portalName = String(body.portalName).trim().slice(0, 120);
  if (body.displayName !== undefined) {
    data.displayName = body.displayName ? String(body.displayName).trim().slice(0, 120) : null;
  }
  if (body.logoUrl !== undefined) {
    const url = body.logoUrl ? String(body.logoUrl).trim() : "";
    if (url && !/^https:\/\//i.test(url)) {
      throw new AppError(400, "logoUrl must be an https URL");
    }
    data.logoUrl = url || null;
  }
  if (body.primaryColor !== undefined) {
    if (body.primaryColor && !HEX_COLOR.test(body.primaryColor)) {
      throw new AppError(400, "primaryColor must be #RRGGBB");
    }
    data.primaryColor = body.primaryColor || null;
  }
  if (body.secondaryColor !== undefined) {
    if (body.secondaryColor && !HEX_COLOR.test(body.secondaryColor)) {
      throw new AppError(400, "secondaryColor must be #RRGGBB");
    }
    data.secondaryColor = body.secondaryColor || null;
  }
  if (body.portalEnabled != null) data.portalEnabled = Boolean(body.portalEnabled);

  const row = await prisma.companyPortal.update({
    where: { companyId },
    data,
    select: PORTAL_SELECT,
  });
  await auditPortal(userId, "corporate.portal.branding.update", companyId, {
    companyId,
    fields: Object.keys(data),
  });
  return toPublicPortal(row, { includeDomainToken: true });
}

export async function configureCustomDomain(userId, companyId, { hostname } = {}) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN"] });
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError(404, "Company not found");
  await ensurePortal(company);

  const host = hostname ? String(hostname).trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] : "";
  if (!host || !HOSTNAME.test(host)) {
    throw new AppError(400, "hostname must be a valid domain");
  }

  const cap = getDomainVerifyCapability();
  const token = crypto.randomBytes(16).toString("hex");
  const row = await prisma.companyPortal.update({
    where: { companyId },
    data: {
      hostname: host,
      domainStatus: "PENDING",
      domainVerificationToken: token,
      domainVerifiedAt: null,
      domainReason: cap.configured
        ? "Hostname saved. Verification is pending a provider check."
        : cap.reason,
    },
    select: PORTAL_SELECT,
  }).catch((e) => {
    if (e.code === "P2002") {
      throw new AppError(409, "That hostname is already claimed");
    }
    throw e;
  });
  await auditPortal(userId, "corporate.portal.domain.configure", companyId, {
    companyId,
    hostname: host,
    status: row.domainStatus,
  });
  return toPublicPortal(row, { includeDomainToken: true });
}

export async function verifyCustomDomain(userId, companyId) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN"] });
  const row = await prisma.companyPortal.findUnique({
    where: { companyId },
    select: PORTAL_SELECT,
  });
  if (!row?.hostname) {
    throw new AppError(400, "Configure a hostname before verification");
  }
  const cap = getDomainVerifyCapability();
  if (!cap.configured) {
    const updated = await prisma.companyPortal.update({
      where: { companyId },
      data: {
        domainStatus: "PENDING",
        domainVerifiedAt: null,
        domainReason: cap.reason,
      },
      select: PORTAL_SELECT,
    });
    await auditPortal(userId, "corporate.portal.domain.verify", companyId, {
      companyId,
      status: updated.domainStatus,
      configured: false,
    });
    return toPublicPortal(updated, { includeDomainToken: true });
  }

  const url = (process.env.CORPORATE_DOMAIN_VERIFY_HTTP_URL || "").trim();
  const key = (process.env.CORPORATE_DOMAIN_VERIFY_HTTP_API_KEY || "").trim();
  let verified = false;
  let reason = "Domain verification provider did not confirm this hostname.";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        hostname: row.hostname,
        token: row.domainVerificationToken,
        companyId,
      }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      verified = Boolean(body && body.verified === true);
      if (typeof body?.reason === "string" && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 240);
      } else if (verified) {
        reason = null;
      }
    } else {
      reason = "Domain verification provider rejected the check.";
    }
  } catch {
    reason = "Domain verification provider is unavailable.";
  }

  const updated = await prisma.companyPortal.update({
    where: { companyId },
    data: {
      domainStatus: verified ? "VERIFIED" : "FAILED",
      domainVerifiedAt: verified ? new Date() : null,
      domainReason: reason,
    },
    select: PORTAL_SELECT,
  });
  await auditPortal(userId, "corporate.portal.domain.verify", companyId, {
    companyId,
    status: updated.domainStatus,
  });
  return toPublicPortal(updated, { includeDomainToken: true });
}

export async function updateCompanySso(userId, companyId, body = {}) {
  await requireCompanyMembership(userId, companyId, { allowedRoles: ["ADMIN"] });
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError(404, "Company not found");
  await ensurePortal(company);

  const data = {};
  if (body.providerType !== undefined) {
    const t = body.providerType ? String(body.providerType).trim().toLowerCase() : null;
    if (t && !["oidc", "saml", "unconfigured"].includes(t)) {
      throw new AppError(400, "providerType must be oidc, saml, or unconfigured");
    }
    data.ssoProviderType = t && t !== "unconfigured" ? t : null;
  }
  if (body.issuer !== undefined) data.ssoIssuer = body.issuer ? String(body.issuer).trim().slice(0, 400) : null;
  if (body.clientId !== undefined) data.ssoClientId = body.clientId ? String(body.clientId).trim().slice(0, 200) : null;
  if (body.metadataUrl !== undefined) {
    data.ssoMetadataUrl = body.metadataUrl ? String(body.metadataUrl).trim().slice(0, 500) : null;
  }
  if (body.clientSecret) {
    data.ssoClientSecretEnc = encryptField(String(body.clientSecret));
  }
  if (body.enabled != null) data.ssoEnabled = Boolean(body.enabled);

  const cap = getSsoCapability();
  const nextType = data.ssoProviderType !== undefined ? data.ssoProviderType : undefined;
  const configuredLocally = Boolean(
    (nextType ?? (await prisma.companyPortal.findUnique({ where: { companyId } }))?.ssoProviderType) &&
      (body.issuer || body.clientId || body.metadataUrl),
  );

  if (!cap.configured) {
    data.ssoStatus = "UNCONFIGURED";
    data.ssoReason = cap.reason;
    data.ssoEnabled = false;
  } else if (configuredLocally || body.enabled) {
    data.ssoStatus = "CONFIGURED";
    data.ssoReason = "SSO metadata stored. Live login requires the identity provider to complete a real handshake.";
  } else {
    data.ssoStatus = "INCOMPLETE";
    data.ssoReason = "SSO is incomplete — issuer and client id are required.";
  }

  const row = await prisma.companyPortal.update({
    where: { companyId },
    data,
    select: PORTAL_SELECT,
  });
  await auditPortal(userId, "corporate.portal.sso.update", companyId, {
    companyId,
    status: row.ssoStatus,
    enabled: row.ssoEnabled,
    hasClientSecret: Boolean(row.ssoClientSecretEnc),
  });
  return toPublicPortal(row, { includeDomainToken: true });
}

export async function startCompanySso(_userId, companyId) {
  await requireCompanyMembership(_userId, companyId);
  const cap = getSsoCapability();
  const err = new AppError(
    503,
    cap.reason || "Corporate SSO is not available.",
  );
  err.code = "CORPORATE_SSO_UNCONFIGURED";
  err.details = { capability: cap, companyId };
  throw err;
}

export async function resolvePublicPortal(host) {
  const hostname = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(":")[0]
    .split("/")[0];
  if (!hostname || !HOSTNAME.test(hostname)) {
    throw new AppError(400, "host is required");
  }
  const row = await prisma.companyPortal.findFirst({
    where: { hostname, portalEnabled: true, domainStatus: "VERIFIED" },
    select: {
      companyId: true,
      portalName: true,
      displayName: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      hostname: true,
      domainStatus: true,
    },
  });
  if (!row) {
    return {
      found: false,
      hostname,
      reason: "No verified, enabled portal is bound to this hostname.",
    };
  }
  return {
    found: true,
    hostname,
    branding: {
      portalName: row.portalName,
      displayName: row.displayName,
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
    },
  };
}
