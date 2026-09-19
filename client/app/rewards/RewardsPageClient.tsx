"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import {
  TravellerPageHeader,
  TravellerPagination,
  TravellerSection,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
} from "@/app/components/traveller";
import {
  useAttachReferralMutation,
  useGetCorporateRewardProgramQuery,
  useGetRewardsLedgerQuery,
  useGetRewardsReferralsQuery,
  useGetRewardsSummaryQuery,
} from "@/lib/api/rewards.api";
import { useListCompaniesQuery } from "@/lib/api/corporate.api";
import { useAuthStore } from "@/store/auth.store";

function CorporateRewardsBlock({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { data, isError } = useGetCorporateRewardProgramQuery(companyId);
  if (isError) return null;
  return (
    <li className="fo-traveller__row">
      <p className="fo-traveller__row-title">{companyName}</p>
      {!data?.configured ? (
        <p className="fo-traveller__row-meta">
          No corporate programme configured yet (ADMIN can set via Corporate Desk).
        </p>
      ) : (
        <p className="fo-traveller__row-body">
          Company balance: {data.balance} pts
          {data.program?.personalEarnEnabled === false ? " · personal earn disabled" : ""}
          {data.program?.isActive === false ? " · inactive" : ""}
        </p>
      )}
    </li>
  );
}

export function RewardsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [referralInput, setReferralInput] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);

  const skip = !hasHydrated || !accessToken;
  const { data: summary, isLoading, isError, refetch } = useGetRewardsSummaryQuery(undefined, {
    skip,
  });
  const { data: ledger } = useGetRewardsLedgerQuery(
    { page: ledgerPage, pageSize: TRAVELLER_PAGE_SIZE },
    { skip },
  );
  const { data: referrals } = useGetRewardsReferralsQuery(undefined, { skip });
  const { data: companies } = useListCompaniesQuery(undefined, { skip });
  const [attach, attachState] = useAttachReferralMutation();

  const referralLink = useMemo(() => {
    if (!summary?.referralCode || typeof window === "undefined") return null;
    const origin = window.location.origin;
    return `${origin}/signup?ref=${summary.referralCode}`;
  }, [summary?.referralCode]);

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <>
        <TravellerPageHeader
          title="Rewards & Loyalty"
          lede="Earn FlightOne points across flights, stays, cars, and custom tours. Points are credited upon booking completion and reduce payable amounts at checkout."
          actions={
            <div className="flex gap-2">
              <Link href="/login?redirect=%2Frewards">
                <Button size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="secondary">Create account</Button>
              </Link>
            </div>
          }
        />

        <TravellerSection title="How FlightOne Rewards works">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs">
              <p className="text-sm font-semibold text-slate-900">1. Earn on Every Trip</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Earn 1 point per 100 minor units spent on all confirmed flights, hotels, and custom travel packages.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs">
              <p className="text-sm font-semibold text-slate-900">2. Apply at Checkout</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Redeem your points directly during checkout to lower what you pay — no blackout dates or hidden fees.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs">
              <p className="text-sm font-semibold text-slate-900">3. Invite & Multiply</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Share your personal referral code. Earn 250 bonus points when friends complete their first ticketed trip.
              </p>
            </div>
          </div>
        </TravellerSection>

        <TravellerSection title="Membership Tiers">
          <ul className="fo-traveller__list">
            <li className="fo-traveller__row">
              <p className="fo-traveller__row-title">Bronze Member</p>
              <p className="fo-traveller__row-meta">Baseline tier · Standard 1x point accrual · Real-time price tracking</p>
            </li>
            <li className="fo-traveller__row">
              <p className="fo-traveller__row-title">Silver Explorer · 10,000 pts</p>
              <p className="fo-traveller__row-meta">1.25x point multiplier · Priority Ava assistant response time · Dedicated consultant review</p>
            </li>
            <li className="fo-traveller__row">
              <p className="fo-traveller__row-title">Gold Voyager · 25,000 pts</p>
              <p className="fo-traveller__row-meta">1.5x point multiplier · Waived administrative rebooking fees · Expedited visa reviews</p>
            </li>
            <li className="fo-traveller__row">
              <p className="fo-traveller__row-title">Platinum Sovereign · 50,000 pts</p>
              <p className="fo-traveller__row-meta">2x point multiplier · VIP lounge access vouchers · 24/7 dedicated executive travel manager</p>
            </li>
          </ul>
        </TravellerSection>

        <TravellerSection
          title="Account Balance & Referrals"
          note="Rewards balances, point ledgers, and referral codes are linked to your verified FlightOne account."
          panel
        >
          <p className="text-sm text-slate-600">
            Sign in to check your active points balance, track your tier progress, or share your referral link.
          </p>
          <div className="mt-3 flex gap-3">
            <Link href="/login?redirect=%2Frewards">
              <Button size="sm">Log in to view balance</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="ghost">Join FlightOne Rewards</Button>
            </Link>
          </div>
        </TravellerSection>
      </>
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

  const progressPct = Math.round((summary.progress?.progressRatio ?? 0) * 100);

  return (
    <>
      <TravellerPageHeader
        title="Rewards & Loyalty"
        lede="Ledger-based credits earned from completed ticketed bookings. Redemption directly reduces the checkout amount on your next journey."
        actions={
          <div className="flex gap-2">
            <Link href="/#search">
              <Button size="sm" variant="secondary">
                Search Flights & Stays
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="ghost">
                Book with Ava
              </Button>
            </Link>
          </div>
        }
      />

      <TravellerSection title="Active Points Balance">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="fo-traveller__balance">
            {summary.balance}
            <span>pts</span>
          </p>
          <span className="text-xs text-slate-500">
            ≈ {summary.balance * (summary.policy?.pointValueMinor ?? 1)} minor currency units redeemable at checkout
          </span>
        </div>
        <p className="fo-traveller__section-note">
          Credit expiry: {summary.policy?.creditExpiryDays ?? "365"} days from issuance (ledger-enforced).
        </p>
      </TravellerSection>

      <TravellerSection title="Loyalty Tier Progress">
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold text-ink">{summary.tier}</p>
          <span className="text-xs font-medium text-slate-500">
            {summary.lifetimeEarned} lifetime pts earned
          </span>
        </div>
        <p className="fo-traveller__section-note">
          {summary.progress?.nextTier
            ? `${summary.progress.pointsToNext} points needed to reach ${summary.progress.nextTier}`
            : "Top tier status unlocked"}
        </p>
        {summary.progress?.nextTier ? (
          <div className="fo-traveller__progress mt-2" aria-hidden>
            <span style={{ width: `${progressPct}%` }} />
          </div>
        ) : null}
      </TravellerSection>

      {summary.balance === 0 ? (
        <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 text-xs text-sky-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <span className="text-lg">⭐</span>
            <div className="space-y-1.5">
              <p className="font-semibold text-sky-950">Earn Your First FlightOne Points</p>
              <p className="leading-relaxed text-sky-800">
                You earn 1 point for every 100 minor units spent across all confirmed flight, hotel, and bespoke tour bookings. Points are automatically credited upon completion of your journey and can be redeemed directly at checkout.
              </p>
              <div className="flex gap-2 pt-1">
                <Link href="/#search">
                  <Button size="sm">Search Flights</Button>
                </Link>
                <Link href="/journey">
                  <Button size="sm" variant="secondary">View My Journey</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <TravellerSection
        title="Referral Program"
        note={`Share your referral code. Bonus (${summary.policy.referralBonusPoints} pts) is credited to your ledger when your invitee completes their first ticketed booking.`}
        panel
      >
        <div className="flex items-center gap-3">
          <p className="font-mono text-[16px] font-semibold tracking-wide text-[var(--navy)] bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
            {summary.referralCode}
          </p>
          {referralLink ? (
            <button
              type="button"
              className="text-xs font-medium text-sky-600 hover:text-sky-700 underline underline-offset-2"
              onClick={() => {
                void navigator.clipboard?.writeText(referralLink);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2500);
              }}
            >
              {copiedLink ? "✓ Link Copied!" : "Copy Invite Link"}
            </button>
          ) : null}
        </div>

        {(referrals?.items || []).length === 0 ? (
          <TravellerState title="No referrals yet">
            Share your unique invite code with colleagues and friends to earn 250 points on their first completed trip.
          </TravellerState>
        ) : (
          <ul className="fo-traveller__list mt-3">
            {referrals?.items.map((r) => (
              <li key={r.id} className="fo-traveller__row">
                <p className="fo-traveller__row-title">Referral · {r.status}</p>
                <p className="fo-traveller__row-meta">
                  {r.rewardedAt ? `Credited on ${new Date(r.rewardedAt).toLocaleDateString()}` : "Pending first booking completion"}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form
          className="space-y-2 border-t border-slate-200/80 pt-3 mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLocalMsg(null);
            try {
              await attach({ code: referralInput.trim() }).unwrap();
              setLocalMsg("Referral code attached successfully.");
              setReferralInput("");
            } catch {
              setLocalMsg("Could not attach referral code (may be invalid or already attached).");
            }
          }}
        >
          <Input
            label="Have an invite code from a friend?"
            value={referralInput}
            onChange={(ev) => setReferralInput(ev.target.value.toUpperCase())}
            placeholder="e.g. AB12CD34"
          />
          <Button type="submit" size="sm" disabled={attachState.isLoading || !referralInput.trim()}>
            {attachState.isLoading ? "Attaching…" : "Apply Referral Code"}
          </Button>
          {localMsg ? <p className="text-[12px] text-ink-soft">{localMsg}</p> : null}
        </form>
      </TravellerSection>

      {(companies || []).length > 0 ? (
        <TravellerSection
          title="Corporate Loyalty Programs"
          note="Company-level reward balances are segregated from your personal rewards ledger."
        >
          <ul className="fo-traveller__list">
            {companies!.map((c) => (
              <CorporateRewardsBlock key={c.id} companyId={c.id} companyName={c.name} />
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      <TravellerSection title="Rewards Ledger History">
        {(ledger?.items || []).length === 0 ? (
          <TravellerState title="No transactions on record">
            Points earned from completed bookings and referral rewards will appear here.
          </TravellerState>
        ) : (
          <>
            <ul className="fo-traveller__list">
              {ledger?.items.map((row) => (
                <li key={row.id} className="fo-traveller__row">
                  <div className="fo-traveller__row-top">
                    <div>
                      <p className="fo-traveller__row-title">{row.type.replace(/_/g, " ")}</p>
                      <p className="fo-traveller__row-body">{row.note || "—"}</p>
                      <p className="fo-traveller__row-meta">
                        {new Date(row.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={
                        row.points >= 0
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-slate-700"
                      }
                    >
                      {row.points >= 0 ? `+${row.points}` : row.points} pts
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <TravellerPagination
              page={ledgerPage}
              pageSize={TRAVELLER_PAGE_SIZE}
              total={ledger?.total ?? 0}
              onPageChange={setLedgerPage}
              label="Rewards ledger pages"
            />
          </>
        )}
      </TravellerSection>

      <p className="fo-traveller__meta text-xs text-slate-500">
        Earn rate: {summary.policy.earnPointsPerHundredMinor} pt per 100 minor units. Points are credited upon ticket completion and redeemable at checkout. Airline alliance frequent flyer miles pooling is scheduled for Phase 2.
      </p>
    </>
  );
}
