"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LogIn, MessageCircle, Search } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
} from "@/app/components/traveller";
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

export function RewardsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [referralInput, setReferralInput] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const skip = !hasHydrated || !accessToken;
  const { data: publicPolicy, isLoading: policyLoading, isError: policyError, refetch: refetchPolicy } =
    useGetRewardsPolicyQuery(undefined, { skip: !hasHydrated || Boolean(accessToken) });
  const { data: summary, isLoading, isError, refetch } = useGetRewardsSummaryQuery(undefined, {
    skip,
  });
  const { data: ledger } = useGetRewardsLedgerQuery(
    { page: ledgerPage, pageSize: TRAVELLER_PAGE_SIZE },
    { skip },
  );
  const { data: entryDetail, isFetching: entryLoading, isError: entryError } = useGetRewardLedgerEntryQuery(
    selectedEntryId || "",
    { skip: skip || !selectedEntryId },
  );
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
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    if (policyLoading) {
      return (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      );
    }
    if (policyError || !publicPolicy) {
      return (
        <TravellerState
          variant="error"
          title="Rewards unavailable"
          action={
            <Button type="button" size="sm" onClick={() => void refetchPolicy()}>
              Retry
            </Button>
          }
        >
          Could not load the published rewards policy.
        </TravellerState>
      );
    }

    return (
      <div className="fo-rewards">
        <TravellerPageHeader
          title="Rewards"
          lede="Ledger-based points from ticketed bookings. Sign in to see your own balance — this page never invents points."
          actions={
            <div className="flex gap-2">
              <Link href="/login?redirect=%2Frewards">
                <Button size="sm" icon={<LogIn className="h-4 w-4" aria-hidden />}>
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="secondary">
                  Create account
                </Button>
              </Link>
            </div>
          }
        />

        <TravellerSection title="How FlightOne Rewards works">
          <RewardsEarnSteps policy={publicPolicy} />
        </TravellerSection>

        <PolicyExplainer policy={publicPolicy} />

        <TravellerSection
          title="Your balance"
          note="Balances, ledgers, and referral codes are account-owned. Guests have no points on this page."
          panel
        >
          <p className="fo-rewards__panel-body">
            Sign in to see your ledger-computed balance. Nothing here is a placeholder amount.
          </p>
          <div className="fo-rewards__notice-actions">
            <Link href="/login?redirect=%2Frewards">
              <Button size="sm" icon={<LogIn className="h-4 w-4" aria-hidden />}>
                Log in to view balance
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="ghost">
                Join FlightOne Rewards
              </Button>
            </Link>
          </div>
        </TravellerSection>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <TravellerState
        variant="error"
        title="Rewards unavailable"
        action={
          <Button type="button" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      >
        Could not load your rewards ledger.
      </TravellerState>
    );
  }

  const policy = summary.policy;

  return (
    <div className="fo-rewards">
      <TravellerPageHeader
        title="Rewards"
        lede="Ledger-based credits earned from completed ticketed bookings. Redemption reduces the checkout amount on a quoted booking."
        actions={
          <div className="flex gap-2">
            <Link href="/#search">
              <Button size="sm" variant="secondary" icon={<Search className="h-4 w-4" aria-hidden />}>
                Search
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="ghost" icon={<MessageCircle className="h-4 w-4" aria-hidden />}>
                Book with Ava
              </Button>
            </Link>
          </div>
        }
      />

      <RewardsBalanceHero summary={summary} />

      {summary.balance === 0 ? (
        <RewardsEmptyBalance earnPointsPerHundredMinor={policy.earnPointsPerHundredMinor} />
      ) : null}

      <PolicyExplainer policy={policy} />

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
