"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
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
import { DocumentOcrPanel } from "@/app/profile/_components/DocumentOcrPanel";

type VaultCategory = "ALL" | "IDENTITIES" | "VISAS" | "LOYALTY" | "VOUCHERS" | "EXPIRING";

const CATEGORY_TABS: Array<{ id: VaultCategory; label: string }> = [
  { id: "ALL", label: "All Documents" },
  { id: "IDENTITIES", label: "Passports & IDs" },
  { id: "VISAS", label: "Visas & Permits" },
  { id: "LOYALTY", label: "Loyalty & Memberships" },
  { id: "VOUCHERS", label: "Tickets & Vouchers" },
  { id: "EXPIRING", label: "Expiring Soon (≤90d)" },
];

const UPLOAD_TYPES: Array<{ value: VaultDocType; label: string; category: string }> = [
  { value: "PASSPORT", label: "Passport", category: "Identification" },
  { value: "NATIONAL_ID", label: "National ID / CNIC", category: "Identification" },
  { value: "RESIDENCE_PERMIT", label: "Residence Permit", category: "Identification" },
  { value: "VISA", label: "Visa", category: "Travel Entry" },
  { value: "TRAVEL_CERT", label: "Travel Certificate", category: "Travel Entry" },
  { value: "FF_CARD", label: "Frequent Flyer Card", category: "Loyalty" },
  { value: "LOYALTY_CARD", label: "Hotel / Travel Loyalty Card", category: "Loyalty" },
  { value: "INSURANCE", label: "Travel Insurance", category: "Coverage" },
  { value: "OTHER", label: "Other Document", category: "General" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "No expiry";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function getDaysUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const now = new Date().getTime();
  const target = new Date(dateIso).getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
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

export function VaultPageClient() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState<VaultDocType>("PASSPORT");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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

  // Metrics computation
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

  // Filter items
  const filteredItems = useMemo(() => {
    return rawItems.filter((doc) => {
      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(q);
        const matchesType = doc.type.toLowerCase().includes(q);
        const matchesFile = (doc.originalFilename || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesType && !matchesFile) return false;
      }

      // Category tab filter
      if (selectedCategory === "IDENTITIES") {
        return doc.type === "PASSPORT" || doc.type === "NATIONAL_ID" || doc.type === "RESIDENCE_PERMIT";
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

  async function ensureIdentityDocForVault(doc: VaultDocument): Promise<IdentityDocument | null> {
    if (!isIdentityVaultType(doc.type)) return null;
    const existing = identityDocByVaultId.get(doc.id) || ocrByVaultId[doc.id];
    if (existing) return existing;
    try {
      const created = await createIdentityDoc({
        type: doc.type,
        vaultDocumentId: doc.id,
        ...(doc.expiresAt ? { expiresAt: doc.expiresAt.slice(0, 10) } : {}),
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
        ...(uploadExpiry ? { expiresAt: new Date(uploadExpiry).toISOString() } : {}),
      }).unwrap();

      setUploadTitle("");
      setUploadExpiry("");
      setUploadFile(null);
      setShowUploadModal(false);
      setActionSuccess(`"${uploaded.title}" added to your Vault.`);

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
    if (!window.confirm(`Are you sure you want to remove "${doc.title}" from your vault?`)) return;
    setBusyId(doc.id);
    setActionError(null);
    try {
      await removeDoc(doc.id).unwrap();
      setActionSuccess(`"${doc.title}" deleted.`);
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
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
        <p className="text-base font-semibold text-rose-900">Traveller Vault Unavailable</p>
        <p className="mt-1 text-sm text-rose-700">Could not retrieve your stored documents.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Encrypted Travel Credentials
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
            Traveller Vault
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl">
            Store, verify, and manage your passports, visas, loyalty cards, and travel documents in one secure place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="md"
            onClick={() => {
              setActionError(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 shadow-sm"
          >
            <span>+ Add Document</span>
          </Button>
        </div>
      </div>

      {/* Vault KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Items</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-[var(--font-sora)]">{stats.total}</div>
          <span className="text-xs text-slate-400">In secure storage</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active & Valid</span>
          <div className="mt-1 text-2xl font-bold text-emerald-700 font-[var(--font-sora)]">{stats.valid}</div>
          <span className="text-xs text-slate-400">Ready for travel</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Expiring ≤ 90d</span>
          <div className="mt-1 text-2xl font-bold text-amber-700 font-[var(--font-sora)]">{stats.expiring}</div>
          <span className="text-xs text-slate-400">Needs renewal soon</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Storage Provider</span>
          <div className="mt-1 text-sm font-bold text-slate-900 truncate">
            {capability?.configured ? capability.provider : "Standard Safe"}
          </div>
          <span className="text-xs text-slate-400">
            {capability?.maxBytes ? `Max ${(capability.maxBytes / (1024 * 1024)).toFixed(0)}MB / doc` : "Encrypted"}
          </span>
        </div>
      </div>

      {/* Global Alerts / Toasts */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-900">
          <span>✓ {actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {actionError && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-medium text-rose-900">
          <span>✕ {actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Category Tabs & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                  selectedCategory === tab.id
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="py-1.5 text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Document Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900">No documents found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery
              ? "No documents matched your search filter."
              : "Upload your passport, national ID, visas, or vouchers to get started."}
          </p>
          <Button
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setShowUploadModal(true);
            }}
            className="mt-4"
          >
            + Upload Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((doc) => {
            const verification = verificationByVaultId.get(doc.id);
            const identityDoc = ocrByVaultId[doc.id] || identityDocByVaultId.get(doc.id) || null;
            const showOcr = ocrOpenVaultId === doc.id && identityDoc;
            const daysUntil = getDaysUntil(doc.expiresAt);
            const isBusy = busyId === doc.id;

            // Status tag logic
            let expiryTone = "bg-emerald-50 text-emerald-700 border-emerald-200";
            let expiryLabel = `Valid · Exp ${formatDate(doc.expiresAt)}`;

            if (daysUntil !== null) {
              if (daysUntil < 0) {
                expiryTone = "bg-rose-50 text-rose-700 border-rose-200";
                expiryLabel = `Expired (${formatDate(doc.expiresAt)})`;
              } else if (daysUntil <= 90) {
                expiryTone = "bg-amber-50 text-amber-800 border-amber-200";
                expiryLabel = `Expiring in ${daysUntil}d (${formatDate(doc.expiresAt)})`;
              }
            } else if (!doc.expiresAt) {
              expiryTone = "bg-slate-50 text-slate-700 border-slate-200";
              expiryLabel = "No expiration date";
            }

            return (
              <div
                key={doc.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Card Header: Type Badge & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      {doc.type.replaceAll("_", " ")}
                    </span>
                    {doc.isPlatformIssued && (
                      <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-800">
                        Platform Issued
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="mt-3 text-base font-bold text-slate-900 tracking-tight line-clamp-1 font-[var(--font-sora)]">
                    {doc.title}
                  </h3>

                  {/* Expiry Badge */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${expiryTone}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {expiryLabel}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <div>
                      File:{" "}
                      <span className="font-medium text-slate-700">
                        {doc.originalFilename || "Metadata only"}
                      </span>
                      {doc.byteSize ? ` · ${(doc.byteSize / (1024 * 1024)).toFixed(2)} MB` : ""}
                    </div>

                    {verification && (
                      <div className="flex items-center gap-1 text-cyan-800 font-medium">
                        <span>✓ Verified on Profile ({verification})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {doc.hasBinary && doc.isActive && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => void onDownload(doc)}
                        className="text-xs px-2.5"
                      >
                        Download
                      </Button>
                    )}

                    {doc.isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => void onShare(doc)}
                        className="text-xs px-2"
                        title="Copy temporary 24h share token"
                      >
                        Share
                      </Button>
                    )}

                    {isIdentityVaultType(doc.type) && doc.isActive && doc.hasBinary && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={async () => {
                          if (ocrOpenVaultId === doc.id) {
                            setOcrOpenVaultId(null);
                            return;
                          }
                          setBusyId(doc.id);
                          const linked = await ensureIdentityDocForVault(doc);
                          setBusyId(null);
                          if (linked) setOcrOpenVaultId(doc.id);
                        }}
                        className="text-xs px-2 text-cyan-700"
                      >
                        {ocrOpenVaultId === doc.id ? "Hide OCR" : "OCR"}
                      </Button>
                    )}
                  </div>

                  {!doc.isPlatformIssued && doc.isActive && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void onReplace(doc)}
                        className="rounded p-1 text-slate-400 hover:text-slate-700 text-xs"
                        title="Replace file"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(doc)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600 text-xs"
                        title="Delete document"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline OCR Review Panel */}
                {showOcr && identityDoc && (
                  <div className="mt-4 border-t border-slate-200/80 pt-3">
                    <DocumentOcrPanel document={identityDoc} compact />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal Dialog */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs anim-fade">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-[var(--font-sora)]">
                  Add Document to Vault
                </h3>
                <p className="text-xs text-slate-500">Secure AES-256 cloud encryption</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onUpload} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Type
                </label>
                <SearchableSelect
                  options={UPLOAD_TYPES}
                  value={uploadType}
                  onChange={(v) => setUploadType(v as VaultDocType)}
                  searchable
                />
              </div>

              <Input
                label="Document Title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. US B1/B2 Visa, Pakistan Passport"
                required
              />

              <Input
                label="Expiration Date (optional)"
                type="date"
                value={uploadExpiry}
                onChange={(e) => setUploadExpiry(e.target.value)}
                hint="Used for automatic renewal reminders"
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  File Document (PDF, JPEG, PNG, WebP)
                </label>
                <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-5 text-center hover:bg-slate-50">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                  {uploadFile ? (
                    <div className="text-xs font-semibold text-emerald-800">
                      ✓ Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-cyan-700">Click to upload</span> or drag and drop
                      <div className="text-[11px] text-slate-400 mt-1">PDF or image files</div>
                    </div>
                  )}
                </div>
              </div>

              {actionError && (
                <p className="text-xs font-semibold text-rose-600">{actionError}</p>
              )}

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Encrypting & Uploading…" : "Upload Document"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
