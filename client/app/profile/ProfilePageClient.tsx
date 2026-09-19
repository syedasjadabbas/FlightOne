"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button, Spinner } from "@/components/ui";
import { useGetProfileQuery, useUpdateProfileMutation } from "@/lib/api/profile.api";
import { useAuthStore } from "@/store/auth.store";
import { PreferencesForm } from "./_components/PreferencesForm";
import { CompanionsSection } from "./_components/CompanionsSection";
import { EmergencySection } from "./_components/EmergencySection";
import { LoyaltySection } from "./_components/LoyaltySection";
import { DocumentsSection } from "./_components/DocumentsSection";
import { SessionsSection } from "./_components/SessionsSection";
import { TwoFactorSection } from "./_components/TwoFactorSection";
import { TravelHistorySection } from "./_components/TravelHistorySection";
import { PredictiveSuggestions } from "@/app/components/ask-ai/PredictiveSuggestions";

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

const PRESET_AVATARS = [
  { id: "p1", name: "Global Explorer", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" },
  { id: "p2", name: "Executive Nomad", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80" },
  { id: "p3", name: "Sky Voyager", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80" },
  { id: "p4", name: "Jetsetter", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80" },
  { id: "p5", name: "Island Wanderer", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80" },
  { id: "p6", name: "Urban Adventurer", url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80" },
];

export function ProfilePageClient() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("PREFERENCES");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authUser = useAuthStore((s) => s.user);
  const { data: profile, isLoading, isError, refetch } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdatingAvatar }] = useUpdateProfileMutation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading traveler profile…" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xs">
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

  const displayName = profile.displayName || authUser?.name || "Traveller";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profileMeta = (profile.metadata && typeof profile.metadata === "object" ? profile.metadata : {}) as Record<string, any>;
  const avatarUrl = profileMeta.avatarUrl as string | undefined;

  const handleCopyTravelerId = async () => {
    try {
      await navigator.clipboard.writeText(profile.userId);
      setIsCopiedId(true);
      setTimeout(() => setIsCopiedId(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveAvatar = async (nextAvatarUrl: string | null) => {
    setAvatarError(null);
    try {
      const nextMeta = { ...profileMeta };
      if (nextAvatarUrl) {
        nextMeta.avatarUrl = nextAvatarUrl;
      } else {
        delete nextMeta.avatarUrl;
      }
      await updateProfile({ metadata: nextMeta }).unwrap();
      setIsAvatarModalOpen(false);
    } catch (err: any) {
      setAvatarError(err?.data?.message || err?.message || "Failed to update profile photo");
    }
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = document.createElement("img");
        img.onload = () => {
          const maxDim = 512;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => resolve(readerEvent.target?.result as string);
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("Image file size must be under 10MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select a valid image file (JPG, PNG, WebP)");
      return;
    }

    try {
      const resizedDataUrl = await resizeImage(file);
      await handleSaveAvatar(resizedDataUrl);
    } catch {
      setAvatarError("Failed to process the uploaded image");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* ── TOP HERO PROFILE CARD ──────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
        {/* Navy Header Banner Strip */}
        <div className="bg-gradient-to-r from-[#06121e] via-[#0b243d] to-[#081829] px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-white border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/60 px-3 py-1 text-[11px] font-mono tracking-wider uppercase text-cyan-300 border border-cyan-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              ID: {profile.userId.slice(0, 14)}…
            </span>
            <button
              type="button"
              onClick={handleCopyTravelerId}
              className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Copy Traveler ID"
            >
              {isCopiedId ? "✓ Copied" : "Copy ID"}
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="hidden sm:inline">Personalized Travel Profile</span>
            <span className="rounded-full bg-blue-500/20 border border-blue-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200">
              Tier 1 Traveler
            </span>
          </div>
        </div>

        {/* Hero Body */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Avatar & Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar Container with Hover Overlay & Photo Change Option */}
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-black text-3xl shadow-md ring-4 ring-slate-100 hover:ring-cyan-200 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Change profile photo"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      fill
                      sizes="112px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="font-[var(--font-sora)]">{initials}</span>
                  )}

                  {/* Dark hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>Change</span>
                  </div>
                </button>

                {/* Edit Camera Badge */}
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-cyan-50 hover:text-cyan-700 hover:scale-105 transition-all cursor-pointer"
                  title="Change profile photo"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>

              {/* User Bio & Meta Details */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <svg className="h-3 w-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Verified
                  </span>
                </div>

                <p className="text-[13px] text-slate-600 font-medium">{authUser?.email}</p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                  {profile.phone ? (
                    <span className="flex items-center gap-1">
                      <span>📞</span> {profile.phone}
                    </span>
                  ) : null}
                  {profile.nationality ? (
                    <span className="flex items-center gap-1">
                      <span>🌍</span> Nationality: <strong className="text-slate-800 font-semibold">{profile.nationality}</strong>
                    </span>
                  ) : null}
                  <span className="text-slate-400">·</span>
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="text-cyan-700 hover:text-cyan-800 font-semibold hover:underline"
                  >
                    Edit Photo
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Profile Readiness Widget */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 sm:p-5 lg:min-w-[280px] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Profile Readiness</span>
                <span className="font-black text-cyan-700 text-sm">{score}%</span>
              </div>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 transition-all duration-500"
                  style={{ width: `${Math.max(8, Math.min(100, score))}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-600 leading-relaxed font-medium">
                {isReady
                  ? "✓ Complete for instant hands-free booking"
                  : "Add missing identity details for automated check-in"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── NAVIGATION TABS BAR ───────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-slate-100/90 p-1.5 border border-slate-200/70 shadow-2xs no-scrollbar">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs sm:text-[13px] font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-white text-slate-950 shadow-xs font-bold ring-1 ring-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT PANELS ────────────────────────────── */}
      <div className="transition-opacity duration-200">
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
            <PredictiveSuggestions
              onSearch={(q) => {
                window.location.href = `/chat?q=${encodeURIComponent(q)}`;
              }}
            />
          </div>
        )}
      </div>

      {/* ── PHOTO CHANGE MODAL DIALOG ────────────────────── */}
      {isAvatarModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Change Profile Photo</h3>
                <p className="text-xs text-slate-500 mt-0.5">Choose an avatar or upload your photo</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close dialog"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {avatarError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                {avatarError}
              </div>
            ) : null}

            {/* Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUpdatingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 p-4 text-center hover:bg-cyan-50/80 hover:border-cyan-400 transition-all cursor-pointer group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 group-hover:scale-110 transition-transform">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-cyan-900">Upload Photo from Device</p>
                  <p className="text-[11px] text-cyan-700">JPG, PNG, or WebP up to 5MB</p>
                </div>
              </button>
            </div>

            {/* Preset Avatars */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2.5">Or select a travel avatar</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isUpdatingAvatar}
                    onClick={() => handleSaveAvatar(preset.url)}
                    className="relative flex flex-col items-center gap-1.5 p-2 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/30 transition-all cursor-pointer group"
                  >
                    <div className="relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-cyan-500 transition-all">
                      <Image
                        src={preset.url}
                        alt={preset.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 truncate w-full text-center">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              {avatarUrl ? (
                <button
                  type="button"
                  disabled={isUpdatingAvatar}
                  onClick={() => handleSaveAvatar(null)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Remove Photo
                </button>
              ) : (
                <div />
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={isUpdatingAvatar}
                onClick={() => setIsAvatarModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
