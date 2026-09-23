"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Download,
  Lock,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import {
  useGetVaultDocumentQuery,
  useUpdateVaultDocumentMutation,
  type VaultDocument,
} from "@/lib/api/vault.api";
import { VAULT_TYPE_LABELS, visaStatusLabel } from "@/lib/vault/visaStatus";
import { formatByteSize, formatVaultDateTime } from "./vaultFormat";
import {
  VisaMetaFields,
  visaMetaFormFromInput,
  visaMetaFormToInput,
  type VisaMetaFormValue,
} from "./VisaMetaFields";

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (value && typeof value === "object") return Object.values(value).map((x) => String(x));
  return [];
}

function embassyLines(info: unknown): string[] {
  if (!info || typeof info !== "object") return [];
  const rec = info as Record<string, unknown>;
  return ["name", "address", "phone", "jurisdiction", "hours"]
    .map((key) => rec[key])
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => String(v));
}

type VaultDocAction = "download" | "share" | "replace" | "delete" | null;

const EXPIRY_STATUS_LABELS: Record<string, string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

export function VaultDocumentDetails({
  documentId,
  fallback,
  busy,
  busyAction = null,
  actionError = null,
  actionSuccess = null,
  onDismissAction,
  onClose,
  onDownload,
  onShare,
  onReplace,
  onDelete,
}: {
  documentId: string;
  fallback: VaultDocument;
  busy: boolean;
  busyAction?: VaultDocAction;
  /** Result of a document-level action (share / download / replace). Rendered
   *  inside this dialog — the page-level flash sits behind the overlay, so a
   *  share token "copied" confirmation was invisible while the modal was open. */
  actionError?: string | null;
  actionSuccess?: string | null;
  onDismissAction?: () => void;
  onClose: () => void;
  onDownload: (doc: VaultDocument) => void;
  onShare: (doc: VaultDocument) => void;
  onReplace: (doc: VaultDocument) => void;
  onDelete: (doc: VaultDocument) => void;
}) {
  const { data, isLoading, isError, refetch } = useGetVaultDocumentQuery(documentId);
  const [updateDoc, updateState] = useUpdateVaultDocumentMutation();
  const doc = data ?? fallback;

  const [title, setTitle] = useState(doc.title);
  const [issueDate, setIssueDate] = useState(doc.issueDate ? doc.issueDate.slice(0, 10) : "");
  const [expiresAt, setExpiresAt] = useState(doc.expiresAt ? doc.expiresAt.slice(0, 10) : "");
  const [visaForm, setVisaForm] = useState<VisaMetaFormValue>(visaMetaFormFromInput(doc.visaMeta));
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTitle(doc.title);
    setIssueDate(doc.issueDate ? doc.issueDate.slice(0, 10) : "");
    setExpiresAt(doc.expiresAt ? doc.expiresAt.slice(0, 10) : "");
    setVisaForm(visaMetaFormFromInput(doc.visaMeta));
  }, [doc.id, doc.title, doc.issueDate, doc.expiresAt, doc.visaMeta]);

  const intelligence = data?.visaIntelligence ?? null;
  const canEdit = doc.isActive && !doc.isPlatformIssued;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setFormError(null);
    setFormSuccess(null);
    try {
      await updateDoc({
        id: doc.id,
        title: title.trim() || doc.title,
        issueDate: issueDate ? new Date(issueDate).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        ...(doc.type === "VISA" ? { visaMeta: visaMetaFormToInput(visaForm) } : {}),
      }).unwrap();
      setFormSuccess("Document details saved successfully.");
    } catch (err) {
      setFormError(
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message || "Save failed")
          : "Save failed",
      );
    }
  }

  const requiredDocs = asStringList(intelligence?.requiredDocuments);
  const embassy = embassyLines(intelligence?.embassyInfo);
  const size = formatByteSize(doc.byteSize);

  const dialog = (
    <div className="fo-vault__overlay" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-detail-title"
        className="fo-vault__dialog fo-vault__dialog--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fo-vault__dialog-head">
          <div>
            <p className="fo-vault__dialog-kicker">
              <Lock size={12} strokeWidth={2.2} aria-hidden />
              <span>{VAULT_TYPE_LABELS[doc.type] || doc.type} · AES-256 VAULT</span>
            </p>
            <h3 id="vault-detail-title" className="fo-vault__dialog-title">
              {doc.title}
            </h3>
          </div>
          <button
            type="button"
            className="fo-vault__close"
            onClick={onClose}
            aria-label="Close document details"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {isLoading && !data ? (
          <div className="flex justify-center py-12">
            <Spinner label="Decrypting document record…" />
          </div>
        ) : isError ? (
          <div className="fo-vault__dialog-body">
            <div className="fo-vault__flash fo-vault__flash--err" role="alert">
              <span>Could not load full document details from secure store.</span>
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="fo-vault__dialog-body">
            <div className="fo-vault__summary-card">
              <div className="fo-vault__status-pills">
                <span className="fo-vault__status-pill fo-vault__status-pill--ok">
                  <ShieldCheck size={11} strokeWidth={2.4} aria-hidden />
                  {doc.lifecycleStatus || (doc.isActive ? "ACTIVE" : "SUPERSEDED")}
                </span>
                {/* "unknown" is the absence of an expiry signal, not a state worth
                    a chip — showing it gives missing data the same weight as ACTIVE. */}
                {doc.expiryStatus && doc.expiryStatus !== "unknown" ? (
                  <span
                    className={`fo-vault__status-pill${
                      doc.expiryStatus === "expired"
                        ? " fo-vault__status-pill--danger"
                        : doc.expiryStatus === "expiring_soon"
                          ? " fo-vault__status-pill--warn"
                          : ""
                    }`}
                  >
                    {EXPIRY_STATUS_LABELS[doc.expiryStatus] ??
                      doc.expiryStatus.replaceAll("_", " ")}
                  </span>
                ) : null}
                {doc.type === "VISA" && doc.visaMeta ? (
                  <span className="fo-vault__status-pill">
                    {visaStatusLabel(doc.visaMeta.visaStatus)}
                    {doc.visaMeta.destinationCode ? ` · ${doc.visaMeta.destinationCode}` : ""}
                  </span>
                ) : null}
                {doc.isPlatformIssued ? (
                  <span className="fo-vault__status-pill fo-vault__status-pill--sky">
                    Platform Issued · Immutable
                  </span>
                ) : null}
              </div>

              <dl className="fo-vault__facts">
                <div className="fo-vault__fact">
                  <dt>Issue date</dt>
                  <dd>{formatVaultDateTime(doc.issueDate)}</dd>
                </div>
                <div className="fo-vault__fact">
                  <dt>Expiry date</dt>
                  <dd>{formatVaultDateTime(doc.expiresAt)}</dd>
                </div>
                <div className="fo-vault__fact">
                  <dt>Stored file</dt>
                  <dd>
                    {doc.originalFilename || "Metadata only"}
                    {size ? ` · ${size}` : ""}
                  </dd>
                </div>
                <div className="fo-vault__fact">
                  <dt>Vault version</dt>
                  <dd>v{doc.version}</dd>
                </div>
              </dl>
            </div>

            {doc.type === "VISA" && intelligence ? (
              <div className="fo-vault__guidance">
                <div className="fo-vault__guidance-head">
                  <p className="fo-vault__guidance-title">Attributed Visa Intelligence</p>
                  <span className="rounded-full bg-sky/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-sky">
                    {intelligence.isFact ? "Attributed Fact" : "Guidance Only"}
                    {intelligence.dataStatus ? ` · ${intelligence.dataStatus}` : ""}
                  </span>
                </div>
                <p className="m-0 text-xs text-ink-soft">{intelligence.confidenceNote}</p>
                {intelligence.processingDaysMin != null || intelligence.processingDaysMax != null ? (
                  <p className="m-0 text-xs text-ink-soft">
                    Processing time on file: <strong>{intelligence.processingDaysMin ?? "—"}–{intelligence.processingDaysMax ?? "—"} days</strong>
                    {intelligence.source ? ` (source: ${intelligence.source})` : ""}.
                  </p>
                ) : (
                  <p className="m-0 text-xs text-ink-faint">
                    No attributed processing-time estimate is on file.
                  </p>
                )}
                {embassy.length ? (
                  <div>
                    <p className="m-0 text-xs font-semibold text-navy">
                      Embassy / Authority on Record
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                      {embassy.map((line) => (
                        <li key={line}>· {line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {requiredDocs.length ? (
                  <div>
                    <p className="m-0 text-xs font-semibold text-navy">
                      Required Documents Checklist
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-ink-soft">
                      {requiredDocs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {intelligence.linkedApplication ? (
                  <p className="m-0 text-xs text-ink-soft">
                    Linked application: <strong>{intelligence.linkedApplication.status}</strong>
                    {intelligence.linkedApplication.appointmentAt
                      ? ` · Appointment: ${formatVaultDateTime(intelligence.linkedApplication.appointmentAt)}`
                      : ""}
                    {intelligence.linkedApplication.appointmentLocation
                      ? ` · ${intelligence.linkedApplication.appointmentLocation}`
                      : ""}
                  </p>
                ) : null}
                <p className="m-0 text-[11.5px] text-ink-faint">
                  Live embassy verification requires consular submission.{" "}
                  <Link
                    href="/visa"
                    className="text-sky font-semibold underline underline-offset-2 hover:text-navy"
                  >
                    Open Visa Intelligence →
                  </Link>
                </p>
              </div>
            ) : null}

            {canEdit ? (
              <form
                onSubmit={(e) => void onSave(e)}
                aria-labelledby="vault-edit-heading"
                className="space-y-4 border-t border-[rgba(14,22,32,0.06)] pt-5"
              >
                <h3
                  id="vault-edit-heading"
                  className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint"
                >
                  Edit details
                </h3>
                <Input
                  label="Document Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Issue Date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                  <Input
                    label="Expiration Date"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                {doc.type === "VISA" ? (
                  <VisaMetaFields
                    value={visaForm}
                    onChange={setVisaForm}
                    disabled={updateState.isLoading}
                  />
                ) : null}
                {formError ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-2 text-xs font-semibold text-danger"
                  >
                    {formError}
                  </p>
                ) : null}
                {formSuccess ? (
                  <p
                    role="status"
                    className="rounded-xl border border-emerald/20 bg-emerald/10 px-3.5 py-2 text-xs font-semibold text-emerald flex items-center gap-1.5"
                  >
                    <Check size={14} strokeWidth={2.5} />
                    <span>{formSuccess}</span>
                  </p>
                ) : null}
                {/* Right-aligned at the form's end: the save button belongs to the
                    fields above it, not to the document-level actions in the footer. */}
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateState.isLoading} size="md">
                    {updateState.isLoading ? (
                      <>
                        <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                        <span>Saving…</span>
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="m-0 text-xs text-ink-faint">
                {doc.isPlatformIssued
                  ? "Platform-issued tickets and vouchers are cryptographically immutable."
                  : "Superseded documents are archived for travel history audit."}
              </p>
            )}

            {actionSuccess || actionError ? (
              <div
                className={`fo-vault__dialog-flash${
                  actionError ? " fo-vault__dialog-flash--err" : " fo-vault__dialog-flash--ok"
                }`}
                role={actionError ? "alert" : "status"}
              >
                {actionError ? (
                  <AlertCircle size={15} strokeWidth={2.2} aria-hidden />
                ) : (
                  <Check size={15} strokeWidth={2.5} aria-hidden />
                )}
                <span className="fo-vault__dialog-flash-text">{actionError ?? actionSuccess}</span>
                {onDismissAction ? (
                  <button
                    type="button"
                    className="fo-vault__dialog-flash-dismiss"
                    onClick={onDismissAction}
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="fo-vault__dialog-foot">
              <div className="fo-vault__action-group">
                {doc.hasBinary && doc.isActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onDownload(doc)}
                    icon={
                      busyAction === "download" ? (
                        <Spinner size="sm" label={null} />
                      ) : (
                        <Download size={13} strokeWidth={2} aria-hidden />
                      )
                    }
                  >
                    {busyAction === "download"
                      ? "Downloading…"
                      : doc.type === "TICKET"
                        ? "Download Ticket"
                        : doc.type === "HOTEL_VOUCHER"
                          ? "Download Voucher"
                          : "Download Scan"}
                  </Button>
                ) : null}
                {doc.isActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onShare(doc)}
                    icon={
                      busyAction === "share" ? (
                        <Spinner size="sm" label={null} />
                      ) : (
                        <Share2 size={13} strokeWidth={2} aria-hidden />
                      )
                    }
                  >
                    {busyAction === "share" ? "Generating…" : "Share Token"}
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onReplace(doc)}
                    icon={
                      busyAction === "replace" ? (
                        <Spinner size="sm" label={null} />
                      ) : (
                        <RefreshCw size={13} strokeWidth={2} aria-hidden />
                      )
                    }
                  >
                    {busyAction === "replace" ? "Uploading…" : "Replace Scan"}
                  </Button>
                ) : null}
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => onDelete(doc)}
                  icon={
                    busyAction === "delete" ? (
                      <Spinner size="sm" label={null} />
                    ) : (
                      <Trash2 size={13} strokeWidth={2} aria-hidden />
                    )
                  }
                >
                  {busyAction === "delete" ? "Deleting…" : "Delete"}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
