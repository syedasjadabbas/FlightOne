"use client";

import { useAuthStore } from "@/store/auth.store";
import {
  useDismissPredictiveRecommendationMutation,
  useGetPredictiveRecommendationsQuery,
  usePatchPredictivePreferencesMutation,
} from "@/lib/api/recommendations.api";

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
      <p className="text-xs text-slate-500 shrink-0">Looking for suggestions from your trips…</p>
    );
  }
  if (!data) return null;

  return (
    <div className="shrink-0 space-y-2">
      <p className="text-xs font-medium text-slate-700">Suggestions from your trips</p>
      {!data.calendar.configured ? (
        <p className="text-[11px] text-slate-500">
          {data.calendar.reason || "Calendar is not connected. Suggestions use your FlightOne trips and searches only."}
        </p>
      ) : null}
      {!data.items.length ? (
        <p className="text-xs text-slate-500">
          {data.emptyReason || "No personal trip suggestions yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.items.slice(0, 4).map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-xs flex flex-col gap-1.5"
            >
              <p className="text-sm font-medium text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-600 leading-snug">{item.reason}</p>
              <p className="text-[11px] text-slate-400">{item.hedge}</p>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full bg-[#00a8e8] px-2.5 py-0.5 text-[11px] font-medium text-white"
                  onClick={() => onSearch(item.searchPrompt)}
                >
                  Search
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600"
                  onClick={() => void dismiss({ id: item.id })}
                >
                  Not interested
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.preferences ? (
        <label className="flex items-center gap-2 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={data.preferences.proactiveEnabled}
            onChange={(e) => void patchPrefs({ proactiveEnabled: e.target.checked })}
          />
          Proactive trip reminders (app notifications)
        </label>
      ) : null}
    </div>
  );
}
