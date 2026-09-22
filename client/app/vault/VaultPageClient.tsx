"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  FilePlus2,
  HardDrive,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
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
import { uploadFileToGcs } from "@/lib/upload/gcsUpload";
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
import "./vault.css";

export function VaultPageClient() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const authUser = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

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
  /** Which specific action is running on busyId's document — lets the
   *  details modal show a spinner on the exact button in flight instead of
   *  just disabling all four with no indication of which one is working. */
  const [busyAction, setBusyAction] = useState<"download" | "share" | "replace" | "delete" | null>(null);
  /** Upload modal's own phase label — the GCS file PUT happens before the
   *  vault mutation even starts, so `uploading` (RTK's isLoading) alone
   *  leaves that whole phase with no visible feedback. */
  const [uploadPhase, setUploadPhase] = useState<"idle" | "transferring" | "saving">("idle");

  const skipAuth = !hasHydrated || !accessToken;
  const { data: capability, isLoading: capLoading } = useGetVaultCapabilityQuery(
    undefined,
    { skip: skipAuth },
  );
  const { data: list, isLoading, isError, refetch } = useListVaultDocumentsQuery(
    { includeInactive: true },
    { skip: skipAuth },
  );
  const { data: identityDocs } = useListDocumentsQuery(undefined, {
    skip: skipAuth,
  });
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

  // Health score calculation for instrument dial
  const healthScore = useMemo(() => {
    if (stats.total === 0) return 100;
    const penalty = stats.expired * 35 + stats.expiring * 15;
    return Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }, [stats]);

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
      setUploadPhase("transferring");
      const gcs = await uploadFileToGcs(uploadFile, {
        folder: `vault/${userId || "anon"}`,
      });

      setUploadPhase("saving");
      const uploaded = await upload({
        type: uploadType,
        title: uploadTitle.trim() || uploadFile.name,
        contentType: gcs.mimeType,
        originalFilename: gcs.originalName,
        fileUrl: gcs.url,
        byteSize: gcs.sizeBytes,
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
      setActionSuccess(`"${uploaded.title}" encrypted and added to your Vault.`);
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
    } finally {
      setUploadPhase("idle");
    }
  }

  async function onDownload(doc: VaultDocument) {
    if (!accessToken || !doc.hasBinary) return;
    setBusyId(doc.id);
    setBusyAction("download");
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
      setBusyAction(null);
    }
  }

  async function onShare(doc: VaultDocument) {
    setBusyId(doc.id);
    setBusyAction("share");
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
      setBusyAction(null);
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
      setBusyAction("replace");
      setActionError(null);
      try {
        const gcs = await uploadFileToGcs(next, {
          folder: `vault/${userId || "anon"}/replace`,
        });
        await replaceDoc({
          id: doc.id,
          fileUrl: gcs.url,
          byteSize: gcs.sizeBytes,
          contentType: gcs.mimeType,
          originalFilename: gcs.originalName,
        }).unwrap();
        setActionSuccess(`Document "${doc.title}" replaced with new encrypted version.`);
      } catch {
        setActionError("Replace failed.");
      } finally {
        setBusyId(null);
        setBusyAction(null);
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
    setBusyAction("delete");
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
      setBusyAction(null);
    }
  }

  if (!hasHydrated || (accessToken && (isLoading || capLoading))) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner label="Opening encrypted Travel Vault…" />
          <p className="text-xs tracking-wider uppercase text-ink-faint">
            Decrypting credentials &amp; certificates
          </p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md w-full rounded-3xl border border-white/95 bg-white/90 p-8 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky/10 text-sky">
            <Lock size={26} strokeWidth={2} />
          </div>
          <h2 className="font-hero text-2xl font-bold text-navy">Authentication Required</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Sign in with verified credentials to access your AES-256 encrypted biometric vault and travel certificates.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full rounded-full font-semibold shadow-lg"
            onClick={() => {
              window.location.href = "/login?redirect=/vault";
            }}
          >
            Sign In to Travel Vault
          </Button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md w-full rounded-3xl border border-white/95 bg-white/90 p-8 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertCircle size={26} strokeWidth={2} />
          </div>
          <h2 className="font-hero text-xl font-bold text-navy">Vault Unavailable</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Could not retrieve your stored documents from the secure vault cluster.
          </p>
          <Button size="md" variant="secondary" className="mt-5" onClick={() => refetch()}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const providerLabel = capability?.configured ? capability.provider : "Standard Safe";
  const maxMbNote = capability?.maxBytes
    ? `Max ${(capability.maxBytes / (1024 * 1024)).toFixed(0)} MB / doc`
    : null;

  // Geometry for Circular Readiness Gauge
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (healthScore / 100) * circumference;

  return (
    <div className="fo-vault__master-stage">
      {/* ── Master Hero Showcase Section ─────────────────────────────── */}
      <div className="fo-vault__hero-showcase">
        {/* Left Column: Bold Typography & Action Controls */}
        <div className="fo-vault__hero-left">
          <div className="fo-vault__hero-eyebrow">
            <Shield size={13} strokeWidth={2.2} className="text-sky" />
            <span>ZERO-KNOWLEDGE BIOMETRIC STORAGE</span>
          </div>

          <h1 className="fo-vault__hero-title">
            TRAVEL VAULT<br />
            <span className="fo-vault__hero-title-accent">AI ENCRYPTED</span>
          </h1>

          <p className="fo-vault__hero-lede">
            Encrypted biometric passports, national IDs, visas, and flight vouchers. Instant AI OCR verification unlocks autonomous hands-free booking.
          </p>

          <div className="fo-vault__hero-cta-group">
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setShowUploadModal(true);
              }}
              className="fo-vault__cta-primary"
            >
              <span>Upload Document</span>
              <span className="fo-vault__cta-icon-circle">
                <ChevronRight size={14} strokeWidth={2.5} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory("EXPIRING");
              }}
              className="fo-vault__cta-secondary"
            >
              <ShieldCheck size={14} strokeWidth={2} className="text-emerald" />
              <span>Audit Validity</span>
            </button>
          </div>

          {/* Bottom 3 Feature Pills */}
          <div className="fo-vault__feature-pills">
            <div className="fo-vault__feature-pill">
              <span className="fo-vault__feature-pill-dot fo-vault__feature-pill-dot--cyan" />
              <span>AES-256 Hardware Encrypted</span>
            </div>
            <div className="fo-vault__feature-pill">
              <span className="fo-vault__feature-pill-dot fo-vault__feature-pill-dot--emerald" />
              <span>Automated AI OCR</span>
            </div>
            <div className="fo-vault__feature-pill">
              <span className="fo-vault__feature-pill-dot fo-vault__feature-pill-dot--amber" />
              <span>Instant Booking Sync</span>
            </div>
          </div>
        </div>

        {/* Right Column: Scenic Canvas with Floating Instrument Dials */}
        <div className="fo-vault__hero-right">
          <div className="fo-vault__canvas-container">
            <div className="fo-vault__canvas-backdrop">
              <div className="fo-vault__canvas-glow" />
              <div className="fo-vault__canvas-image" />
              <div className="fo-vault__canvas-scan" aria-hidden />

              {/* Security Network / Cryptographic SVG Arcs */}
              <svg className="fo-vault__canvas-route" viewBox="0 0 500 300" fill="none" preserveAspectRatio="none">
                <path
                  d="M 40 220 Q 160 80 280 160 T 460 100"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                />
                <circle cx="40" cy="220" r="4.5" fill="#00D2FF" />
                <circle cx="280" cy="160" r="4.5" fill="#FFFFFF" />
                <circle cx="460" cy="100" r="5" fill="#25D366" />
              </svg>
            </div>

            <div className="fo-vault__canvas-tags">
              <div className="fo-vault__canvas-tag fo-vault__canvas-tag--mid">
                <ShieldCheck size={12} strokeWidth={2.2} className="text-emerald" />
                <span>Biometric Passport Ready</span>
              </div>
              <div className="fo-vault__canvas-tag fo-vault__canvas-tag--top">
                <Lock size={12} strokeWidth={2.2} className="text-sky" />
                <span>Zero-Knowledge Storage</span>
              </div>
            </div>

            <div className="fo-vault__canvas-instruments">
            {/* Floating Readiness Instrument (Health Dial) */}
            <div className="fo-vault__dial-widget">
              <div className="fo-vault__dial-head">
                <span className="fo-vault__dial-label">VAULT HEALTH</span>
                <span className="fo-vault__dial-arrow">↗</span>
              </div>

              <div className="fo-vault__dial-circle-wrap">
                <svg className="fo-vault__dial-svg" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    className="fo-vault__dial-track"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    className="fo-vault__dial-progress"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                </svg>

                <div className="fo-vault__dial-value">
                  <span className="fo-vault__dial-number">{healthScore}</span>
                  <span className="fo-vault__dial-percent">%</span>
                </div>
              </div>

              <div className="fo-vault__dial-status-pills">
                <span className={`fo-vault__dial-status-pill${healthScore === 100 ? " fo-vault__dial-status-pill--active" : ""}`}>
                  Optimal
                </span>
                <span className={`fo-vault__dial-status-pill${healthScore < 100 && healthScore >= 70 ? " fo-vault__dial-status-pill--active" : ""}`}>
                  Expiring
                </span>
                <span className={`fo-vault__dial-status-pill${healthScore < 70 ? " fo-vault__dial-status-pill--active" : ""}`}>
                  Attention
                </span>
              </div>
            </div>

            {/* Floating Credentials Widget (Bottom Right) */}
            <div className="fo-vault__credentials-widget">
              <div className="fo-vault__credentials-icon">
                <ShieldCheck size={18} strokeWidth={2.2} className="text-emerald" />
              </div>
              <div className="fo-vault__credentials-info">
                <p className="fo-vault__credentials-name">
                  {stats.valid} of {stats.total} Valid Credentials
                </p>
                <p className="fo-vault__credentials-sub">
                  {stats.expired > 0 ? `${stats.expired} expired action needed` : "All passports travel-ready"}
                </p>
                <div className="fo-vault__credentials-status">
                  <span className={`fo-vault__credentials-dot${stats.expired > 0 ? " fo-vault__credentials-dot--warn" : ""}`} />
                  <span>{stats.expired > 0 ? "Renewal Needed" : "Ready for Departure"}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Strip ───────────────────────────────────────────── */}
      <VaultSummaryStrip
        total={stats.total}
        valid={stats.valid}
        expiring={stats.expiring}
        expired={stats.expired}
        providerLabel={providerLabel}
        maxMbNote={maxMbNote}
      />

      {/* ── Flash Notifications ──────────────────────────────────────── */}
      {actionSuccess ? (
        <div className="fo-vault__flash fo-vault__flash--ok" role="status">
          <span className="flex items-center gap-2">
            <Check size={15} strokeWidth={2.5} className="text-emerald" />
            <span>{actionSuccess}</span>
          </span>
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
          <span className="flex items-center gap-2">
            <AlertCircle size={15} strokeWidth={2.5} className="text-danger" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            className="fo-vault__flash-dismiss"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* ── Toolbar & Live Search ────────────────────────────────────── */}
      <div className="fo-vault__toolbar">
        <VaultCategoryTabs selected={selectedCategory} onChange={setSelectedCategory} />
        <div className="fo-vault__search">
          <div className="fo-vault__search-wrap">
            <Search
              size={15}
              strokeWidth={2}
              className="fo-vault__search-icon"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, IATA, or visa…"
              aria-label="Search stored documents"
            />
          </div>
        </div>
      </div>

      {/* ── Content Panels / Grouped Items ───────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-black/8 bg-white/85 p-12 text-center shadow-sm backdrop-blur-md">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky/10 text-sky">
            <FilePlus2 size={26} strokeWidth={1.75} />
          </div>
          <h3 className="font-hero text-lg font-bold text-navy">
            {searchQuery ? "No matching documents found" : "Your Travel Vault is Empty"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            {searchQuery
              ? "Try adjusting your search keywords or clear filters to view all documents."
              : "Upload encrypted passports, visas, loyalty cards, and tickets for autonomous flight booking."}
          </p>
          <div className="mt-5 flex justify-center">
            <Button
              size="md"
              onClick={() => {
                setSearchQuery("");
                setActionError(null);
                setShowUploadModal(true);
              }}
              icon={<FilePlus2 size={15} strokeWidth={2} />}
            >
              {searchQuery ? "Clear Search & Add" : "Add Your First Document"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="fo-vault__groups">
          {groupedItems.map((group) => (
            <div key={group.type} className="fo-vault__panel">
              <div className="fo-vault__panel-head">
                <h3 className="fo-vault__panel-title">
                  <ShieldCheck size={16} strokeWidth={2.2} className="text-sky" />
                  <span>{VAULT_TYPE_LABELS[group.type] || group.type}</span>
                </h3>
                <span className="fo-vault__panel-count">
                  {group.items.length} credential{group.items.length === 1 ? "" : "s"}
                </span>
              </div>

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
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Modal ─────────────────────────────────────────────── */}
      {showUploadModal ? (
        <VaultUploadModal
          uploadTitle={uploadTitle}
          uploadType={uploadType}
          uploadIssue={uploadIssue}
          uploadExpiry={uploadExpiry}
          uploadFile={uploadFile}
          uploadVisa={uploadVisa}
          uploading={uploadPhase !== "idle" || uploading}
          uploadPhase={uploadPhase}
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

      {/* ── Document Details Modal ───────────────────────────────────── */}
      {selectedDocId && (selectedFallback || rawItems.find((d) => d.id === selectedDocId)) ? (
        <VaultDocumentDetails
          documentId={selectedDocId}
          fallback={
            (rawItems.find((d) => d.id === selectedDocId) ?? selectedFallback) as VaultDocument
          }
          busy={busyId === selectedDocId}
          busyAction={busyId === selectedDocId ? busyAction : null}
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

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
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
