"use client";

import Link from "next/link";
import {
  BookUser,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Lock,
  RefreshCw,
  ScanText,
  Share2,
  ShieldCheck,
  Stamp,
  Ticket,
  Trash2,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui";
import { DocumentOcrPanel } from "@/app/profile/_components/DocumentOcrPanel";
import type { IdentityDocument } from "@/lib/api/profile.api";
import type { VaultDocument } from "@/lib/api/vault.api";
import { isIdentityVaultType } from "@/lib/profile/ocrReview";
import { VAULT_TYPE_LABELS, visaStatusLabel } from "@/lib/vault/visaStatus";
import {
  expiryDisplay,
  formatByteSize,
  vaultDocIconKind,
} from "./vaultFormat";

function DocTypeIcon({ type }: { type: string }) {
  const kind = vaultDocIconKind(type);
  const props = { size: 18, strokeWidth: 2, "aria-hidden": true as const };
  switch (kind) {
    case "passport":
      return <BookUser {...props} />;
    case "visa":
      return <Stamp {...props} />;
    case "ticket":
      return <Ticket {...props} />;
    case "loyalty":
      return <CreditCard {...props} />;
    case "lock":
      return <Lock {...props} />;
    default:
      return <FileText {...props} />;
  }
}

export function VaultDocRow({
  doc,
  verification,
  identityDoc,
  showOcr,
  busy,
  onDetails,
  onDownload,
  onShare,
  onReplace,
  onDelete,
  onToggleOcr,
}: {
  doc: VaultDocument;
  verification?: string;
  identityDoc: IdentityDocument | null;
  showOcr: boolean;
  busy: boolean;
  onDetails: () => void;
  onDownload: () => void;
  onShare: () => void;
  onReplace: () => void;
  onDelete: () => void;
  onToggleOcr: () => void;
}) {
  const expiry = expiryDisplay(doc.expiresAt);
  const size = formatByteSize(doc.byteSize);
  const typeLabel = VAULT_TYPE_LABELS[doc.type] || doc.type.replaceAll("_", " ");
  const isVerified = verification === "VERIFIED";

  return (
    <li className="fo-vault__row">
      <div className="fo-vault__row-main">
        <span className="fo-vault__doc-icon">
          <DocTypeIcon type={doc.type} />
        </span>
        <div className="fo-vault__doc-body">
          <div className="fo-vault__doc-top">
            <h3 className="fo-vault__doc-title">{doc.title}</h3>
            <span className="fo-vault__doc-type">{typeLabel}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
            <span className={`fo-vault__expiry fo-vault__expiry--${expiry.tone}`}>
              {expiry.label}
            </span>
            {doc.type === "VISA" && doc.visaMeta ? (
              <span className="text-ink-soft">
                · {visaStatusLabel(doc.visaMeta.visaStatus)}
                {doc.visaMeta.destinationCode ? ` · ${doc.visaMeta.destinationCode}` : ""}
              </span>
            ) : null}
            {verification ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                  isVerified
                    ? "bg-emerald/10 text-emerald"
                    : "bg-amber-500/10 text-amber-700"
                }`}
              >
                {isVerified ? "Profile Verified" : "Verification Pending"}
              </span>
            ) : null}
            {doc.isPlatformIssued ? (
              <span className="rounded-full bg-sky/10 px-2 py-0.5 text-[10.5px] font-bold uppercase text-sky">
                Platform Issued
              </span>
            ) : null}
          </div>

          <p className="fo-vault__doc-meta fo-vault__doc-meta--muted">
            {doc.originalFilename || "Metadata only"}
            {size ? ` · ${size}` : ""}
            <span className="inline-flex items-center gap-1 text-emerald font-medium ml-1.5">
              <ShieldCheck size={11} strokeWidth={2.2} />
              AES-256 Encrypted
            </span>
          </p>
        </div>
      </div>

      <div className="fo-vault__row-actions">
        <div className="fo-vault__action-group">
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDetails}>
            Details
          </Button>
          {doc.type === "TICKET" && doc.bookingId ? (
            <Link
              href={`/checkout/${doc.bookingId}`}
              className={buttonClassName({ size: "sm", variant: "ghost" })}
              title="Open full interactive e-ticket in new tab"
              target="_blank"
            >
              <ExternalLink size={13} strokeWidth={2} aria-hidden />
              Ticket
            </Link>
          ) : null}
          {doc.hasBinary && doc.isActive ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={onDownload}
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
              onClick={onShare}
              icon={<Share2 size={13} strokeWidth={2} aria-hidden />}
              title="Copy temporary 24h share token"
            >
              Share
            </Button>
          ) : null}
          {isIdentityVaultType(doc.type) && doc.isActive && doc.hasBinary ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onToggleOcr}
              icon={<ScanText size={13} strokeWidth={2} aria-hidden />}
            >
              {showOcr ? "Hide OCR" : "AI OCR"}
            </Button>
          ) : null}
        </div>

        {!doc.isPlatformIssued && doc.isActive ? (
          <div className="fo-vault__action-group">
            <button
              type="button"
              className="fo-vault__text-btn"
              disabled={busy}
              onClick={onReplace}
            >
              <RefreshCw size={12} strokeWidth={2} className="inline mr-1" />
              Replace
            </button>
            <button
              type="button"
              className="fo-vault__text-btn fo-vault__text-btn--danger"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={12} strokeWidth={2} className="inline mr-1" />
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {showOcr && identityDoc ? (
        <div className="fo-vault__ocr">
          <DocumentOcrPanel document={identityDoc} compact />
        </div>
      ) : null}
    </li>
  );
}
