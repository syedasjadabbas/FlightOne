import { baseApi } from "@/lib/api/baseApi";

export type ConciergeTrigger = "DELAY" | "CANCELLED" | "DISRUPTION" | "REBOOK_OPPORTUNITY";
export type ConciergeAction = "NOTIFY" | "PREPARE_REBOOK" | "AUTONOMOUS_REBOOK";
export type ConciergeExecutionStatus =
  | "EVALUATED"
  | "SKIPPED"
  | "BLOCKED"
  | "PENDING_CONFIRMATION"
  | "EXECUTED"
  | "FAILED"
  | "ESCALATED";

export type ConciergeRule = {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  trigger: ConciergeTrigger;
  thresholdMinutes: number | null;
  action: ConciergeAction;
  maxAdditionalMinor: number;
  currency: string;
  notifyOnTrigger: boolean;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConciergeExecution = {
  id: string;
  ruleId: string;
  userId: string;
  bookingId: string;
  watchId: string | null;
  status: ConciergeExecutionStatus;
  reason: string | null;
  extraMinor: number | null;
  quoteBookingId: string | null;
  createdAt: string;
};

export type CreateConciergeRuleBody = {
  name: string;
  trigger: ConciergeTrigger;
  thresholdMinutes?: number | null;
  action: ConciergeAction;
  maxAdditionalMinor: number;
  currency?: string;
  notifyOnTrigger?: boolean;
  enabled?: boolean;
};

export const conciergeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listConciergeRules: builder.query<{ items: ConciergeRule[] }, void>({
      query: () => "/concierge/rules",
      providesTags: ["Concierge"],
    }),
    getConciergeRule: builder.query<ConciergeRule, string>({
      query: (ruleId) => `/concierge/rules/${ruleId}`,
      providesTags: (_r, _e, id) => [{ type: "Concierge", id }],
    }),
    createConciergeRule: builder.mutation<ConciergeRule, CreateConciergeRuleBody>({
      query: (body) => ({ url: "/concierge/rules", method: "POST", body }),
      invalidatesTags: ["Concierge"],
    }),
    updateConciergeRule: builder.mutation<ConciergeRule, { ruleId: string; body: Partial<CreateConciergeRuleBody> }>({
      query: ({ ruleId, body }) => ({
        url: `/concierge/rules/${ruleId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Concierge"],
    }),
    disableConciergeRule: builder.mutation<ConciergeRule, string>({
      query: (ruleId) => ({
        url: `/concierge/rules/${ruleId}/disable`,
        method: "POST",
      }),
      invalidatesTags: ["Concierge"],
    }),
    conciergeKillSwitch: builder.mutation<{ disabledCount: number }, void>({
      query: () => ({ url: "/concierge/kill-switch", method: "POST" }),
      invalidatesTags: ["Concierge"],
    }),
    listConciergeActivity: builder.query<{ items: ConciergeExecution[]; total: number }, void>({
      query: () => "/concierge/activity",
      providesTags: ["Concierge"],
    }),
  }),
});

export const {
  useListConciergeRulesQuery,
  useGetConciergeRuleQuery,
  useCreateConciergeRuleMutation,
  useUpdateConciergeRuleMutation,
  useDisableConciergeRuleMutation,
  useConciergeKillSwitchMutation,
  useListConciergeActivityQuery,
} = conciergeApi;
