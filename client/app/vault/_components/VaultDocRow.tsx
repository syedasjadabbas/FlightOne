"use client";

import {
  BookUser,
  Download,
  FileText,
  Lock,
  ScanText,
  Share2,
  Ticket,
  CreditCard,
  Stamp,
} from "lucide-react";
import { Button } from "@/components/ui";
import { TravellerChip } from "@/app/components/traveller";
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
  const props = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };
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

  return (
    <li className="fo-vault__row">
      <div className="fo-vault__row-main">
        <span className="fo-vault__doc-icon">
          <DocTypeIcon type={doc.type} />
        </span>
        <div className="fo-vault__doc-body">
          <div className="fo-vault__doc-top">
            <h3 className="fo-vault__doc-title">{doc.title}</h3>
            <p className="fo-vault__doc-type">{typeLabel}</p>
          </div>

          <p className={`fo-vault__doc-meta fo-vault__expiry fo-vault__expiry--${expiry.tone}`}>
            {expiry.label}
            {doc.type === "VISA" && doc.visaMeta ? (
              <>
                {" · "}
                {visaStatusLabel(doc.visaMeta.visaStatus)}
                {doc.visaMeta.destinationCode ? ` · ${doc.visaMeta.destinationCode}` : ""}
              </>
            ) : null}
          </p>

          <p className="fo-vault__doc-meta fo-vault__doc-meta--muted">
            {doc.originalFilename || "Metadata only"}
            {size ? ` · ${size}` : ""}
            {doc.isPlatformIssued ? " · Platform issued" : ""}
            {verification ? ` · Profile ${verification}` : ""}
          </p>

          {doc.isPlatformIssued ? (
            <div className="mt-1.5">
              <TravellerChip tone="muted">Immutable</TravellerChip>
            </div>
          ) : null}
        </div>
      </div>

      <div className="fo-vault__row-actions">
        <div className="fo-vault__action-group">
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDetails}>
            Details
          </Button>
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
              {showOcr ? "Hide scan" : "Scan"}
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
              Replace
            </button>
            <button
              type="button"
              className="fo-vault__text-btn fo-vault__text-btn--danger"
              disabled={busy}
              onClick={onDelete}
            >
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
