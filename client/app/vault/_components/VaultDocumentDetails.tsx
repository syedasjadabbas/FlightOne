"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import {
  useGetVaultDocumentQuery,
  useUpdateVaultDocumentMutation,
  type VaultDocument,
} from "@/lib/api/vault.api";
import { VAULT_TYPE_LABELS, visaStatusLabel } from "@/lib/vault/visaStatus";
import {
  VisaMetaFields,
  visaMetaFormFromInput,
  visaMetaFormToInput,
  type VisaMetaFormValue,
} from "./VisaMetaFields";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-detail-title"
        className="relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">
              {VAULT_TYPE_LABELS[doc.type] || doc.type}
            </p>
            <h3 id="vault-detail-title" className="mt-1 text-lg font-bold text-slate-900 font-[var(--font-sora)]">
              {doc.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close document details"
          >
            ✕
          </button>
        </div>

        {isLoading && !data ? (
          <div className="flex justify-center py-12">
            <Spinner label="Loading document…" />
          </div>
        ) : isError ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            Could not load full document details.
            <Button size="sm" variant="secondary" className="ml-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">
                {doc.lifecycleStatus || (doc.isActive ? "ACTIVE" : "SUPERSEDED")}
              </span>
              {doc.expiryStatus ? (
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-semibold text-slate-700">
                  Expiry: {doc.expiryStatus.replaceAll("_", " ")}
                </span>
              ) : null}
              {doc.type === "VISA" && doc.visaMeta ? (
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 font-semibold text-cyan-800">
                  {visaStatusLabel(doc.visaMeta.visaStatus)}
                  {doc.visaMeta.destinationCode ? ` · ${doc.visaMeta.destinationCode}` : ""}
                </span>
              ) : null}
              {doc.isPlatformIssued ? (
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 font-semibold text-cyan-800">
                  Platform issued — immutable
                </span>
              ) : null}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">Issue date</dt>
                <dd className="font-medium text-slate-800">{formatDate(doc.issueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">Expiry</dt>
                <dd className="font-medium text-slate-800">{formatDate(doc.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">File</dt>
                <dd className="font-medium text-slate-800">
                  {doc.originalFilename || "Metadata only"}
                  {doc.byteSize ? ` · ${(doc.byteSize / (1024 * 1024)).toFixed(2)} MB` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">Version</dt>
                <dd className="font-medium text-slate-800">{doc.version}</dd>
              </div>
            </dl>

            {doc.type === "VISA" && intelligence ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Visa guidance</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {intelligence.isFact ? "Attributed fact" : "Guidance only"}
                    {intelligence.dataStatus ? ` · ${intelligence.dataStatus}` : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{intelligence.confidenceNote}</p>
                {intelligence.processingDaysMin != null || intelligence.processingDaysMax != null ? (
                  <p className="text-xs text-slate-700">
                    Processing time on file: {intelligence.processingDaysMin ?? "—"}–
                    {intelligence.processingDaysMax ?? "—"} days
                    {intelligence.source ? ` (source: ${intelligence.source})` : ""}.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    No attributed processing-time estimate is on file. Times are not invented.
                  </p>
                )}
                {embassy.length ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Embassy / authority on file</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {embassy.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No attributed embassy directory entry is on file for this nationality × destination.
                  </p>
                )}
                {requiredDocs.length ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Required-document list on file</p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                      {requiredDocs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {intelligence.linkedApplication ? (
                  <p className="text-xs text-slate-700">
                    Linked application {intelligence.linkedApplication.status}
                    {intelligence.linkedApplication.appointmentAt
                      ? ` · appointment ${formatDate(intelligence.linkedApplication.appointmentAt)}`
                      : ""}
                    {intelligence.linkedApplication.appointmentLocation
                      ? ` · ${intelligence.linkedApplication.appointmentLocation}`
                      : ""}
                  </p>
                ) : null}
                <p className="text-[11px] text-slate-400">
                  Live government/Timatic verification is not claimed.{" "}
                  <Link href="/visa" className="underline underline-offset-2 text-cyan-800">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <VisaMetaFields value={visaForm} onChange={setVisaForm} disabled={updateState.isLoading} />
                ) : null}
                {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}
                {formSuccess ? <p className="text-xs font-semibold text-emerald-700">{formSuccess}</p> : null}
                <Button type="submit" disabled={updateState.isLoading}>
                  {updateState.isLoading ? "Saving…" : "Save metadata"}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                {doc.isPlatformIssued
                  ? "Platform-issued tickets and vouchers cannot be edited."
                  : "Superseded documents are retained for audit and cannot be edited."}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2">
                {doc.hasBinary && doc.isActive ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDownload(doc)}>
                    Download
                  </Button>
                ) : null}
                {doc.isActive ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onShare(doc)}>
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
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(doc)} className="text-rose-700">
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
