/**
 * Module 10 — Rewards API.
 */
import { baseApi } from "@/lib/api/baseApi";

export type RewardTierThreshold = {
  tier: string;
  minInclusive: number;
  nextTier: string | null;
  nextAt: number | null;
};

export type RewardEarningEvent = {
  id: string;
  status: string;
  description: string;
  eligibleBookingStatuses?: string[];
  rate?: { pointsPerHundredMinor: number };
  points?: number;
};

export type RewardRedemptionOption = {
  id: string;
  status: string;
  description: string;
  appliesToBookingStatus?: string;
  pointValueMinor?: number;
};

export type RewardsPolicy = {
  earnPointsPerHundredMinor: number;
  referralBonusPoints: number;
  pointValueMinor: number;
  creditExpiryDays: number;
  tierThresholds?: RewardTierThreshold[];
  tierNotes?: string;
  earningEvents?: RewardEarningEvent[];
  redemptionOptions?: RewardRedemptionOption[];
};

export type RewardsSummary = {
  balance: number;
  tier: string;
  referralCode: string;
  lifetimeEarned: number;
  progress: {
    tier: string;
    nextTier: string | null;
    pointsToNext: number;
    progressRatio: number;
    nextAt?: number | null;
  };
  policy: RewardsPolicy;
};

export type RewardLedgerEntry = {
  id: string;
  accountId?: string;
  type: string;
  points: number;
  bookingId: string | null;
  note: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
  createdAt: string;
};

export const rewardsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRewardsPolicy: build.query<RewardsPolicy, void>({
      query: () => "/rewards/policy",
      providesTags: ["Rewards"],
    }),
    getRewardsSummary: build.query<RewardsSummary, void>({
      query: () => "/rewards",
      providesTags: ["Rewards"],
    }),
    getRewardsLedger: build.query<
      { items: RewardLedgerEntry[]; total: number },
      { page?: number; pageSize?: number } | void
    >({
      query: (params) => ({ url: "/rewards/ledger", params: params || undefined }),
      providesTags: ["Rewards"],
    }),
    getRewardLedgerEntry: build.query<RewardLedgerEntry, string>({
      query: (entryId) => `/rewards/ledger/${entryId}`,
      providesTags: (_r, _e, id) => [{ type: "Rewards", id }],
    }),
    getRewardsReferrals: build.query<
      { items: Array<{ id: string; status: string; rewardedAt: string | null }> },
      void
    >({
      query: () => "/rewards/referrals",
      providesTags: ["Rewards"],
    }),
    applyCheckoutCredit: build.mutation<
      { chargeableAmountMinor: number; creditMinor: number; points: number },
      { bookingId: string; points: number; idempotencyKey?: string }
    >({
      query: (body) => ({ url: "/rewards/checkout-credit", method: "POST", body }),
      invalidatesTags: ["Rewards"],
    }),
    attachReferral: build.mutation<unknown, { code: string }>({
      query: (body) => ({ url: "/rewards/referrals/attach", method: "POST", body }),
      invalidatesTags: ["Rewards"],
    }),
    getCorporateRewardProgram: build.query<
      {
        configured: boolean;
        companyId: string;
        balance: number;
        program: {
          isActive: boolean;
          companyEarnPointsPerHundredMinor: number;
          personalEarnEnabled: boolean;
        } | null;
      },
      string
    >({
      query: (companyId) => `/rewards/corporate/${companyId}`,
      providesTags: ["Rewards"],
    }),
    upsertCorporateRewardProgram: build.mutation<
      unknown,
      {
        companyId: string;
        companyEarnPointsPerHundredMinor?: number;
        personalEarnEnabled?: boolean;
        isActive?: boolean;
      }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/rewards/corporate/${companyId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Rewards"],
    }),
  }),
});

export const {
  useGetRewardsPolicyQuery,
  useGetRewardsSummaryQuery,
  useGetRewardsLedgerQuery,
  useGetRewardLedgerEntryQuery,
  useGetRewardsReferralsQuery,
  useApplyCheckoutCreditMutation,
  useAttachReferralMutation,
  useGetCorporateRewardProgramQuery,
  useUpsertCorporateRewardProgramMutation,
} = rewardsApi;
