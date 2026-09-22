"use client";

import { AlertTriangle, Clock, Files, HardDrive, ShieldCheck } from "lucide-react";
import { TravellerStatStrip, type TravellerStat } from "@/app/components/traveller";

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
  const stats: TravellerStat[] = [
    {
      key: "total",
      icon: <Files size={12} strokeWidth={2} aria-hidden />,
      label: "Total Stored",
      value: total,
      note: "Encrypted credentials",
      tone: "sky",
    },
    {
      key: "valid",
      icon: <ShieldCheck size={12} strokeWidth={2.2} aria-hidden />,
      label: "Travel Ready",
      value: valid,
      note: "Valid & verified",
      tone: "emerald",
    },
    {
      key: "expiring",
      icon:
        expired > 0 ? (
          <AlertTriangle size={12} strokeWidth={2} aria-hidden />
        ) : (
          <Clock size={12} strokeWidth={2} aria-hidden />
        ),
      label: expired > 0 ? "Action Required" : "Expiring Soon",
      value: expired > 0 ? expired : expiring,
      note:
        expired > 0
          ? `${expired} document${expired > 1 ? "s" : ""} expired`
          : expiring > 0
            ? `${expiring} within 90 days`
            : "All within validity",
      tone: expired > 0 ? "danger" : "amber",
    },
    {
      key: "security",
      icon: <HardDrive size={12} strokeWidth={2} aria-hidden />,
      label: "Vault Security",
      value: providerLabel,
      note: maxMbNote ?? "AES-256 encrypted at rest",
      tone: "sky",
      small: true,
    },
  ];

  return <TravellerStatStrip stats={stats} aria-label="Vault summary" />;
}
