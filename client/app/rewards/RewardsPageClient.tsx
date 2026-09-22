"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Lock, Search } from "lucide-react";
import { Button, Spinner, buttonClassName } from "@/components/ui";
import { TRAVELLER_PAGE_SIZE } from "@/app/components/traveller";
import {
  useAttachReferralMutation,
  useGetRewardLedgerEntryQuery,
  useGetRewardsLedgerQuery,
  useGetRewardsPolicyQuery,
  useGetRewardsReferralsQuery,
  useGetRewardsSummaryQuery,
} from "@/lib/api/rewards.api";
import { useListCompaniesQuery } from "@/lib/api/corporate.api";
import { useAuthStore } from "@/store/auth.store";
import {
  CorporateRewardsList,
  PolicyExplainer,
  RewardsBalanceHero,
  RewardsEarnSteps,
  RewardsEmptyBalance,
  RewardsLedgerSection,
  RewardsReferralSection,
} from "./_components";
import "./rewards.css";

export function RewardsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [referralInput, setReferralInput] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const skip = !hasHydrated || !accessToken;
  const {
    data: publicPolicy,
    isLoading: policyLoading,
    isError: policyError,
    refetch: refetchPolicy,
  } = useGetRewardsPolicyQuery(undefined, { skip: !hasHydrated || Boolean(accessToken) });
  const { data: summary, isLoading, isError, refetch } = useGetRewardsSummaryQuery(undefined, {
    skip,
  });
  const { data: ledger } = useGetRewardsLedgerQuery(
    { page: ledgerPage, pageSize: TRAVELLER_PAGE_SIZE },
    { skip },
  );
  const {
    data: entryDetail,
    isFetching: entryLoading,
    isError: entryError,
  } = useGetRewardLedgerEntryQuery(selectedEntryId || "", {
    skip: skip || !selectedEntryId,
  });
  const { data: referrals } = useGetRewardsReferralsQuery(undefined, { skip });
  const { data: companies } = useListCompaniesQuery(undefined, { skip });
  const [attach, attachState] = useAttachReferralMutation();

  const referralLink = useMemo(() => {
    if (!summary?.referralCode || typeof window === "undefined") return null;
    const origin = window.location.origin;
    return `${origin}/signup?ref=${summary.referralCode}`;
  }, [summary?.referralCode]);

  async function handleAttachReferral() {
    setLocalMsg(null);
    try {
      await attach({ code: referralInput.trim() }).unwrap();
      setLocalMsg("Referral code attached successfully.");
      setReferralInput("");
    } catch {
      setLocalMsg("Could not attach referral code (may be invalid or already attached).");
    }
  }

  if (!hasHydrated) {
    return (
      <div className="fo-rewards__boot" role="status" aria-live="polite">
        <Spinner label="Loading rewards…" />
        <p className="fo-rewards__boot-label">Loading rewards</p>
      </div>
    );
  }

  if (!accessToken) {
    if (policyLoading) {
      return (
        <div className="fo-rewards__boot" role="status" aria-live="polite">
          <Spinner label="Loading rewards policy…" />
          <p className="fo-rewards__boot-label">Loading rewards policy</p>
        </div>
      );
    }
    if (policyError || !publicPolicy) {
      return (
        <div className="fo-rewards__gate">
          <div className="fo-rewards__gate-box">
            <div className="fo-rewards__gate-icon fo-rewards__gate-icon--warn" aria-hidden>
              <AlertCircle size={22} strokeWidth={2} />
            </div>
            <h2 className="fo-rewards__gate-title">Rewards Unavailable</h2>
            <p className="fo-rewards__gate-desc">
              Could not load the published rewards policy.
            </p>
            <Button size="md" variant="secondary" onClick={() => void refetchPolicy()}>
              Retry Connection
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="fo-rewards__master-stage">
        <div className="fo-rewards__nav-rail">
          <span className="fo-rewards__brand-badge">
            <span className="fo-rewards__brand-dot" aria-hidden />
            Rewards
          </span>
          <div className="fo-rewards__rail-actions">
            <Link href="/login?redirect=%2Frewards" className={buttonClassName({ size: "sm" })}>
              Sign In to FlightOne
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="secondary">
                Create account
              </Button>
            </Link>
          </div>
        </div>

        <header className="fo-rewards__hero">
          <h1 className="fo-rewards__title">Rewards</h1>
          <p className="fo-rewards__lede">
            Points from ticketed bookings only. Sign in to see your own balance — this page never
            invents points.
          </p>
        </header>

        <div className="fo-rewards__panel">
          <RewardsEarnSteps policy={publicPolicy} />
        </div>

        <div className="fo-rewards__panel">
          <PolicyExplainer policy={publicPolicy} />
        </div>

        <div className="fo-rewards__gate" style={{ minHeight: "auto", padding: "0.5rem 0" }}>
          <div className="fo-rewards__gate-box">
            <div className="fo-rewards__gate-icon" aria-hidden>
              <Lock size={22} strokeWidth={2} />
            </div>
            <h2 className="fo-rewards__gate-title">Authentication Required</h2>
            <p className="fo-rewards__gate-desc">
              Balances, ledgers, and referral codes are account-owned. Guests have no points on this
              page.
            </p>
            <Link href="/login?redirect=%2Frewards" className={buttonClassName({ size: "md" })}>
              Sign In to FlightOne
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fo-rewards__boot" role="status" aria-live="polite">
        <Spinner label="Loading your rewards…" />
        <p className="fo-rewards__boot-label">Loading your ledger</p>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="fo-rewards__gate">
        <div className="fo-rewards__gate-box">
          <div className="fo-rewards__gate-icon fo-rewards__gate-icon--warn" aria-hidden>
            <AlertCircle size={22} strokeWidth={2} />
          </div>
          <h2 className="fo-rewards__gate-title">Rewards Unavailable</h2>
          <p className="fo-rewards__gate-desc">Could not load your rewards ledger.</p>
          <Button size="md" variant="secondary" onClick={() => void refetch()}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const policy = summary.policy;

  return (
    <div className="fo-rewards__master-stage">
      <div className="fo-rewards__nav-rail">
        <span className="fo-rewards__brand-badge">
          <span className="fo-rewards__brand-dot" aria-hidden />
          Rewards
        </span>
        <div className="fo-rewards__rail-actions">
          <Link href="/#search">
            <Button
              size="sm"
              variant="secondary"
              icon={<Search className="h-3.5 w-3.5" aria-hidden />}
            >
              Search
            </Button>
          </Link>
        </div>
      </div>

      <header className="fo-rewards__hero">
        <h1 className="fo-rewards__title">Rewards</h1>
        <p className="fo-rewards__lede">
          Credits earned from completed ticketed bookings. Redemption reduces the checkout amount
          on a quoted booking.
        </p>
      </header>

      <RewardsBalanceHero summary={summary} />

      {summary.balance === 0 ? (
        <RewardsEmptyBalance earnPointsPerHundredMinor={policy.earnPointsPerHundredMinor} />
      ) : null}

      <div className="fo-rewards__panel">
        <PolicyExplainer policy={policy} />
      </div>

      <RewardsReferralSection
        referralCode={summary.referralCode}
        referralLink={referralLink}
        referralBonusPoints={policy.referralBonusPoints}
        referrals={referrals?.items || []}
        referralInput={referralInput}
        onReferralInputChange={setReferralInput}
        onAttach={handleAttachReferral}
        attaching={attachState.isLoading}
        localMsg={localMsg}
      />

      <CorporateRewardsList companies={companies || []} />

      <RewardsLedgerSection
        items={ledger?.items || []}
        total={ledger?.total ?? 0}
        page={ledgerPage}
        onPageChange={setLedgerPage}
        selectedEntryId={selectedEntryId}
        onSelectEntry={setSelectedEntryId}
        entryDetail={entryDetail}
        entryLoading={entryLoading}
        entryError={entryError}
      />

      <p className="fo-rewards__foot">
        Earn rate: {policy.earnPointsPerHundredMinor} pt per 100 minor units. Credited on ticketed /
        active / completed bookings only. Redeemable at checkout on quoted bookings.
      </p>
    </div>
  );
}
