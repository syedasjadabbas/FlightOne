"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  useCreateDocumentMutation,
  useDeleteDocumentMutation,
  useListCompanionsQuery,
  useListDocumentsQuery,
  useReuploadDocumentMutation,
  useVerifyDocumentMutation,
  type IdentityDocument,
} from "@/lib/api/profile.api";
import {
  useGetVaultCapabilityQuery,
  useUploadVaultDocumentMutation,
  type VaultDocType,
} from "@/lib/api/vault.api";
import { isIdentityVaultType } from "@/lib/profile/ocrReview";
import { DocumentOcrPanel } from "./DocumentOcrPanel";

function docTypeLabel(t: IdentityDocument["type"]) {
  switch (t) {
    case "PASSPORT":
      return "Passport";
    case "NATIONAL_ID":
      return "CNIC / National ID";
    case "VISA":
      return "Visa";
    case "RESIDENCE_PERMIT":
      return "Residence permit";
    default:
      return t;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function DocumentsSection() {
  const { data = [], isLoading } = useListDocumentsQuery();
  const { data: companions = [] } = useListCompanionsQuery();
  const { data: capability } = useGetVaultCapabilityQuery();
  const [createDoc, { isLoading: saving }] = useCreateDocumentMutation();
  const [uploadVault, { isLoading: uploadingScan }] = useUploadVaultDocumentMutation();
  const [reupload] = useReuploadDocumentMutation();
  const [verify] = useVerifyDocumentMutation();
  const [remove] = useDeleteDocumentMutation();
  const [type, setType] = useState<IdentityDocument["type"]>("PASSPORT");
  const [countryCode, setCountryCode] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentSubtype, setDocumentSubtype] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [vaultDocumentId, setVaultDocumentId] = useState("");
  const [companionId, setCompanionId] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ocrFocusId, setOcrFocusId] = useState<string | null>(null);

  const companionName = useMemo(() => {
    const map = new Map(companions.map((c) => [c.id, c.fullName]));
    return (id: string | null | undefined) =>
      id ? map.get(id) ?? "Saved traveller" : "You (account holder)";
  }, [companions]);

  const active = useMemo(
    () => data.filter((d) => d.status === "ACTIVE" || d.status === "EXPIRED"),
    [data],
  );

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const number = documentNumber.trim();
    if (number && number.length < 3) {
      setFormError("Document number looks too short.");
      return;
    }

    let linkedVaultId = vaultDocumentId.trim() || undefined;
    try {
      if (scanFile) {
        if (!capability?.canUpload) {
          setFormError(
            capability?.reasons?.[0] ||
              "Vault storage is not configured — cannot upload scan.",
          );
          return;
        }
        const contentBase64 = await fileToBase64(scanFile);
        const vaultType = isIdentityVaultType(type) ? type : "OTHER";
        const uploaded = await uploadVault({
          type: vaultType as VaultDocType,
          title: scanFile.name || `${docTypeLabel(type)} scan`,
          contentType: scanFile.type || "application/pdf",
          originalFilename: scanFile.name,
          contentBase64,
          ...(companionId ? { companionId } : {}),
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }).unwrap();
        linkedVaultId = uploaded.id;
      }

      const created = await createDoc({
        type,
        countryCode:
          countryCode.trim().length === 2 ? countryCode.trim().toUpperCase() : undefined,
        documentNumber: number || undefined,
        documentSubtype: documentSubtype.trim() || undefined,
        issuedAt: issuedAt || undefined,
        expiresAt: expiresAt || undefined,
        vaultDocumentId: linkedVaultId,
        companionId: companionId || undefined,
      }).unwrap();
      setCountryCode("");
      setDocumentNumber("");
      setDocumentSubtype("");
      setIssuedAt("");
      setExpiresAt("");
      setVaultDocumentId("");
      setCompanionId("");
      setScanFile(null);
      if (created.vaultDocumentId) setOcrFocusId(created.id);
    } catch {
      setFormError("Could not save document. Check fields and try again.");
    }
  }

  return (
    <TravellerSection
      title="Identity documents"
      note={
        <>
          Numbers are encrypted and hidden here. Upload a scan via{" "}
          <Link href="/vault" className="text-[var(--sky)] underline-offset-2 hover:underline">
            Vault
          </Link>
          , review OCR fields, then confirm. Assign to family or companions when needed.
        </>
      }
      panel
    >
      {isLoading ? (
        <Spinner label="Loading documents" />
      ) : active.length === 0 ? (
        <TravellerState title="No active documents">
          Add a passport or CNIC record, or upload a scan via Vault.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
          {active.map((d) => (
            <li key={d.id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <div>
                  <p className="fo-traveller__row-title">{docTypeLabel(d.type)}</p>
                  <p className="fo-traveller__row-meta">
                    Traveller: {companionName(d.companionId)} · {d.countryCode ?? "—"} ·{" "}
                    {d.status} · {d.verificationStatus}
                    {d.expiry?.state ? ` · ${d.expiry.state.replaceAll("_", " ")}` : ""}
                    {d.expiresAt
                      ? ` · exp ${new Date(d.expiresAt).toLocaleDateString()}`
                      : ""}
                  </p>
                  <p className="fo-traveller__row-meta">
                    Number:{" "}
                    {d.hasDocumentNumber ? "on file (encrypted, hidden)" : "not set"}
                    {d.documentSubtype ? ` · ${d.documentSubtype}` : ""}
                    {d.vaultDocumentId ? ` · vault ${d.vaultDocumentId}` : " · no scan linked"}
                  </p>
                </div>
              </div>
              <div className="fo-traveller__row-actions">
                {d.verificationStatus !== "VERIFIED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => verify({ id: d.id, decision: "VERIFIED" })}
                  >
                    Mark verified
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const next = window.prompt(
                      "New vault document id for re-upload",
                      `${d.vaultDocumentId ?? "vault"}-v2`,
                    );
                    if (!next?.trim()) return;
                    void reupload({ id: d.id, vaultDocumentId: next.trim() });
                  }}
                >
                  Re-upload
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setOcrFocusId((cur) => (cur === d.id ? null : d.id))
                  }
                >
                  {ocrFocusId === d.id ? "Hide OCR" : "OCR"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(d.id)}>
                  Remove
                </Button>
              </div>
              {ocrFocusId === d.id ? <DocumentOcrPanel document={d} /> : null}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="space-y-3 border-t border-line pt-4">
        <SearchableSelect
          id="doc-traveller"
          label="Traveller"
          options={[
            { value: "", label: "You (account holder)" },
            ...companions.map((c) => ({
              value: c.id,
              label: c.kind === "FAMILY" ? `${c.fullName} (family)` : c.fullName,
            })),
          ]}
          value={companionId}
          onChange={setCompanionId}
          searchable={companions.length > 6}
        />
        <SearchableSelect
          id="doc-type"
          label="Document type"
          options={[
            { value: "PASSPORT", label: "Passport" },
            { value: "NATIONAL_ID", label: "CNIC / National ID" },
            { value: "VISA", label: "Visa" },
            { value: "RESIDENCE_PERMIT", label: "Residence permit" },
          ]}
          value={type}
          onChange={(v) => setType(v as IdentityDocument["type"])}
          searchable={false}
        />
        <Input
          label="Document number"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          autoComplete="off"
          hint="Optional — or fill after OCR review. Encrypted at rest."
        />
        <Input
          label="Country code"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          maxLength={2}
          placeholder="PK"
        />
        {(type === "VISA" || type === "RESIDENCE_PERMIT" || type === "NATIONAL_ID") && (
          <Input
            label={type === "VISA" ? "Visa type" : "Document subtype"}
            value={documentSubtype}
            onChange={(e) => setDocumentSubtype(e.target.value)}
            placeholder={type === "VISA" ? "tourist, work…" : "optional"}
            hint="Optional"
          />
        )}
        <Input
          label="Issue date"
          type="date"
          value={issuedAt}
          onChange={(e) => setIssuedAt(e.target.value)}
          hint="Optional"
        />
        <Input
          label="Expiry date"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-soft" htmlFor="doc-scan">
            Scan file (Vault)
          </label>
          <input
            id="doc-scan"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="text-[13px] text-ink"
            onChange={(e) => setScanFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-[12px] text-ink-faint">
            Uploads to Module 07 Vault, then links the vault id. Prefer this over pasting an
            id. Binary stays server-side for OCR.
          </p>
        </div>
        <Input
          label="Vault document id"
          value={vaultDocumentId}
          onChange={(e) => setVaultDocumentId(e.target.value)}
          hint="Optional if you upload a scan above — or paste an existing vault id"
        />
        {formError ? (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={saving || uploadingScan} size="sm">
          {uploadingScan ? "Uploading scan…" : saving ? "Saving…" : "Add document record"}
        </Button>
      </form>
    </TravellerSection>
  );
}
