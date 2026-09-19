import { baseApi } from "./baseApi";
import { useAuthStore } from "@/store/auth.store";
import type { AuthSession, AuthUser } from "@/store/auth.store";

/**
 * Auth endpoints (Module 00). Paths match `filght-one-server`'s
 * `modules/auth/auth.routes.js`.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface RegisterResponse {
  accepted: boolean;
  requiresVerification: boolean;
  email: string;
  userId?: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  accepted: boolean;
  message: string;
}

export interface RefreshRequest {
  refreshToken?: string;
}

export type PasswordResetEmailDelivery = "QUEUED" | "UNCONFIGURED";

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  accepted: boolean;
  emailDelivery: PasswordResetEmailDelivery;
  message: string;
}

export interface ResetPasswordRequest {
  email?: string;
  token: string;
  password: string;
}

export interface ResetPasswordResponse {
  ok: boolean;
  message: string;
  sessionsRevoked: boolean;
}

export interface AuthDeviceSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  deviceLabel: string;
  ip: string | null;
  current: boolean;
}

export interface ListSessionsResponse {
  sessions: AuthDeviceSession[];
}

export interface RevokeSessionResponse {
  ok: boolean;
  revokedSessionId: string;
}

export interface RevokeOtherSessionsResponse {
  ok: boolean;
  preservedSessionId: string;
  revokedCount: number;
}

export interface TwoFactorSetupRequest {
  tempToken?: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl?: string;
  otpauthUri?: string;
  backupCodes: string[];
  message: string;
}

export interface TwoFactorConfirmRequest {
  code: string;
  tempToken?: string;
}

export interface TwoFactorConfirmResponse {
  ok?: boolean;
  message?: string;
  accessToken?: string;
  sessionId?: string | null;
  user?: AuthUser;
}

export interface TwoFactorVerifyRequest {
  code: string;
  tempToken?: string;
  type?: "totp" | "backup_code";
}

export interface TwoFactorVerifyResponse extends AuthSession {
  mfa?: boolean;
}

export interface TwoFactorDisableRequest {
  password?: string;
  code?: string;
}

export interface TwoFactorDisableResponse {
  ok: boolean;
  message: string;
}

export interface LoginSuccessResponse extends AuthSession {
  requires2fa?: false;
}

export interface Login2faChallengeResponse {
  requires2fa: true;
  requires2faSetup?: false;
  tempToken: string;
  methods: string[];
  message: string;
}

export interface Login2faSetupResponse {
  requires2fa: true;
  requires2faSetup: true;
  tempToken: string;
  message: string;
}

export type LoginResponse =
  | LoginSuccessResponse
  | Login2faChallengeResponse
  | Login2faSetupResponse;

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      invalidatesTags: ["Me", "AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: undefined }));
        if (data && !("requires2fa" in data && data.requires2fa)) {
          useAuthStore.getState().setSession(data as AuthSession);
        }
      },
    }),

    twoFactorSetup: builder.mutation<TwoFactorSetupResponse, TwoFactorSetupRequest | void>({
      query: (body) => ({
        url: "/auth/2fa/setup",
        method: "POST",
        body: body ?? {},
      }),
    }),

    twoFactorConfirm: builder.mutation<TwoFactorConfirmResponse, TwoFactorConfirmRequest>({
      query: (body) => ({
        url: "/auth/2fa/confirm",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Me", "AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: undefined }));
        if (data?.accessToken && data.user) {
          useAuthStore.getState().setSession(data as AuthSession);
        } else if (data?.ok) {
          useAuthStore.getState().updateUser({ twoFactorEnabled: true });
        }
      },
    }),

    twoFactorVerify: builder.mutation<TwoFactorVerifyResponse, TwoFactorVerifyRequest>({
      query: (body) => ({
        url: "/auth/2fa/verify",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Me", "AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: undefined }));
        if (data?.accessToken && data.user) {
          useAuthStore.getState().setSession(data as AuthSession);
        }
      },
    }),

    twoFactorDisable: builder.mutation<TwoFactorDisableResponse, TwoFactorDisableRequest>({
      query: (body) => ({
        url: "/auth/2fa/disable",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Me", "AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: undefined }));
        if (data?.ok) {
          useAuthStore.getState().updateUser({ twoFactorEnabled: false });
        }
      },
    }),

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),

    verifyEmail: builder.mutation<AuthSession, VerifyEmailRequest>({
      query: (body) => ({ url: "/auth/verify-email", method: "POST", body }),
      invalidatesTags: ["Me", "AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: undefined }));
        if (data) useAuthStore.getState().setSession(data);
      },
    }),

    resendVerification: builder.mutation<ResendVerificationResponse, ResendVerificationRequest>({
      query: (body) => ({ url: "/auth/resend-verification", method: "POST", body }),
    }),

    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
    }),

    resetPassword: builder.mutation<ResetPasswordResponse, ResetPasswordRequest>({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          useAuthStore.getState().clearSession();
        } catch {
          // Keep local session on failure; server did not revoke.
        }
      },
    }),

    refresh: builder.mutation<AuthSession, RefreshRequest | void>({
      query: (body) => ({
        url: "/auth/refresh",
        method: "POST",
        // Prefer HttpOnly cookie; optional body only for legacy/test clients.
        body: body?.refreshToken ? { refreshToken: body.refreshToken } : {},
      }),
      invalidatesTags: ["AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: undefined }));
        if (data) {
          useAuthStore.getState().setSession(data);
        } else {
          useAuthStore.getState().clearSession();
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
        body: {},
      }),
      invalidatesTags: ["Me", "AuthSessions"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        useAuthStore.getState().clearSession();
        await queryFulfilled.catch(() => {});
      },
    }),

    me: builder.query<AuthUser, void>({
      query: () => "/auth/me",
      providesTags: ["Me"],
    }),

    listSessions: builder.query<ListSessionsResponse, void>({
      query: () => {
        const sessionId = useAuthStore.getState().sessionId;
        const qs = sessionId
          ? `?currentSessionId=${encodeURIComponent(sessionId)}`
          : "";
        return `/auth/sessions${qs}`;
      },
      providesTags: ["AuthSessions"],
    }),

    revokeSession: builder.mutation<RevokeSessionResponse, string>({
      query: (sessionId) => ({
        url: `/auth/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AuthSessions"],
      async onQueryStarted(sessionId, { queryFulfilled }) {
        try {
          await queryFulfilled;
          const state = useAuthStore.getState();
          if (state.sessionId === sessionId) {
            state.clearSession();
          }
        } catch {
          // leave session intact on failure
        }
      },
    }),

    revokeOtherSessions: builder.mutation<RevokeOtherSessionsResponse, void>({
      query: () => {
        const { sessionId } = useAuthStore.getState();
        return {
          url: "/auth/sessions/revoke-others",
          method: "POST",
          body: sessionId ? { currentSessionId: sessionId } : {},
        };
      },
      invalidatesTags: ["AuthSessions"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useRefreshMutation,
  useLogoutMutation,
  useMeQuery,
  useListSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useTwoFactorSetupMutation,
  useTwoFactorConfirmMutation,
  useTwoFactorVerifyMutation,
  useTwoFactorDisableMutation,
} = authApi;
