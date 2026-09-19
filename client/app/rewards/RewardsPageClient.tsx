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
  useGetRewardLedgerEntryQuery,
  useGetRewardsLedgerQuery,
  useGetRewardsPolicyQuery,
  useGetRewardsReferralsQuery,
  useGetRewardsSummaryQuery,
  type RewardsPolicy,
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

function PolicyExplainer({ policy }: { policy: RewardsPolicy | undefined }) {
  if (!policy) return null;
  return (
    <>
      <TravellerSection title="How points are earned">
        <ul className="fo-traveller__list">
          {(policy.earningEvents || []).map((event) => (
            <li key={event.id} className="fo-traveller__row">
              <p className="fo-traveller__row-title">{event.id.replace(/_/g, " ")}</p>
              <p className="fo-traveller__row-body">{event.description}</p>
              <p className="fo-traveller__row-meta">
                Status: {event.status}
                {event.rate
                  ? ` · ${event.rate.pointsPerHundredMinor} pt per 100 minor units`
                  : ""}
                {typeof event.points === "number" ? ` · ${event.points} pts` : ""}
                {event.eligibleBookingStatuses?.length
                  ? ` · eligible: ${event.eligibleBookingStatuses.join(", ")}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </TravellerSection>

      <TravellerSection
        title="Redemption"
        note="Points are not cashed out. Checkout is the live redemption path."
      >
        <ul className="fo-traveller__list">
          {(policy.redemptionOptions || []).map((opt) => (
            <li key={opt.id} className="fo-traveller__row">
              <p className="fo-traveller__row-title">{opt.id.replace(/_/g, " ")}</p>
              <p className="fo-traveller__row-body">{opt.description}</p>
              <p className="fo-traveller__row-meta">
                Status: {opt.status}
                {opt.appliesToBookingStatus ? ` · booking must be ${opt.appliesToBookingStatus}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <p className="fo-traveller__section-note mt-2">
          Apply credits from a quoted booking at checkout. This page does not change your balance.
        </p>
      </TravellerSection>

      <TravellerSection title="Membership tiers" note={policy.tierNotes}>
        <ul className="fo-traveller__list">
          {(policy.tierThresholds || []).map((row) => (
            <li key={row.tier} className="fo-traveller__row">
              <p className="fo-traveller__row-title">{row.tier}</p>
              <p className="fo-traveller__row-meta">
                From {row.minInclusive} lifetime pts earned
                {row.nextAt ? ` · next ${row.nextTier} at ${row.nextAt}` : " · highest configured tier"}
              </p>
            </li>
          ))}
        </ul>
      </TravellerSection>
    </>
  );
}

export function RewardsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [referralInput, setReferralInput] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
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
      <>
        <TravellerPageHeader
          title="Rewards & Loyalty"
          lede="Ledger-based points from ticketed bookings. Sign in to see your own balance — this page never invents points."
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
              <p className="text-sm font-semibold text-slate-900">1. Earn on ticketed trips</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {publicPolicy.earnPointsPerHundredMinor} point
                {publicPolicy.earnPointsPerHundredMinor === 1 ? "" : "s"} per 100 minor units on
                ticketed, active, or completed bookings. Quotes and unpaid searches do not earn.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs">
              <p className="text-sm font-semibold text-slate-900">2. Apply at checkout</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Redeem on a quoted booking to reduce the amount you pay. There is no cash payout.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs">
              <p className="text-sm font-semibold text-slate-900">3. Referrals</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Share your referral code after you sign in. Bonus of {publicPolicy.referralBonusPoints}{" "}
                points is credited when the referred traveller earns on their first ticketed booking.
              </p>
            </div>
          </div>
        </TravellerSection>

        <PolicyExplainer policy={publicPolicy} />

        <TravellerSection
          title="Your balance"
          note="Balances, ledgers, and referral codes are account-owned. Guests have no points on this page."
          panel
        >
          <p className="text-sm text-slate-600">
            Sign in to see your ledger-computed balance. Nothing here is a placeholder amount.
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
  const policy = summary.policy;

  return (
    <>
      <TravellerPageHeader
        title="Rewards & Loyalty"
        lede="Ledger-based credits earned from completed ticketed bookings. Redemption reduces the checkout amount on a quoted booking."
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

      <TravellerSection title="Active points balance">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="fo-traveller__balance">
            {summary.balance}
            <span>pts</span>
          </p>
          <span className="text-xs text-slate-500">
            ≈ {summary.balance * (policy?.pointValueMinor ?? 1)} minor currency units redeemable at checkout
          </span>
        </div>
        <p className="fo-traveller__section-note">
          Credit expiry: {policy?.creditExpiryDays ?? "—"} days from issuance (ledger-enforced). Status:{" "}
          {summary.tier}.
        </p>
      </TravellerSection>

      <TravellerSection title="Loyalty tier progress">
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold text-ink">{summary.tier}</p>
          <span className="text-xs font-medium text-slate-500">
            {summary.lifetimeEarned} lifetime pts earned
          </span>
        </div>
        <p className="fo-traveller__section-note">
          {summary.progress?.nextTier
            ? `${summary.progress.pointsToNext} points needed to reach ${summary.progress.nextTier}`
            : "Highest configured tier"}
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
            <span className="text-lg">★</span>
            <div className="space-y-1.5">
              <p className="font-semibold text-sky-950">No points on your ledger yet</p>
              <p className="leading-relaxed text-sky-800">
                You earn {policy.earnPointsPerHundredMinor} point
                {policy.earnPointsPerHundredMinor === 1 ? "" : "s"} per 100 minor units after a booking is
                ticketed, active, or completed. Quoted or unpaid bookings do not credit points.
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

      <PolicyExplainer policy={policy} />

      <TravellerSection
        title="Referral program"
        note={`Share your referral code. Bonus (${policy.referralBonusPoints} pts) is credited when your invitee completes their first ticketed earn.`}
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
              {copiedLink ? "Link copied" : "Copy invite link"}
            </button>
          ) : null}
        </div>

        {(referrals?.items || []).length === 0 ? (
          <TravellerState title="No referrals yet">
            Share your invite code. The {policy.referralBonusPoints}-point bonus posts only after their first
            ticketed earn.
          </TravellerState>
        ) : (
          <ul className="fo-traveller__list mt-3">
            {referrals?.items.map((r) => (
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
            {attachState.isLoading ? "Attaching…" : "Apply referral code"}
          </Button>
          {localMsg ? <p className="text-[12px] text-ink-soft">{localMsg}</p> : null}
        </form>
      </TravellerSection>

      {(companies || []).length > 0 ? (
        <TravellerSection
          title="Corporate loyalty programs"
          note="Company-level reward balances are segregated from your personal rewards ledger."
        >
          <ul className="fo-traveller__list">
            {companies!.map((c) => (
              <CorporateRewardsBlock key={c.id} companyId={c.id} companyName={c.name} />
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      <TravellerSection title="Rewards ledger history">
        {(ledger?.items || []).length === 0 ? (
          <TravellerState title="No transactions on record">
            Points from ticketed bookings and referral bonuses will appear here after the ledger posts them.
          </TravellerState>
        ) : (
          <>
            <ul className="fo-traveller__list">
              {ledger?.items.map((row) => (
                <li key={row.id} className="fo-traveller__row">
                  <button
                    type="button"
                    className="fo-traveller__row-top w-full text-left"
                    onClick={() =>
                      setSelectedEntryId((current) => (current === row.id ? null : row.id))
                    }
                  >
                    <div>
                      <p className="fo-traveller__row-title">{row.type.replace(/_/g, " ")}</p>
                      <p className="fo-traveller__row-body">{row.note || "—"}</p>
                      <p className="fo-traveller__row-meta">
                        {new Date(row.createdAt).toLocaleString()}
                        {selectedEntryId === row.id ? " · details open" : " · view details"}
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
                  </button>
                  {selectedEntryId === row.id ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700">
                      {entryLoading ? (
                        <p>Loading ledger details…</p>
                      ) : entryError || !entryDetail ? (
                        <p>Could not load this ledger entry.</p>
                      ) : (
                        <dl className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500">Entry</dt>
                            <dd className="font-mono">{entryDetail.id}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Type</dt>
                            <dd>{entryDetail.type}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Booking</dt>
                            <dd>{entryDetail.bookingId || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Expires</dt>
                            <dd>
                              {entryDetail.expiresAt
                                ? new Date(entryDetail.expiresAt).toLocaleDateString()
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  ) : null}
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
        Earn rate: {policy.earnPointsPerHundredMinor} pt per 100 minor units. Credited on ticketed /
        active / completed bookings only. Redeemable at checkout on quoted bookings.
      </p>
    </>
  );
}
