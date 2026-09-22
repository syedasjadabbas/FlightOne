import { useAuthStore, type AuthSession } from "@/store/auth.store";
import { getJwtExpiryMs, isJwtExpired } from "@/lib/auth/jwt";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8084/api/v1";
const CSRF_HEADER = "X-FlightOne-CSRF";

/** Cross-tab + in-tab single-flight so only one refresh hits the API. */
let refreshInFlight: Promise<boolean> | null = null;

const LOCK_NAME = "fo-auth-refresh";
const LOCK_STORAGE_KEY = "fo-auth-refresh-lock";
const BROADCAST_CHANNEL = "fo-auth-session";
/** Treat access JWT as stale this far before `exp` (proactive + post-lock skip). */
const FRESHNESS_SKEW_MS = 30_000;
const CROSS_TAB_LOCK_TTL_MS = 15_000;

type SessionBroadcast =
  | { type: "session"; session: AuthSession }
  | { type: "logout" };

let broadcast: BroadcastChannel | null = null;

function getBroadcast(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!broadcast) {
    broadcast = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcast.onmessage = (event: MessageEvent<SessionBroadcast>) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "session" && msg.session?.accessToken) {
        useAuthStore.getState().setSession(msg.session);
      } else if (msg.type === "logout") {
        useAuthStore.getState().clearSession();
      }
    };
  }
  return broadcast;
}

function publishSession(session: AuthSession) {
  try {
    getBroadcast()?.postMessage({ type: "session", session } satisfies SessionBroadcast);
  } catch {
    /* ignore */
  }
}

function publishLogout() {
  try {
    getBroadcast()?.postMessage({ type: "logout" } satisfies SessionBroadcast);
  } catch {
    /* ignore */
  }
}

/**
 * Acquire a short cross-tab lock. Prefer Web Locks API; fall back to localStorage.
 */
async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav && "locks" in nav && typeof nav.locks?.request === "function") {
    return nav.locks.request(LOCK_NAME, { mode: "exclusive" }, () => fn());
  }

  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const started = Date.now();
  while (Date.now() - started < CROSS_TAB_LOCK_TTL_MS) {
    try {
      const raw = localStorage.getItem(LOCK_STORAGE_KEY);
      const held = raw ? (JSON.parse(raw) as { owner: string; until: number }) : null;
      if (!held || held.until < Date.now() || held.owner === owner) {
        localStorage.setItem(
          LOCK_STORAGE_KEY,
          JSON.stringify({ owner, until: Date.now() + CROSS_TAB_LOCK_TTL_MS }),
        );
        const confirm = JSON.parse(localStorage.getItem(LOCK_STORAGE_KEY) || "{}") as {
          owner?: string;
        };
        if (confirm.owner === owner) {
          try {
            return await fn();
          } finally {
            try {
              const cur = JSON.parse(localStorage.getItem(LOCK_STORAGE_KEY) || "{}") as {
                owner?: string;
              };
              if (cur.owner === owner) localStorage.removeItem(LOCK_STORAGE_KEY);
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      return fn();
    }
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
  }
  return fn();
}

export type RefreshSessionOptions = {
  /**
   * Always hit `/auth/refresh` (401 retry / bootstrap). When false, skip the
   * network call if another tab already installed a fresh access JWT.
   */
  force?: boolean;
};

/**
 * Soft-refresh / rotate the HttpOnly refresh cookie into a new access JWT.
 * Concurrent callers await one in-flight request; tabs coordinate via Web Locks
 * + BroadcastChannel so multi-tab does not stampede rotate.
 */
export function refreshSessionOnce(options?: RefreshSessionOptions): Promise<boolean> {
  getBroadcast();
  const force = Boolean(options?.force);

  if (!force) {
    const token = useAuthStore.getState().accessToken;
    if (token && !isJwtExpired(token, FRESHNESS_SKEW_MS)) {
      return Promise.resolve(true);
    }
  }

  if (!refreshInFlight) {
    refreshInFlight = withCrossTabLock(() => runRefresh()).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function logRefreshOutcome(outcome: string, detail?: unknown) {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.warn(`[auth/refresh] ${outcome}`, detail ?? "");
}

async function runRefresh(): Promise<boolean> {
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
      signal: AbortSignal.timeout(8_000),
    });

    let envelope: { success?: boolean; data?: AuthSession } | null = null;
    try {
      envelope = (await res.json()) as { success?: boolean; data?: AuthSession };
    } catch {
      envelope = null;
    }

    if (res.ok && envelope?.success && envelope.data?.accessToken) {
      setSession(envelope.data);
      publishSession(envelope.data);
      return true;
    }

    // Definitive auth failure only — keep session on transient/network/5xx.
    if (res.status === 401 || res.status === 403) {
      logRefreshOutcome(`session cleared — server rejected refresh (${res.status})`, envelope);
      clearSession();
      publishLogout();
      return false;
    }

    logRefreshOutcome(`refresh failed, session kept (status ${res.status})`, envelope);
    return false;
  } catch (err) {
    // Network blip — do not log the user out.
    logRefreshOutcome("refresh request errored, session kept", err);
    return false;
  }
}

/** Ms until we should proactively refresh; null if no schedulable token. */
export function msUntilProactiveRefresh(accessToken: string | null): number | null {
  if (!accessToken) return null;
  const exp = getJwtExpiryMs(accessToken);
  if (exp === null) return null;
  const remaining = exp - Date.now();
  if (remaining <= 0) return 0;
  // Refresh when ~20% of remaining life is left, floored at FRESHNESS_SKEW_MS.
  const lead = Math.max(Math.floor(remaining * 0.2), FRESHNESS_SKEW_MS);
  return Math.max(remaining - lead, 0);
}

/**
 * Schedule silent refresh before access JWT expiry. Call from AuthBootstrap;
 * returns a cleanup that clears the timer.
 */
export function startProactiveRefreshScheduler(): () => void {
  getBroadcast();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const arm = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    const token = useAuthStore.getState().accessToken;
    const wait = msUntilProactiveRefresh(token);
    if (wait === null) return;
    timer = setTimeout(() => {
      void refreshSessionOnce().finally(() => {
        if (!stopped) arm();
      });
    }, wait);
  };

  arm();
  const unsub = useAuthStore.subscribe((state, prev) => {
    if (state.accessToken !== prev.accessToken) arm();
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsub();
  };
}
