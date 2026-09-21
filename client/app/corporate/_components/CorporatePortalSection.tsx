"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Globe2,
  KeyRound,
  Palette,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  useConfigureCompanyDomainMutation,
  useGetCompanyPortalQuery,
  useUpdateCompanyBrandingMutation,
  useUpdateCompanySsoMutation,
  useVerifyCompanyDomainMutation,
} from "@/lib/api/corporate.api";
import { DeskSectionHead, DeskStatus } from "./DeskSectionHead";

export function CorporatePortalSection({
  companyId,
  isAdmin,
}: {
  companyId: string;
  isAdmin: boolean;
}) {
  const { data, isLoading } = useGetCompanyPortalQuery(companyId);
  const [updateBranding] = useUpdateCompanyBrandingMutation();
  const [configureDomain] = useConfigureCompanyDomainMutation();
  const [verifyDomain] = useVerifyCompanyDomainMutation();
  const [updateSso] = useUpdateCompanySsoMutation();
  const [portalName, setPortalName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hostname, setHostname] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <section className="fo-desk__panel fo-desk__stack">
        <DeskSectionHead icon={Palette} title="Portal branding" />
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Loading branding…
        </p>
      </section>
    );
  }

  const domainTone =
    data.domain.status === "VERIFIED" || data.domain.status === "ACTIVE"
      ? "ok"
      : data.domain.status === "FAILED"
        ? "warn"
        : "neutral";

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <DeskSectionHead icon={Palette} title="Portal branding" />

      <div
        className="rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--fo-desk-wash)] p-3"
        style={
          data.branding.primaryColor
            ? { borderColor: data.branding.primaryColor }
            : undefined
        }
      >
        <p className="text-sm font-semibold text-[var(--navy)]">
          {data.branding.displayName || data.branding.portalName}
        </p>
        {data.branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.branding.logoUrl}
            alt=""
            className="mt-2 h-8 max-w-[160px] object-contain"
          />
        ) : null}
        <p className="mt-1.5 text-xs text-[var(--ink-soft)]">
          {data.branding.enabled
            ? "Branding enabled for this company."
            : "Branding saved but not enabled."}
        </p>
      </div>

      <div className="fo-desk__row">
        <div className="flex min-w-0 items-start gap-2">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              Custom domain
            </p>
            <p className="mt-0.5 text-sm text-[var(--navy)]">
              {data.domain.hostname || "Not set"}
            </p>
            {data.domain.reason ? (
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{data.domain.reason}</p>
            ) : null}
          </div>
        </div>
        <DeskStatus tone={domainTone}>{data.domain.status}</DeskStatus>
      </div>

      {data.domain.verificationToken ? (
        <p className="break-all font-mono text-[11px] text-[var(--ink-faint)]">
          DNS TXT token: {data.domain.verificationToken}
        </p>
      ) : null}

      <div className="fo-desk__row">
        <div className="flex min-w-0 items-start gap-2">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              SSO
            </p>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
              {data.sso.reason || "OIDC settings"}
              {data.sso.hasClientSecret
                ? " · client secret stored"
                : " · no client secret stored"}
            </p>
          </div>
        </div>
        <DeskStatus>{data.sso.status}</DeskStatus>
      </div>

      {isAdmin ? (
        <>
          <Input
            label="Portal name"
            value={portalName}
            onChange={(e) => setPortalName(e.target.value)}
            placeholder={data.branding.portalName}
          />
          <Input
            label="Primary colour (#RRGGBB)"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder={data.branding.primaryColor || "#007AE5"}
          />
          <Input
            label="Logo https URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
          <Button
            size="sm"
            type="button"
            onClick={async () => {
              setMsg(null);
              try {
                await updateBranding({
                  companyId,
                  ...(portalName.trim() ? { portalName: portalName.trim() } : {}),
                  ...(primaryColor.trim() ? { primaryColor: primaryColor.trim() } : {}),
                  ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
                  portalEnabled: true,
                }).unwrap();
                setMsg("Branding saved");
              } catch {
                setMsg("Could not save branding.");
              }
            }}
          >
            Save branding
          </Button>
          <Input
            label="Custom hostname"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="travel.example.com"
          />
          <div className="fo-desk__toolbar">
            <Button
              size="sm"
              type="button"
              disabled={!hostname.trim()}
              onClick={async () => {
                setMsg(null);
                try {
                  await configureDomain({ companyId, hostname: hostname.trim() }).unwrap();
                  setMsg("Hostname saved — verification required");
                } catch {
                  setMsg("Could not save hostname.");
                }
              }}
            >
              Save domain
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={async () => {
                setMsg(null);
                try {
                  const out = (await verifyDomain({ companyId }).unwrap()) as {
                    domain?: { status?: string; reason?: string };
                  };
                  setMsg(out?.domain?.reason || out?.domain?.status || "Verification checked");
                } catch {
                  setMsg("Domain verification did not succeed.");
                }
              }}
            >
              Check verification
            </Button>
          </div>
          <Input
            label="SSO issuer"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
          />
          <Input
            label="SSO client id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <Input
            label="SSO client secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
          <Button
            size="sm"
            type="button"
            onClick={async () => {
              setMsg(null);
              try {
                await updateSso({
                  companyId,
                  providerType: "oidc",
                  issuer: issuer.trim() || null,
                  clientId: clientId.trim() || null,
                  ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
                  enabled: true,
                }).unwrap();
                setClientSecret("");
                setMsg(
                  "SSO settings stored. Live login stays unavailable until a real IdP is configured.",
                );
              } catch {
                setMsg("Could not save SSO settings.");
              }
            }}
          >
            Save SSO
          </Button>
        </>
      ) : (
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Only company ADMIN can change branding, domain, or SSO.
        </p>
      )}
      {msg ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" aria-hidden />
          {msg}
        </p>
      ) : null}
    </section>
  );
}
