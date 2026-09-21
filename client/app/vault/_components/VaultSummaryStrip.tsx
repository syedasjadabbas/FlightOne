"use client";

import { AlertTriangle, Clock, Files, HardDrive, ShieldCheck } from "lucide-react";

type VaultSummaryStripProps = {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
  providerLabel: string;
  maxMbNote: string | null;
};

export function VaultSummaryStrip({
  total,
  valid,
  expiring,
  expired,
  providerLabel,
  maxMbNote,
}: VaultSummaryStripProps) {
  return (
    <div className="fo-vault__summary" aria-label="Vault summary">
      <div className="fo-vault__stat">
        <p className="fo-vault__stat-label fo-vault__stat-label--sky">
          <Files size={12} strokeWidth={2} aria-hidden />
          <span>Total Stored</span>
        </p>
        <p className="fo-vault__stat-value">{total}</p>
        <p className="fo-vault__stat-note">Encrypted credentials</p>
      </div>

      <div className="fo-vault__stat">
        <p className="fo-vault__stat-label fo-vault__stat-label--emerald">
          <ShieldCheck size={12} strokeWidth={2.2} aria-hidden />
          <span>Travel Ready</span>
        </p>
        <p className="fo-vault__stat-value">{valid}</p>
        <p className="fo-vault__stat-note">Valid &amp; verified</p>
      </div>

      <div
        className={`fo-vault__stat${
          expired > 0 ? " fo-vault__stat--danger" : expiring > 0 ? " fo-vault__stat--warn" : ""
        }`}
      >
        <p
          className={`fo-vault__stat-label${
            expired > 0
              ? " fo-vault__stat-label--danger"
              : " fo-vault__stat-label--amber"
          }`}
        >
          {expired > 0 ? (
            <AlertTriangle size={12} strokeWidth={2} aria-hidden />
          ) : (
            <Clock size={12} strokeWidth={2} aria-hidden />
          )}
          <span>{expired > 0 ? "Action Required" : "Expiring Soon"}</span>
        </p>
        <p className="fo-vault__stat-value">{expired > 0 ? expired : expiring}</p>
        <p className="fo-vault__stat-note">
          {expired > 0
            ? `${expired} document${expired > 1 ? "s" : ""} expired`
            : expiring > 0
              ? `${expiring} within 90 days`
              : "All within validity"}
        </p>
      </div>

      <div className="fo-vault__stat">
        <p className="fo-vault__stat-label fo-vault__stat-label--sky">
          <HardDrive size={12} strokeWidth={2} aria-hidden />
          <span>Vault Security</span>
        </p>
        <p className="fo-vault__stat-value fo-vault__stat-value--sm">{providerLabel}</p>
        <p className="fo-vault__stat-note">{maxMbNote ?? "AES-256 encrypted at rest"}</p>
      </div>
    </div>
  );
}
