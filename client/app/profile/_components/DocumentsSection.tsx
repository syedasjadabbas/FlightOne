"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FileCheck2,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
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
      return "Residence Permit";
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
      id ? map.get(id) ?? "Saved traveller" : "Account Holder";
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
      title="Identity & Travel Documents"
      note={
        <span>
          Encrypted passport, CNIC, and visa records. Scans uploaded here are sent directly to the{" "}
          <Link href="/vault" className="font-semibold text-sky underline-offset-2 hover:underline">
            AES-256 Biometric Vault
          </Link>{" "}
          for AI OCR validation.
        </span>
      }
      panel
    >
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Loading document records…" />
        </div>
      ) : active.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky/10 text-sky">
            <FileText size={18} strokeWidth={2} />
          </div>
          <p className="text-[14px] font-semibold text-navy">No Travel Documents on File</p>
          <p className="text-[12.5px] text-ink-soft">Add passport or national ID details to unlock automated bookings.</p>
        </div>
      ) : (
        <div className="mb-6 space-y-3">
          {active.map((d) => {
            const isVerified = d.verificationStatus === "VERIFIED";
            const isExpired = d.status === "EXPIRED";
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-black/8 bg-white/95 p-4 shadow-sm transition-all hover:border-black/15"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white shadow-sm">
                      <FileText size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-navy">
                          {docTypeLabel(d.type)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                            isVerified
                              ? "bg-emerald/15 text-emerald"
                              : "bg-amber-500/15 text-amber-700"
                          }`}
                        >
                          {isVerified ? "Verified" : "Pending Review"}
                        </span>
                        {isExpired ? (
                          <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10.5px] font-bold text-danger uppercase">
                            Expired
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-ink-soft">
                        <span>Passenger: <strong>{companionName(d.companionId)}</strong></span>
                        <span>Country: <strong>{d.countryCode ?? "—"}</strong></span>
                        {d.expiresAt ? (
                          <span>
                            Expires: <strong>{new Date(d.expiresAt).toLocaleDateString()}</strong>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-faint">
                        <span className="inline-flex items-center gap-1 text-emerald">
                          <Lock size={11} strokeWidth={2} />
                          {d.hasDocumentNumber ? "Document number encrypted" : "No number"}
                        </span>
                        {d.vaultDocumentId ? (
                          <span className="font-mono text-ink-soft">
                            · Vault: {d.vaultDocumentId.slice(0, 16)}…
                          </span>
                        ) : (
                          <span className="text-ink-faint">· No file scan linked</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!isVerified ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => verify({ id: d.id, decision: "VERIFIED" })}
                      >
                        <CheckCircle2 size={13} strokeWidth={2} className="text-emerald" />
                        <span>Verify</span>
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
                      <RefreshCw size={13} strokeWidth={2} />
                      <span>Re-link</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setOcrFocusId((cur) => (cur === d.id ? null : d.id))
                      }
                    >
                      <ScanText size={13} strokeWidth={2} />
                      <span>{ocrFocusId === d.id ? "Hide OCR" : "OCR Details"}</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(d.id)}
                      className="text-danger hover:bg-danger/10"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                      <span>Remove</span>
                    </Button>
                  </div>
                </div>

                {ocrFocusId === d.id ? (
                  <div className="mt-4 border-t border-black/6 pt-3">
                    <DocumentOcrPanel document={d} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Document Record Form */}
      <div className="rounded-2xl border border-black/8 bg-white/60 p-4.5 pt-4">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
            <FileCheck2 size={13} strokeWidth={2.2} />
          </span>
          <p className="text-[12px] font-bold tracking-wider text-ink-faint uppercase">
            Record New Document
          </p>
        </div>

        <form onSubmit={onAdd} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SearchableSelect
              id="doc-traveller"
              label="Associated Passenger"
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
              label="Document Type"
              options={[
                { value: "PASSPORT", label: "Passport" },
                { value: "NATIONAL_ID", label: "CNIC / National ID" },
                { value: "VISA", label: "Visa" },
                { value: "RESIDENCE_PERMIT", label: "Residence Permit" },
              ]}
              value={type}
              onChange={(v) => setType(v as IdentityDocument["type"])}
              searchable={false}
            />
            <Input
              label="Document Number"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              autoComplete="off"
              placeholder="e.g. AB1234567"
              hint="AES-256 encrypted at rest"
            />
            <Input
              label="Issuing Country Code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              maxLength={2}
              placeholder="PK"
              hint="ISO 2-letter code"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(type === "VISA" || type === "RESIDENCE_PERMIT" || type === "NATIONAL_ID") && (
              <Input
                label={type === "VISA" ? "Visa Classification" : "Document Subtype"}
                value={documentSubtype}
                onChange={(e) => setDocumentSubtype(e.target.value)}
                placeholder={type === "VISA" ? "tourist, work, transit…" : "optional"}
              />
            )}
            <Input
              label="Issue Date"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
            <Input
              label="Expiration Date"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
            <Input
              label="Existing Vault ID"
              value={vaultDocumentId}
              onChange={(e) => setVaultDocumentId(e.target.value)}
              placeholder="Optional if uploading below"
            />
          </div>

          {/* File Upload Dropzone */}
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/80 p-4 transition-all hover:border-sky hover:bg-white">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky/10 text-sky">
                <UploadCloud size={20} strokeWidth={2} />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-[13px] font-semibold text-navy">
                  Upload Document Scan (Encrypted Vault)
                </p>
                <p className="text-[12px] text-ink-faint">
                  PDF, JPG, PNG, WebP. High resolution for automatic AI OCR verification.
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  id="doc-scan"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setScanFile(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-8.5 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-[#0e1620] shadow-sm hover:bg-black/4">
                  {scanFile ? scanFile.name.slice(0, 20) + "…" : "Browse File"}
                </span>
              </label>
            </div>
          </div>

          {formError ? (
            <p className="text-[13px] font-medium text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving || uploadingScan} size="md">
              {uploadingScan ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Uploading Scan to Vault…
                </>
              ) : saving ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Saving Document…
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add Document Record</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </TravellerSection>
  );
}
