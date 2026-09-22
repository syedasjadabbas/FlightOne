"use client";

import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { TravellerSection, TravellerState } from "@/app/components/traveller";

type ReferralItem = { id: string; status: string; rewardedAt: string | null };

type RewardsReferralSectionProps = {
  referralCode: string;
  referralLink: string | null;
  referralBonusPoints: number;
  referrals: ReferralItem[];
  referralInput: string;
  onReferralInputChange: (value: string) => void;
  onAttach: () => Promise<void>;
  attaching: boolean;
  localMsg: string | null;
  localMsgTone?: "ok" | "error";
};

export function RewardsReferralSection({
  referralCode,
  referralLink,
  referralBonusPoints,
  referrals,
  referralInput,
  onReferralInputChange,
  onAttach,
  attaching,
  localMsg,
  localMsgTone = "ok",
}: RewardsReferralSectionProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  return (
    <TravellerSection
      title="Referral program"
      note={`Share your referral code. Bonus (${referralBonusPoints} pts) is credited when your invitee completes their first ticketed earn.`}
      panel
    >
      <div className="fo-rewards__code">
        <p className="fo-rewards__code-value">{referralCode}</p>
        {referralLink ? (
          <button
            type="button"
            className="fo-rewards__copy"
            onClick={() => {
              void navigator.clipboard?.writeText(referralLink);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2500);
            }}
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Link copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy invite link
              </>
            )}
          </button>
        ) : null}
      </div>

      {referrals.length === 0 ? (
        <TravellerState title="No referrals yet">
          Share your invite code. The {referralBonusPoints}-point bonus posts only after their first
          ticketed earn.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list mt-3">
          {referrals.map((r) => (
            <li key={r.id} className="fo-traveller__row">
              <p className="fo-traveller__row-title">Referral · {r.status}</p>
              <p className="fo-traveller__row-meta">
                {r.rewardedAt
                  ? `Credited on ${new Date(r.rewardedAt).toLocaleDateString()}`
                  : "Pending first ticketed booking"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="fo-rewards__attach"
        onSubmit={(e) => {
          e.preventDefault();
          void onAttach();
        }}
      >
        <Input
          label="Have an invite code from a friend?"
          value={referralInput}
          onChange={(ev) => onReferralInputChange(ev.target.value.toUpperCase())}
          placeholder="e.g. AB12CD34"
        />
        <Button type="submit" size="sm" disabled={attaching || !referralInput.trim()}>
          {attaching ? "Attaching…" : "Apply referral code"}
        </Button>
        {localMsg ? (
          <p
            className={`fo-rewards__status${
              localMsgTone === "error" ? " fo-rewards__status--error" : " fo-rewards__status--ok"
            }`}
            role={localMsgTone === "error" ? "alert" : "status"}
          >
            {localMsgTone === "error" ? (
              <AlertCircle size={14} strokeWidth={2.2} aria-hidden />
            ) : (
              <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden />
            )}
            <span>{localMsg}</span>
          </p>
        ) : null}
      </form>
    </TravellerSection>
  );
}
