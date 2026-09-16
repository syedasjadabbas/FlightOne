import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { useAuthStore } from "@/store/auth.store";
import type { AuthSession } from "@/store/auth.store";

/**
 * Single shared RTK Query instance (dev guide §1.2/§4). Per-page/global
 * domain slices call `baseApi.injectEndpoints` — never create another
 * `createApi` instance, or the cache/tag system splits.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8084/api/v1";

/** The server's fixed response envelope: `{ success, message, data }`. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** CSRF header required for cookie-authenticated auth POSTs (cross-origin safe). */
export const CSRF_HEADER = "X-FlightOne-CSRF";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include",
  prepareHeaders: (headers) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set(CSRF_HEADER, "1");
    return headers;
  },
});

/** Single-flight guard so N concurrent 401s trigger exactly one refresh call. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSessionOnce(): Promise<boolean> {
  const { setSession, clearSession } = useAuthStore.getState();

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [CSRF_HEADER]: "1",
      },
      body: JSON.stringify({}),
    });
    const envelope = (await res.json()) as ApiEnvelope<AuthSession>;

    if (!res.ok || !envelope.success) {
      clearSession();
      return false;
    }

    setSession(envelope.data);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

/**
 * Wraps `fetchBaseQuery` to:
 *  1. unwrap the `{ success, message, data }` envelope so every endpoint's
 *     `query`/`transformResponse` just deals in plain response shapes,
 *  2. on a 401, attempt exactly one `/auth/refresh` + retry (dev guide §3);
 *     if that fails, clear the session so the next protected navigation
 *     bounces to `/login` via `proxy.ts`.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    refreshInFlight ??= refreshSessionOnce().finally(() => {
      refreshInFlight = null;
    });
    const refreshed = await refreshInFlight;

    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      useAuthStore.getState().clearSession();
    }
  }

  if (!result.error && result.data && typeof result.data === "object" && "data" in result.data) {
    return { ...result, data: (result.data as ApiEnvelope<unknown>).data };
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Me",
    "AuthSessions",
    "Conversation",
    "Fare",
    "Profile",
    "ProfileCompanions",
    "ProfileLoyalty",
    "ProfileEmergency",
    "ProfileDocuments",
    "Corporate",
    "Vault",
    "Visa",
    "Journey",
    "Rewards",
    "Groups",
    "Mice",
    "Escalations",
    "Refunds",
    "Operations",
    "Knowledge",
    "Dashboard",
    "Recommendations",
  ],
  endpoints: () => ({}),
});
