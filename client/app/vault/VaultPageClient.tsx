"use client";

import { useMemo, useState } from "react";
import { FilePlus2, Lock, Search } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import {
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import { useAuthStore } from "@/store/auth.store";
import {
  useCreateDocumentMutation,
  useListDocumentsQuery,
  type IdentityDocument,
} from "@/lib/api/profile.api";
import {
  downloadVaultDocumentBlob,
  useDeleteVaultDocumentMutation,
  useGetVaultCapabilityQuery,
  useListVaultDocumentsQuery,
  useReplaceVaultDocumentMutation,
  useShareVaultDocumentMutation,
  useUploadVaultDocumentMutation,
  type VaultDocType,
  type VaultDocument,
} from "@/lib/api/vault.api";
import { isIdentityVaultType } from "@/lib/profile/ocrReview";
import { VAULT_TYPE_LABELS, VAULT_TYPE_ORDER } from "@/lib/vault/visaStatus";
import { DeleteDocumentConfirm } from "./_components/DeleteDocumentConfirm";
import { VaultCategoryTabs, type VaultCategory } from "./_components/VaultCategoryTabs";
import { VaultDocRow } from "./_components/VaultDocRow";
import { VaultDocumentDetails } from "./_components/VaultDocumentDetails";
import { VaultSummaryStrip } from "./_components/VaultSummaryStrip";
import { VaultUploadModal } from "./_components/VaultUploadModal";
import { getDaysUntil } from "./_components/vaultFormat";
import {
  emptyVisaMetaForm,
  visaMetaFormToInput,
  type VisaMetaFormValue,
} from "./_components/VisaMetaFields";

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

export function VaultPageClient() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState<VaultDocType>("PASSPORT");
  const [uploadIssue, setUploadIssue] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVisa, setUploadVisa] = useState<VisaMetaFormValue>(emptyVisaMetaForm());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedFallback, setSelectedFallback] = useState<VaultDocument | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaultDocument | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: capability, isLoading: capLoading } = useGetVaultCapabilityQuery();
  const { data: list, isLoading, isError, refetch } = useListVaultDocumentsQuery({
    includeInactive: true,
  });
  const { data: identityDocs } = useListDocumentsQuery();
  const [createIdentityDoc] = useCreateDocumentMutation();
  const [upload, { isLoading: uploading }] = useUploadVaultDocumentMutation();
  const [replaceDoc] = useReplaceVaultDocumentMutation();
  const [removeDoc] = useDeleteVaultDocumentMutation();
  const [shareDoc] = useShareVaultDocumentMutation();

  const [ocrByVaultId, setOcrByVaultId] = useState<Record<string, IdentityDocument>>({});
  const [ocrOpenVaultId, setOcrOpenVaultId] = useState<string | null>(null);

  const verificationByVaultId = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of identityDocs ?? []) {
      if (d.vaultDocumentId) {
        map.set(d.vaultDocumentId, d.verificationStatus);
      }
    }
    return map;
  }, [identityDocs]);

  const identityDocByVaultId = useMemo(() => {
    const map = new Map<string, IdentityDocument>();
    for (const d of identityDocs ?? []) {
      if (d.vaultDocumentId && (d.status === "ACTIVE" || d.status === "EXPIRED")) {
        map.set(d.vaultDocumentId, d);
      }
    }
    return map;
  }, [identityDocs]);

  const rawItems = list?.items ?? [];

  const stats = useMemo(() => {
    let validCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    for (const doc of rawItems) {
      if (!doc.isActive) continue;
      const days = getDaysUntil(doc.expiresAt);
      if (days !== null) {
        if (days < 0) expiredCount++;
        else if (days <= 90) expiringCount++;
        else validCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: rawItems.length,
      valid: validCount,
      expiring: expiringCount,
      expired: expiredCount,
    };
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    return rawItems.filter((doc) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(q);
        const matchesType = doc.type.toLowerCase().includes(q);
        const matchesFile = (doc.originalFilename || "").toLowerCase().includes(q);
        const matchesDest = (doc.visaMeta?.destinationCode || "").toLowerCase().includes(q);
        const matchesVisaType = (doc.visaMeta?.visaType || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesType && !matchesFile && !matchesDest && !matchesVisaType) {
          return false;
        }
      }

      if (selectedCategory === "IDENTITIES") {
        return (
          doc.type === "PASSPORT" ||
          doc.type === "NATIONAL_ID" ||
          doc.type === "RESIDENCE_PERMIT"
        );
      }
      if (selectedCategory === "VISAS") {
        return doc.type === "VISA" || doc.type === "TRAVEL_CERT";
      }
      if (selectedCategory === "LOYALTY") {
        return doc.type === "FF_CARD" || doc.type === "LOYALTY_CARD";
      }
      if (selectedCategory === "VOUCHERS") {
        return (
          doc.type === "TICKET" ||
          doc.type === "HOTEL_VOUCHER" ||
          doc.type === "INSURANCE" ||
          doc.type === "OTHER"
        );
      }
      if (selectedCategory === "EXPIRING") {
        const days = getDaysUntil(doc.expiresAt);
        return days !== null && days <= 90;
      }

      return true;
    });
  }, [rawItems, selectedCategory, searchQuery]);

  const groupedItems = useMemo(() => {
    const buckets = new Map<string, VaultDocument[]>();
    for (const doc of filteredItems) {
      const list = buckets.get(doc.type) ?? [];
      list.push(doc);
      buckets.set(doc.type, list);
    }
    const ordered: Array<{ type: string; items: VaultDocument[] }> = VAULT_TYPE_ORDER.filter(
      (type) => buckets.has(type),
    ).map((type) => ({
      type,
      items: buckets.get(type) ?? [],
    }));
    for (const [type, items] of buckets) {
      if (!VAULT_TYPE_ORDER.includes(type as (typeof VAULT_TYPE_ORDER)[number])) {
        ordered.push({ type, items });
      }
    }
    return ordered;
  }, [filteredItems]);

  async function ensureIdentityDocForVault(doc: VaultDocument): Promise<IdentityDocument | null> {
    if (!isIdentityVaultType(doc.type)) return null;
    const existing = identityDocByVaultId.get(doc.id) || ocrByVaultId[doc.id];
    if (existing) return existing;
    try {
      const created = await createIdentityDoc({
        type: doc.type,
        vaultDocumentId: doc.id,
        ...(doc.expiresAt ? { expiresAt: doc.expiresAt.slice(0, 10) } : {}),
        ...(doc.issueDate ? { issuedAt: doc.issueDate.slice(0, 10) } : {}),
        ...(doc.type === "VISA" && doc.visaMeta?.destinationCode
          ? { countryCode: doc.visaMeta.destinationCode }
          : {}),
        ...(doc.type === "VISA" && doc.visaMeta?.visaType
          ? { documentSubtype: doc.visaMeta.visaType }
          : {}),
      }).unwrap();
      setOcrByVaultId((prev) => ({ ...prev, [doc.id]: created }));
      return created;
    } catch {
      setActionError("Could not link vault scan to profile identity document.");
      return null;
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!uploadFile) {
      setActionError("Please choose a PDF or image file.");
      return;
    }
    if (!capability?.canUpload) {
      setActionError(capability?.reasons?.[0] || "Vault upload storage is currently unavailable.");
      return;
    }

    try {
      const contentBase64 = await fileToBase64(uploadFile);
      const uploaded = await upload({
        type: uploadType,
        title: uploadTitle.trim() || uploadFile.name,
        contentType: uploadFile.type || "application/pdf",
        originalFilename: uploadFile.name,
        contentBase64,
        ...(uploadIssue ? { issueDate: new Date(uploadIssue).toISOString() } : {}),
        ...(uploadExpiry ? { expiresAt: new Date(uploadExpiry).toISOString() } : {}),
        ...(uploadType === "VISA" ? { visaMeta: visaMetaFormToInput(uploadVisa) } : {}),
      }).unwrap();

      setUploadTitle("");
      setUploadIssue("");
      setUploadExpiry("");
      setUploadFile(null);
      setUploadVisa(emptyVisaMetaForm());
      setShowUploadModal(false);
      setActionSuccess(`"${uploaded.title}" added to your Vault.`);
      setSelectedFallback(uploaded);
      setSelectedDocId(uploaded.id);

      if (isIdentityVaultType(uploaded.type) && uploaded.hasBinary) {
        const linked = await ensureIdentityDocForVault(uploaded);
        if (linked) setOcrOpenVaultId(uploaded.id);
      }
    } catch (err) {
      setActionError(
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message || "Upload failed")
          : "Upload failed",
      );
    }
  }

  async function onDownload(doc: VaultDocument) {
    if (!accessToken || !doc.hasBinary) return;
    setBusyId(doc.id);
    setActionError(null);
    try {
      const blob = await downloadVaultDocumentBlob(doc.id, accessToken);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalFilename || `${doc.type.toLowerCase()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Download failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function onShare(doc: VaultDocument) {
    setBusyId(doc.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const r = await shareDoc({ id: doc.id, ttlHours: 24 }).unwrap();
      await navigator.clipboard.writeText(r.token);
      setActionSuccess(`Share token copied to clipboard (valid 24h): ${r.token}`);
    } catch {
      setActionError("Could not generate share token.");
    } finally {
      setBusyId(null);
    }
  }

  async function onReplace(doc: VaultDocument) {
    if (doc.isPlatformIssued) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const next = input.files?.[0];
      if (!next) return;
      setBusyId(doc.id);
      setActionError(null);
      try {
        const contentBase64 = await fileToBase64(next);
        await replaceDoc({
          id: doc.id,
          contentBase64,
          contentType: next.type || "application/pdf",
          originalFilename: next.name,
        }).unwrap();
        setActionSuccess(`Document "${doc.title}" replaced with new version.`);
      } catch {
        setActionError("Replace failed.");
      } finally {
        setBusyId(null);
      }
    };
    input.click();
  }

  async function onDelete(doc: VaultDocument) {
    if (doc.isPlatformIssued) return;
    setPendingDelete(doc);
  }

  async function confirmDelete() {
    const doc = pendingDelete;
    if (!doc) return;
    setBusyId(doc.id);
    setActionError(null);
    try {
      await removeDoc(doc.id).unwrap();
      setActionSuccess(`"${doc.title}" deleted.`);
      setPendingDelete(null);
      if (selectedDocId === doc.id) setSelectedDocId(null);
    } catch {
      setActionError("Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading || capLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Opening secure Traveller Vault…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fo-vault">
        <TravellerPageHeader
          title="Traveller Vault"
          lede="Store and manage passports, visas, and travel documents in one place."
        />
        <TravellerState
          variant="error"
          title="Vault unavailable"
          action={
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not retrieve your stored documents.
        </TravellerState>
      </div>
    );
  }

  const providerLabel = capability?.configured ? capability.provider : "Standard safe";
  const maxMbNote = capability?.maxBytes
    ? `Max ${(capability.maxBytes / (1024 * 1024)).toFixed(0)} MB / doc`
    : null;

  return (
    <div className="fo-vault">
      <TravellerPageHeader
        title="Traveller Vault"
        lede="Passports, visas, loyalty cards, and vouchers — stored encrypted, ready when you travel."
        actions={
          <Button
            size="md"
            onClick={() => {
              setActionError(null);
              setShowUploadModal(true);
            }}
            icon={<FilePlus2 size={15} strokeWidth={2} aria-hidden />}
          >
            Add document
          </Button>
        }
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} strokeWidth={2} aria-hidden />
            Encrypted travel credentials
          </span>
        }
      />

      <VaultSummaryStrip
        total={stats.total}
        valid={stats.valid}
        expiring={stats.expiring}
        expired={stats.expired}
        providerLabel={providerLabel}
        maxMbNote={maxMbNote}
      />

      {actionSuccess ? (
        <div className="fo-vault__flash fo-vault__flash--ok" role="status">
          <span>{actionSuccess}</span>
          <button
            type="button"
            className="fo-vault__flash-dismiss"
            onClick={() => setActionSuccess(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {actionError && !showUploadModal ? (
        <div className="fo-vault__flash fo-vault__flash--err" role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className="fo-vault__flash-dismiss"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="fo-vault__toolbar">
        <VaultCategoryTabs selected={selectedCategory} onChange={setSelectedCategory} />
        <div className="fo-vault__search">
          <div className="fo-vault__search-wrap">
            <Search
              size={14}
              strokeWidth={2}
              className="fo-vault__search-icon"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              aria-label="Search documents"
              className="py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <TravellerState
          title="No documents found"
          action={
            <Button
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setShowUploadModal(true);
              }}
              icon={<FilePlus2 size={13} strokeWidth={2} aria-hidden />}
            >
              Upload document
            </Button>
          }
        >
          {searchQuery
            ? "No documents matched your search."
            : "Upload a passport, national ID, visa, or voucher to get started."}
        </TravellerState>
      ) : (
        <div className="fo-vault__groups">
          {groupedItems.map((group) => (
            <TravellerSection
              key={group.type}
              title={`${VAULT_TYPE_LABELS[group.type] || group.type} · ${group.items.length}`}
            >
              <ul className="fo-vault__list">
                {group.items.map((doc) => {
                  const identityDoc =
                    ocrByVaultId[doc.id] || identityDocByVaultId.get(doc.id) || null;
                  const showOcr = ocrOpenVaultId === doc.id && Boolean(identityDoc);

                  return (
                    <VaultDocRow
                      key={doc.id}
                      doc={doc}
                      verification={verificationByVaultId.get(doc.id)}
                      identityDoc={identityDoc}
                      showOcr={showOcr}
                      busy={busyId === doc.id}
                      onDetails={() => {
                        setSelectedFallback(doc);
                        setSelectedDocId(doc.id);
                      }}
                      onDownload={() => void onDownload(doc)}
                      onShare={() => void onShare(doc)}
                      onReplace={() => void onReplace(doc)}
                      onDelete={() => void onDelete(doc)}
                      onToggleOcr={async () => {
                        if (ocrOpenVaultId === doc.id) {
                          setOcrOpenVaultId(null);
                          return;
                        }
                        setBusyId(doc.id);
                        const linked = await ensureIdentityDocForVault(doc);
                        setBusyId(null);
                        if (linked) setOcrOpenVaultId(doc.id);
                      }}
                    />
                  );
                })}
              </ul>
            </TravellerSection>
          ))}
        </div>
      )}

      {showUploadModal ? (
        <VaultUploadModal
          uploadTitle={uploadTitle}
          uploadType={uploadType}
          uploadIssue={uploadIssue}
          uploadExpiry={uploadExpiry}
          uploadFile={uploadFile}
          uploadVisa={uploadVisa}
          uploading={uploading}
          actionError={actionError}
          onTitleChange={setUploadTitle}
          onTypeChange={setUploadType}
          onIssueChange={setUploadIssue}
          onExpiryChange={setUploadExpiry}
          onFileChange={setUploadFile}
          onVisaChange={setUploadVisa}
          onClose={() => setShowUploadModal(false)}
          onSubmit={(e) => void onUpload(e)}
        />
      ) : null}

      {selectedDocId && (selectedFallback || rawItems.find((d) => d.id === selectedDocId)) ? (
        <VaultDocumentDetails
          documentId={selectedDocId}
          fallback={
            (rawItems.find((d) => d.id === selectedDocId) ?? selectedFallback) as VaultDocument
          }
          busy={busyId === selectedDocId}
          onClose={() => {
            setSelectedDocId(null);
            setSelectedFallback(null);
          }}
          onDownload={(doc) => void onDownload(doc)}
          onShare={(doc) => void onShare(doc)}
          onReplace={(doc) => void onReplace(doc)}
          onDelete={(doc) => void onDelete(doc)}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteDocumentConfirm
          title={pendingDelete.title}
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
