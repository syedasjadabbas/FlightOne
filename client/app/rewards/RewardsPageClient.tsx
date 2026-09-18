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
          No corporate programme configured yet (ADMIN can set via API).
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
        Could not load your ledger.
      </TravellerState>
    );
  }

  const progressPct = Math.round((summary.progress?.progressRatio ?? 0) * 100);

  return (
    <>
      <TravellerPageHeader
        title="Rewards"
        lede="Ledger-based credits from completed bookings. Redemption lowers what you pay — never the supplier fare."
        actions={
          <Link href="/chat">
            <Button size="sm" variant="secondary">
              Apply at checkout
            </Button>
          </Link>
        }
      />

      <TravellerSection title="Balance">
        <p className="fo-traveller__balance">
          {summary.balance}
          <span>pts</span>
        </p>
        <p className="fo-traveller__section-note">
          ≈ {summary.balance * (summary.policy?.pointValueMinor ?? 1)} minor units at current
          conversion (configurable). Credit expiry: {summary.policy?.creditExpiryDays ?? "—"} days
          (ledger-enforced).
        </p>
      </TravellerSection>

      <TravellerSection title="Loyalty tier">
        <p className="text-[18px] font-semibold text-ink">{summary.tier}</p>
        <p className="fo-traveller__section-note">
          Lifetime earned: {summary.lifetimeEarned} pts
          {summary.progress?.nextTier
            ? ` · ${summary.progress.pointsToNext} to ${summary.progress.nextTier}`
            : " · top tier"}
        </p>
        {summary.progress?.nextTier ? (
          <div className="fo-traveller__progress" aria-hidden>
            <span style={{ width: `${progressPct}%` }} />
          </div>
        ) : null}
      </TravellerSection>

      <TravellerSection
        title="Referral"
        note={`Share your code. Bonus (${summary.policy.referralBonusPoints} pts) pays when they complete their first ticketed booking — not on signup alone.`}
        panel
      >
        <p className="font-mono text-[16px] font-semibold tracking-wide text-[var(--navy)]">
          {summary.referralCode}
        </p>
        {referralLink ? (
          <button
            type="button"
            className="w-fit text-left text-[12px] text-[var(--sky)] underline-offset-2 hover:underline"
            onClick={() => void navigator.clipboard?.writeText(referralLink)}
          >
            Copy link
          </button>
        ) : null}
        {(referrals?.items || []).length === 0 ? (
          <TravellerState title="No referrals yet">
            Share your code after a friend books their first ticket.
          </TravellerState>
        ) : (
          <ul className="fo-traveller__list">
            {referrals?.items.map((r) => (
              <li key={r.id} className="fo-traveller__row">
                <p className="fo-traveller__row-title">{r.status}</p>
                <p className="fo-traveller__row-meta">
                  {r.rewardedAt ? new Date(r.rewardedAt).toLocaleDateString() : "Pending"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="space-y-2 border-t border-line pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLocalMsg(null);
            try {
              await attach({ code: referralInput.trim() }).unwrap();
              setLocalMsg("Referral attached.");
              setReferralInput("");
            } catch {
              setLocalMsg("Could not attach referral code.");
            }
          }}
        >
          <Input
            label="Have a referral code?"
            value={referralInput}
            onChange={(ev) => setReferralInput(ev.target.value.toUpperCase())}
            placeholder="AB12CD34"
          />
          <Button type="submit" size="sm" disabled={attachState.isLoading || !referralInput.trim()}>
            {attachState.isLoading ? "Saving…" : "Attach code"}
          </Button>
          {localMsg ? <p className="text-[12px] text-ink-soft">{localMsg}</p> : null}
        </form>
      </TravellerSection>

      {(companies || []).length > 0 ? (
        <TravellerSection
          title="Corporate programmes"
          note="Company reward balances are separate from your personal ledger."
        >
          <ul className="fo-traveller__list">
            {companies!.map((c) => (
              <CorporateRewardsBlock key={c.id} companyId={c.id} companyName={c.name} />
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      <TravellerSection title="History">
        {(ledger?.items || []).length === 0 ? (
          <TravellerState title="No ledger entries">
            Complete a ticketed booking to earn points.
          </TravellerState>
        ) : (
          <>
            <ul className="fo-traveller__list">
              {ledger?.items.map((row) => (
                <li key={row.id} className="fo-traveller__row">
                  <div className="fo-traveller__row-top">
                    <div>
                      <p className="fo-traveller__row-title">{row.type}</p>
                      <p className="fo-traveller__row-body">{row.note || "—"}</p>
                      <p className="fo-traveller__row-meta">
                        {new Date(row.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={
                        row.points >= 0
                          ? "font-semibold text-[var(--navy)]"
                          : "font-semibold text-ink"
                      }
                    >
                      {row.points >= 0 ? `+${row.points}` : row.points}
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

      <p className="fo-traveller__meta">
        Earn rate: {summary.policy.earnPointsPerHundredMinor} pt per 100 minor. Apply credits during
        checkout on a quoted booking.
      </p>
    </>
  );
}
