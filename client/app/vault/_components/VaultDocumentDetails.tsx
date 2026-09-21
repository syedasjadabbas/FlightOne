"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Share2, X } from "lucide-react";
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

export function VaultDocumentDetails({
  documentId,
  fallback,
  busy,
  onClose,
  onDownload,
  onShare,
  onReplace,
  onDelete,
}: {
  documentId: string;
  fallback: VaultDocument;
  busy: boolean;
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
      setFormSuccess("Document details saved.");
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

  return (
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
              <FileText size={11} strokeWidth={2} aria-hidden />
              {VAULT_TYPE_LABELS[doc.type] || doc.type}
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
            <Spinner label="Loading document…" />
          </div>
        ) : isError ? (
          <div className="fo-vault__dialog-body">
            <div className="fo-vault__flash fo-vault__flash--err" role="alert">
              <span>Could not load full document details.</span>
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="fo-vault__dialog-body">
            <div className="fo-vault__status-line">
              <span>
                Status{" "}
                <strong>
                  {doc.lifecycleStatus || (doc.isActive ? "ACTIVE" : "SUPERSEDED")}
                </strong>
              </span>
              {doc.expiryStatus ? (
                <span>
                  Expiry <strong>{doc.expiryStatus.replaceAll("_", " ")}</strong>
                </span>
              ) : null}
              {doc.type === "VISA" && doc.visaMeta ? (
                <span>
                  Visa{" "}
                  <strong>
                    {visaStatusLabel(doc.visaMeta.visaStatus)}
                    {doc.visaMeta.destinationCode ? ` · ${doc.visaMeta.destinationCode}` : ""}
                  </strong>
                </span>
              ) : null}
              {doc.isPlatformIssued ? (
                <span>
                  <strong>Platform issued</strong> — immutable
                </span>
              ) : null}
            </div>

            <dl className="fo-vault__facts">
              <div className="fo-vault__fact">
                <dt>Issue date</dt>
                <dd>{formatVaultDateTime(doc.issueDate)}</dd>
              </div>
              <div className="fo-vault__fact">
                <dt>Expiry</dt>
                <dd>{formatVaultDateTime(doc.expiresAt)}</dd>
              </div>
              <div className="fo-vault__fact">
                <dt>File</dt>
                <dd>
                  {doc.originalFilename || "Metadata only"}
                  {size ? ` · ${size}` : ""}
                </dd>
              </div>
              <div className="fo-vault__fact">
                <dt>Version</dt>
                <dd>{doc.version}</dd>
              </div>
            </dl>

            {doc.type === "VISA" && intelligence ? (
              <div className="fo-vault__guidance">
                <div className="fo-vault__guidance-head">
                  <p className="fo-vault__guidance-title">Visa guidance</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                    {intelligence.isFact ? "Attributed fact" : "Guidance only"}
                    {intelligence.dataStatus ? ` · ${intelligence.dataStatus}` : ""}
                  </span>
                </div>
                <p className="m-0 text-xs text-[var(--ink-soft)]">{intelligence.confidenceNote}</p>
                {intelligence.processingDaysMin != null || intelligence.processingDaysMax != null ? (
                  <p className="m-0 text-xs text-[var(--ink-soft)]">
                    Processing time on file: {intelligence.processingDaysMin ?? "—"}–
                    {intelligence.processingDaysMax ?? "—"} days
                    {intelligence.source ? ` (source: ${intelligence.source})` : ""}.
                  </p>
                ) : (
                  <p className="m-0 text-xs text-[var(--ink-faint)]">
                    No attributed processing-time estimate is on file. Times are not invented.
                  </p>
                )}
                {embassy.length ? (
                  <div>
                    <p className="m-0 text-xs font-semibold text-[var(--navy)]">
                      Embassy / authority on file
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-[var(--ink-soft)]">
                      {embassy.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="m-0 text-xs text-[var(--ink-faint)]">
                    No attributed embassy directory entry is on file for this nationality ×
                    destination.
                  </p>
                )}
                {requiredDocs.length ? (
                  <div>
                    <p className="m-0 text-xs font-semibold text-[var(--navy)]">
                      Required-document list on file
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-[var(--ink-soft)]">
                      {requiredDocs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {intelligence.linkedApplication ? (
                  <p className="m-0 text-xs text-[var(--ink-soft)]">
                    Linked application {intelligence.linkedApplication.status}
                    {intelligence.linkedApplication.appointmentAt
                      ? ` · appointment ${formatVaultDateTime(intelligence.linkedApplication.appointmentAt)}`
                      : ""}
                    {intelligence.linkedApplication.appointmentLocation
                      ? ` · ${intelligence.linkedApplication.appointmentLocation}`
                      : ""}
                  </p>
                ) : null}
                <p className="m-0 text-[11px] text-[var(--ink-faint)]">
                  Live government/Timatic verification is not claimed.{" "}
                  <Link
                    href="/visa"
                    className="text-[var(--electric)] underline underline-offset-2"
                  >
                    Open Visa Intelligence
                  </Link>
                </p>
              </div>
            ) : null}

            {canEdit ? (
              <form onSubmit={(e) => void onSave(e)} className="space-y-4">
                <Input
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Issue date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                  <Input
                    label="Expiry date"
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
                  <p className="text-xs font-semibold text-[var(--danger)]">{formError}</p>
                ) : null}
                {formSuccess ? (
                  <p className="text-xs font-semibold text-[var(--cyan)]">{formSuccess}</p>
                ) : null}
                <Button type="submit" disabled={updateState.isLoading}>
                  {updateState.isLoading ? "Saving…" : "Save metadata"}
                </Button>
              </form>
            ) : (
              <p className="m-0 text-xs text-[var(--ink-faint)]">
                {doc.isPlatformIssued
                  ? "Platform-issued tickets and vouchers cannot be edited."
                  : "Superseded documents are retained for audit and cannot be edited."}
              </p>
            )}

            <div className="fo-vault__dialog-foot">
              <div className="fo-vault__action-group">
                {doc.hasBinary && doc.isActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onDownload(doc)}
                    icon={<Download size={13} strokeWidth={2} aria-hidden />}
                  >
                    Download
                  </Button>
                ) : null}
                {doc.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onShare(doc)}
                    icon={<Share2 size={13} strokeWidth={2} aria-hidden />}
                  >
                    Share
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReplace(doc)}>
                    Replace file
                  </Button>
                ) : null}
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onDelete(doc)}
                  className="text-[var(--danger)]"
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
