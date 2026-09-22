"use client";

import { useAuthStore } from "@/store/auth.store";
import {
  useDismissPredictiveRecommendationMutation,
  useGetPredictiveRecommendationsQuery,
  usePatchPredictivePreferencesMutation,
} from "@/lib/api/recommendations.api";
import { ArrowRight, Loader2, X } from "lucide-react";

export function PredictiveSuggestions({
  onSearch,
}: {
  onSearch: (prompt: string) => void;
}) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading } = useGetPredictiveRecommendationsQuery(undefined, { skip });
  const [dismiss] = useDismissPredictiveRecommendationMutation();
  const [patchPrefs] = usePatchPredictivePreferencesMutation();

  if (skip) return null;
  if (isLoading) {
    return (
      <p className="flex shrink-0 items-center gap-2 text-xs text-[var(--ink-faint)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--sky)]" strokeWidth={2} aria-hidden />
        Looking for suggestions from your trips…
      </p>
    );
  }
  if (!data) return null;

  return (
    <div className="shrink-0 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        From your trips
      </p>
      {!data.calendar.configured ? (
        <p className="text-[11px] text-[var(--ink-soft)]">
          {data.calendar.reason ||
            "Calendar is not connected. Suggestions use your FlightOne trips and searches only."}
        </p>
      ) : null}
      {!data.items.length ? (
        <p className="text-xs text-[var(--ink-soft)]">
          {data.emptyReason || "No personal trip suggestions yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.slice(0, 4).map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-2xl bg-white p-3 shadow-[0_2px_8px_rgba(14,22,32,0.05),inset_0_1px_0_#ffffff]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight text-[var(--navy)]">{item.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--ink-soft)]">{item.reason}</p>
                <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">{item.hedge}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--sky-solid)] px-3.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(8,150,191,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--electric)_90%,var(--navy))] hover:shadow-[0_8px_22px_rgba(0,122,229,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 active:translate-y-0 active:scale-[0.98]"
                    onClick={() => onSearch(item.searchPrompt)}
                  >
                    Search
                    <ArrowRight className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[color-mix(in_oklab,var(--navy)_6%,transparent)] hover:text-[var(--navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
                    onClick={() => void dismiss({ id: item.id })}
                    aria-label={`Dismiss ${item.title}`}
                  >
                    <X className="h-3 w-3" strokeWidth={2} aria-hidden />
                    Not interested
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.preferences ? (
        <label className="flex items-center gap-2 text-[11px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            className="rounded border-[var(--line)] text-[var(--electric)] focus:ring-[var(--electric)]"
            checked={data.preferences.proactiveEnabled}
            onChange={(e) => void patchPrefs({ proactiveEnabled: e.target.checked })}
          />
          Proactive trip reminders
        </label>
      ) : null}
    </div>
  );
}
