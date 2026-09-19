"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { useGetProfileQuery } from "@/lib/api/profile.api";
import { useAuthStore } from "@/store/auth.store";
import { PreferencesForm } from "./_components/PreferencesForm";
import { CompanionsSection } from "./_components/CompanionsSection";
import { EmergencySection } from "./_components/EmergencySection";
import { LoyaltySection } from "./_components/LoyaltySection";
import { DocumentsSection } from "./_components/DocumentsSection";
import { SessionsSection } from "./_components/SessionsSection";
import { TwoFactorSection } from "./_components/TwoFactorSection";
import { TravelHistorySection } from "./_components/TravelHistorySection";

type ProfileTab =
  | "PREFERENCES"
  | "COMPANIONS"
  | "EMERGENCY"
  | "LOYALTY"
  | "DOCUMENTS"
  | "SECURITY"
  | "HISTORY";

const TABS: Array<{ id: ProfileTab; label: string; icon: string }> = [
  { id: "PREFERENCES", label: "Preferences", icon: "⚙" },
  { id: "COMPANIONS", label: "Family & Companions", icon: "👥" },
  { id: "EMERGENCY", label: "Emergency Contact", icon: "🚨" },
  { id: "LOYALTY", label: "Loyalty Programs", icon: "⭐" },
  { id: "DOCUMENTS", label: "Identity & Verification", icon: "🛂" },
  { id: "SECURITY", label: "Security & Sessions", icon: "🔒" },
  { id: "HISTORY", label: "Travel History", icon: "✈" },
];

export function ProfilePageClient() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("PREFERENCES");
  const authUser = useAuthStore((s) => s.user);
  const { data: profile, isLoading, isError, refetch } = useGetProfileQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading traveler profile…" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
        <p className="text-base font-semibold text-rose-900">Profile Unavailable</p>
        <p className="mt-1 text-sm text-rose-700">Could not retrieve your traveller profile.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const completeness = profile.completeness;
  const score = completeness?.score ?? 0;
  const isReady = completeness?.readyForHandsFreeBooking;

  // Get user initials
  const displayName = profile.displayName || authUser?.name || "Traveller";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full space-y-8">
      {/* Top Profile Hero Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
        {/* Decorative subtle header pattern */}
        <div className="h-20 bg-gradient-to-r from-slate-900 via-[#0b2238] to-slate-900 px-6 sm:px-8 flex items-center justify-between text-white/40">
          <span className="text-xs font-mono tracking-wider uppercase text-cyan-400">
            FlightOne Traveler ID: {profile.userId.slice(0, 12)}…
          </span>
          <span className="text-xs text-slate-400">Personalized Travel Profile</span>
        </div>

        <div className="px-6 sm:px-8 pb-7 -mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div className="flex items-end gap-4">
              {/* Avatar circle */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white font-extrabold text-2xl shadow-lg ring-4 ring-white font-[var(--font-sora)]">
                {initials}
              </div>

              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                    {displayName}
                  </h1>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    Verified
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  <span>{authUser?.email}</span>
                  {profile.phone && <span>· {profile.phone}</span>}
                  {profile.nationality && (
                    <span>· Nationality: {profile.nationality}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Completeness meter pill */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:min-w-[240px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Profile Readiness</span>
                <span className="font-bold text-cyan-700">{score}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {isReady
                  ? "✓ Complete for instant hands-free booking"
                  : "Add missing details for automated check-in"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/90 p-1.5 border border-slate-200/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "PREFERENCES" && (
          <div className="space-y-6">
            <PreferencesForm profile={profile} />
          </div>
        )}

        {activeTab === "COMPANIONS" && (
          <div className="space-y-6">
            <CompanionsSection />
          </div>
        )}

        {activeTab === "EMERGENCY" && (
          <div className="space-y-6">
            <EmergencySection />
          </div>
        )}

        {activeTab === "LOYALTY" && (
          <div className="space-y-6">
            <LoyaltySection />
          </div>
        )}

        {activeTab === "DOCUMENTS" && (
          <div className="space-y-6">
            <DocumentsSection />
          </div>
        )}

        {activeTab === "SECURITY" && (
          <div className="space-y-6">
            <TwoFactorSection />
            <SessionsSection />
          </div>
        )}

        {activeTab === "HISTORY" && (
          <div className="space-y-6">
            <TravelHistorySection />
          </div>
        )}
      </div>
    </div>
  );
}
