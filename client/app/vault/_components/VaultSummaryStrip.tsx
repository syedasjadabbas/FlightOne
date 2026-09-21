"use client";

import { HardDrive, ShieldCheck } from "lucide-react";

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
        <p className="fo-vault__stat-label">Stored</p>
        <p className="fo-vault__stat-value">{total}</p>
        <p className="fo-vault__stat-note">Documents in vault</p>
      </div>
      <div className="fo-vault__stat">
        <p className="fo-vault__stat-label">
          <ShieldCheck size={11} strokeWidth={2} className="mr-1 inline" aria-hidden />
          Valid
        </p>
        <p className="fo-vault__stat-value">{valid}</p>
        <p className="fo-vault__stat-note">Ready for travel</p>
      </div>
      <div
        className={`fo-vault__stat${expiring > 0 || expired > 0 ? " fo-vault__stat--warn" : ""}`}
      >
        <p className="fo-vault__stat-label">Expiring ≤90d</p>
        <p className="fo-vault__stat-value">{expiring}</p>
        <p className="fo-vault__stat-note">
          {expired > 0 ? `${expired} already expired` : "Renewal window"}
        </p>
      </div>
      <div className="fo-vault__stat">
        <p className="fo-vault__stat-label">
          <HardDrive size={11} strokeWidth={2} className="mr-1 inline" aria-hidden />
          Storage
        </p>
        <p className="fo-vault__stat-value fo-vault__stat-value--sm">{providerLabel}</p>
        <p className="fo-vault__stat-note">{maxMbNote ?? "Encrypted at rest"}</p>
      </div>
    </div>
  );
}
