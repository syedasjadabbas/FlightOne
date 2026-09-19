"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import {
  useConfigureCompanyDomainMutation,
  useGetCompanyPortalQuery,
  useUpdateCompanyBrandingMutation,
  useUpdateCompanySsoMutation,
  useVerifyCompanyDomainMutation,
} from "@/lib/api/corporate.api";

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
      <section className="fo-desk__panel">
        <h2 className="fo-desk__section-label">Portal branding</h2>
        <p className="fo-desk__empty">Loading branding…</p>
      </section>
    );
  }

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <h2 className="fo-desk__section-label">Portal branding</h2>
      <div
        className="rounded-xl border border-slate-200 p-3"
        style={
          data.branding.primaryColor
            ? { borderColor: data.branding.primaryColor }
            : undefined
        }
      >
        <p className="text-sm font-semibold text-slate-900">
          {data.branding.displayName || data.branding.portalName}
        </p>
        {data.branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.branding.logoUrl} alt="" className="mt-2 h-8 max-w-[160px] object-contain" />
        ) : null}
        <p className="mt-1 text-xs text-slate-600">
          {data.branding.enabled ? "Portal branding enabled for this company." : "Portal branding is saved but not enabled."}
        </p>
      </div>

      <p className="text-xs text-slate-600">
        Custom domain: <strong>{data.domain.hostname || "not set"}</strong> · {data.domain.status}
        {data.domain.reason ? ` — ${data.domain.reason}` : ""}
      </p>
      {data.domain.verificationToken ? (
        <p className="text-[11px] text-slate-500 break-all">
          DNS TXT token (this company only): {data.domain.verificationToken}
        </p>
      ) : null}

      <p className="text-xs text-slate-600">
        SSO: {data.sso.status}
        {data.sso.reason ? ` — ${data.sso.reason}` : ""}
        {data.sso.hasClientSecret ? " · client secret stored" : " · no client secret stored"}
      </p>

      {isAdmin ? (
        <>
          <Input label="Portal name" value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder={data.branding.portalName} />
          <Input label="Primary colour (#RRGGBB)" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder={data.branding.primaryColor || "#00a8e8"} />
          <Input label="Logo https URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
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
          <Input label="Custom hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="travel.example.com" />
          <div className="flex gap-2">
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
          <Input label="SSO issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          <Input label="SSO client id" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <Input label="SSO client secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
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
                setMsg("SSO settings stored. Live login stays unavailable until a real IdP is configured.");
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
      {msg ? <p className="text-[13px] text-slate-600">{msg}</p> : null}
    </section>
  );
}
