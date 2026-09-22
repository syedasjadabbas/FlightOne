import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { useAuthStore } from "@/store/auth.store";
import { refreshSessionOnce } from "@/lib/auth/refreshSession";
import { formatApiError } from "./formatApiError";

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
    // `refreshSessionOnce` already clears the session itself when the server
    // definitively rejects the refresh (401/403). On a transient failure
    // (network blip, 5xx) it deliberately leaves the session intact — do not
    // second-guess that here, or a flaky refresh call logs the user out even
    // though their session was still valid.
    const refreshed = await refreshSessionOnce({ force: true });

    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  if (!result.error && result.data && typeof result.data === "object" && "data" in result.data) {
    return { ...result, data: (result.data as ApiEnvelope<unknown>).data };
  }

  // Normalize error.message so every UI path gets non-technical copy by default.
  if (result.error) {
    const friendly = formatApiError(result.error);
    if (typeof result.error.status === "number") {
      const existingData =
        result.error.data && typeof result.error.data === "object"
          ? (result.error.data as object)
          : {};
      return {
        ...result,
        error: {
          ...result.error,
          data: { ...existingData, message: friendly },
        },
      };
    }
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
    "Voice",
    "Concierge",
  ],
  endpoints: () => ({}),
});
