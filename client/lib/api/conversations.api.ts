import { baseApi } from "./baseApi";

/**
 * Conversation persistence against filght-one-server
 * `/api/v1/conversations/*` (auth required, user-scoped).
 */

export type ConversationSummary = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = ConversationSummary & {
  userId: string | null;
  metadata: unknown;
  messages?: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "SYSTEM" | "AGENT";
    content: string;
    provider: string | null;
    createdAt: string;
  }>;
};

export type RecordMessageInput = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider?: string | null;
};

export const conversationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createConversation: builder.mutation<ConversationDetail, { title?: string } | void>({
      query: (body) => ({
        url: "/conversations",
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: ["Conversation"],
    }),

    listConversations: builder.query<
      { items: ConversationSummary[]; page: number; pageSize: number; total: number },
      { page?: number; pageSize?: number } | void
    >({
      query: (params) => ({
        url: "/conversations",
        params: params ? params : undefined,
      }),
      providesTags: ["Conversation"],
    }),

    getConversation: builder.query<ConversationDetail, string>({
      query: (id) => `/conversations/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Conversation", id }],
    }),

    recordConversationMessages: builder.mutation<
      { messages: unknown[] },
      { conversationId: string; messages: RecordMessageInput[]; travelPlan?: unknown }
    >({
      query: ({ conversationId, messages, travelPlan }) => ({
        url: `/conversations/${conversationId}/messages/record`,
        method: "POST",
        body: {
          messages,
          ...(travelPlan !== undefined ? { travelPlan } : {}),
        },
      }),
      invalidatesTags: (_r, _e, arg) => [
        "Conversation",
        { type: "Conversation", id: arg.conversationId },
      ],
    }),

    deleteConversation: builder.mutation<{ id: string; deleted: boolean }, string>({
      query: (id) => ({
        url: `/conversations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversation"],
    }),
  }),
});

export const {
  useCreateConversationMutation,
  useListConversationsQuery,
  useGetConversationQuery,
  useRecordConversationMessagesMutation,
  useDeleteConversationMutation,
} = conversationsApi;
