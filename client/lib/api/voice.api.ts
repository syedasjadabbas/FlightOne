import { baseApi } from "@/lib/api/baseApi";

export type VoiceSessionState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "CONFIRMATION_REQUIRED"
  | "COMPLETED"
  | "FAILED"
  | "UNAVAILABLE";

export type VoiceCapability = {
  web: { microphone: string; stt: string; tts: string; available: boolean };
  phone: { provider: string; configured: boolean; available: boolean };
  bookingConfirmation: {
    requiresExplicitConfirmation: boolean;
    requiresOtp: boolean;
    irreversibleActionsBlocked: boolean;
  };
  reasons: string[];
};

export type VoiceSession = {
  id: string;
  conversationId: string | null;
  channel: "WEB" | "PHONE";
  state: VoiceSessionState;
  locale: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  capability?: VoiceCapability;
};

export type VoiceTurnResult = {
  session: VoiceSession;
  intent: {
    kind: string;
    requiresConfirmation: boolean;
    blocked: boolean;
    irreversible: boolean;
    reason: string | null;
  };
  reply: string;
  booking: {
    confirmationRequired?: boolean;
    otpRequired?: boolean;
    booked: boolean;
    ticketed: boolean;
  };
};

export const voiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVoiceCapability: builder.query<VoiceCapability, void>({
      query: () => "/voice/capability",
      providesTags: ["Voice"],
    }),
    createVoiceSession: builder.mutation<VoiceSession, { conversationId?: string; locale?: string } | void>({
      query: (body) => ({
        url: "/voice/sessions",
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: ["Voice"],
    }),
    voiceTurn: builder.mutation<
      VoiceTurnResult,
      { sessionId: string; transcript: string; persistConversation?: boolean }
    >({
      query: ({ sessionId, transcript, persistConversation }) => ({
        url: `/voice/sessions/${sessionId}/turn`,
        method: "POST",
        body: { transcript, persistConversation },
      }),
    }),
    prepareVoiceBooking: builder.mutation<
      { intent: { id: string; status: string; otpRequired: boolean; booked: boolean }; message: string },
      { sessionId: string; supplierOfferSnapshotId: string }
    >({
      query: ({ sessionId, supplierOfferSnapshotId }) => ({
        url: `/voice/sessions/${sessionId}/booking/prepare`,
        method: "POST",
        body: { supplierOfferSnapshotId },
      }),
    }),
    requestVoiceOtp: builder.mutation<
      { challengeId: string; expiresAt: string; otpRequired: boolean; booked: boolean; message: string },
      { sessionId: string; intentId: string }
    >({
      query: ({ sessionId, intentId }) => ({
        url: `/voice/sessions/${sessionId}/otp/request`,
        method: "POST",
        body: { intentId },
      }),
    }),
    confirmVoiceOtp: builder.mutation<
      { confirmed: boolean; booked: boolean; ticketed: boolean; bookingId?: string; status?: string; message?: string },
      { sessionId: string; intentId: string; code: string }
    >({
      query: ({ sessionId, intentId, code }) => ({
        url: `/voice/sessions/${sessionId}/otp/confirm`,
        method: "POST",
        body: { intentId, code },
      }),
    }),
    patchVoiceState: builder.mutation<VoiceSession, { sessionId: string; state: VoiceSessionState }>({
      query: ({ sessionId, state }) => ({
        url: `/voice/sessions/${sessionId}/state`,
        method: "PATCH",
        body: { state },
      }),
    }),
  }),
});

export const {
  useGetVoiceCapabilityQuery,
  useCreateVoiceSessionMutation,
  useVoiceTurnMutation,
  usePrepareVoiceBookingMutation,
  useRequestVoiceOtpMutation,
  useConfirmVoiceOtpMutation,
  usePatchVoiceStateMutation,
} = voiceApi;
