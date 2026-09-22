"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Copy,
  Globe2,
  Lock,
  Phone,
  Plane,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  useGetProfileQuery,
  useUpdateProfileMutation,
} from "@/lib/api/profile.api";
import { useAuthStore } from "@/store/auth.store";
import { PreferencesForm } from "./_components/PreferencesForm";
import { CompanionsSection } from "./_components/CompanionsSection";
import { EmergencySection } from "./_components/EmergencySection";
import { LoyaltySection } from "./_components/LoyaltySection";
import { DocumentsSection } from "./_components/DocumentsSection";
import { SessionsSection } from "./_components/SessionsSection";
import { TwoFactorSection } from "./_components/TwoFactorSection";
import { TravelHistorySection } from "./_components/TravelHistorySection";
import { CompletenessCard } from "./_components/CompletenessCard";
import { ProfileTabs, type ProfileTab } from "./_components/ProfileTabs";
import { PredictiveSuggestions } from "@/app/components/ask-ai/PredictiveSuggestions";
import "./profile.css";

const PRESET_AVATARS = [
  {
    id: "p1",
    name: "Explorer",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "p2",
    name: "Nomad",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "p3",
    name: "Voyager",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "p4",
    name: "Traveller",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "p5",
    name: "Wanderer",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "p6",
    name: "Urban",
    url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80",
  },
];

export function ProfilePageClient() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("PREFERENCES");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authUser = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile, isLoading, isError, refetch } = useGetProfileQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });
  const [updateProfile, { isLoading: isUpdatingAvatar }] = useUpdateProfileMutation();

  if (!hasHydrated || (accessToken && isLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner label="Loading profile dossier…" />
          <p className="text-xs tracking-wider uppercase text-ink-faint">Decrypting traveller profile</p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-profile__auth-gate">
        <div className="fo-profile__auth-box">
          <div className="fo-profile__auth-icon" aria-hidden>
            <Lock size={24} strokeWidth={2} />
          </div>
          <h2 className="fo-profile__auth-title">Authentication Required</h2>
          <p className="fo-profile__auth-desc">
            Sign in with verified credentials to access your secure traveller dossier and preference settings.
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 font-semibold shadow-lg"
            onClick={() => {
              window.location.href = "/login?redirect=/profile";
            }}
          >
            Sign In to FlightOne
          </Button>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="fo-profile__auth-gate">
        <div className="fo-profile__auth-box">
          <h2 className="fo-profile__auth-title">Profile Unavailable</h2>
          <p className="fo-profile__auth-desc">
            Could not retrieve your traveller profile from the secure store.
          </p>
          <Button size="md" variant="secondary" onClick={() => refetch()}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const completeness = profile.completeness;
  const score = completeness?.score ?? 0;
  const isReady = completeness?.readyForHandsFreeBooking || score === 100;

  const displayName = profile.displayName || authUser?.name || "Traveller";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profileMeta = (
    profile.metadata && typeof profile.metadata === "object" ? profile.metadata : {}
  ) as Record<string, unknown>;
  const avatarUrl =
    typeof profileMeta.avatarUrl === "string" ? profileMeta.avatarUrl : undefined;

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
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string }; message?: string }).data?.message ||
                (err as { message?: string }).message ||
                "Failed to update profile photo",
            )
          : "Failed to update profile photo";
      setAvatarError(message);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const panelId = `profile-panel-${activeTab.toLowerCase()}`;

  function goToReadinessTarget(tab: ProfileTab, fieldId?: string) {
    setActiveTab(tab);
    if (!fieldId) return;
    window.setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLElement && typeof el.focus === "function") {
        el.focus({ preventScroll: true });
      } else {
        const input = el.querySelector<HTMLElement>("input, select, button, [tabindex]");
        input?.focus({ preventScroll: true });
      }
    }, 80);
  }

  // Calculate readiness gauge circular geometry
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (score / 100) * circumference;

  return (
    <div className="fo-profile__master-stage">
      {/* ── Top Header Navigation Rail (AIVENTURE Style) ────────────────── */}
      <div className="fo-profile__nav-rail">
        {/* Left Badge */}
        <div className="fo-profile__brand-badge">
          <span className="fo-profile__brand-dot" aria-hidden />
          <span className="font-semibold tracking-wider text-xs uppercase">Traveller Dossier</span>
        </div>

        {/* Center Tabs */}
        <div className="fo-profile__nav-center">
          <ProfileTabs active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Right Actions */}
        <div className="fo-profile__nav-actions">
          <button
            type="button"
            onClick={handleCopyTravelerId}
            className="fo-profile__action-pill"
            title="Copy Traveller ID"
          >
            {isCopiedId ? (
              <>
                <Check size={13} strokeWidth={2.5} className="text-emerald" />
                <span>ID Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} strokeWidth={2} />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Master Hero Showcase Section (AIVENTURE Inspired) ─────────── */}
      <div className="fo-profile__hero-showcase">
        {/* Left Column: Bold Typography & Action Controls */}
        <div className="fo-profile__hero-left">
          <div className="fo-profile__hero-eyebrow">
            <Sparkles size={13} strokeWidth={2} className="text-cyan" />
            <span>AI-OPTIMIZED TRAVELLER IDENTITY</span>
          </div>

          <h1 className="fo-profile__hero-title">
            YOUR DOSSIER<br />
            <span className="fo-profile__hero-title-accent">AI PERFECTED</span>
          </h1>

          <p className="fo-profile__hero-lede">
            Autonomous booking readiness, biometric vault encryption, and loyalty synchronization for effortless global flight reservations.
          </p>

          <div className="fo-profile__hero-cta-group">
            <button
              type="button"
              onClick={() => {
                goToReadinessTarget("PREFERENCES", "profile-field-displayName");
              }}
              className="fo-profile__cta-primary"
            >
              <span>{isReady ? "Edit Preferences" : "Complete Dossier"}</span>
              <span className="fo-profile__cta-icon-circle">
                <ChevronRight size={14} strokeWidth={2.5} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="fo-profile__cta-secondary"
            >
              <Camera size={14} strokeWidth={2} />
              <span>Change Photo</span>
            </button>
          </div>

          {/* Bottom 3 Feature Pills */}
          <div className="fo-profile__feature-pills">
            <div className="fo-profile__feature-pill">
              <span className="fo-profile__feature-pill-dot fo-profile__feature-pill-dot--cyan" />
              <span>Automated Booking</span>
            </div>
            <div className="fo-profile__feature-pill">
              <span className="fo-profile__feature-pill-dot fo-profile__feature-pill-dot--emerald" />
              <span>AES-256 Vault</span>
            </div>
            <div className="fo-profile__feature-pill">
              <span className="fo-profile__feature-pill-dot fo-profile__feature-pill-dot--amber" />
              <span>VIP Loyalty Sync</span>
            </div>
          </div>
        </div>

        {/* Right Column: Organic Scenic Canvas with Floating Instrument Dials */}
        <div className="fo-profile__hero-right">
          <div className="fo-profile__canvas-container">
            {/* Scenic Background with Topographic Texture */}
            <div className="fo-profile__canvas-backdrop">
              <div className="fo-profile__canvas-glow" />
              <div className="fo-profile__canvas-image" />

              {/* Waypoint Flight Route SVG Arc */}
              <svg className="fo-profile__canvas-route" viewBox="0 0 500 300" fill="none" preserveAspectRatio="none">
                <path
                  d="M 30 240 Q 180 160 300 120 T 460 70"
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                />
                <circle cx="30" cy="240" r="4.5" fill="#00D2FF" />
                <circle cx="300" cy="120" r="4.5" fill="#FFFFFF" />
                <circle cx="460" cy="70" r="5" fill="#25D366" />
              </svg>
            </div>

            {/* Floating Waypoint Tag: Top Right */}
            <div className="fo-profile__canvas-tag fo-profile__canvas-tag--top">
              <Plane size={12} strokeWidth={2.2} className="text-cyan" />
              <span>
                {profile.preferredAirlines?.length
                  ? `Preferred: ${profile.preferredAirlines.slice(0, 3).join(" · ")}`
                  : "Preferred Carriers"}
              </span>
            </div>

            {/* Floating Waypoint Tag: Middle */}
            <div className="fo-profile__canvas-tag fo-profile__canvas-tag--mid">
              <ShieldCheck size={12} strokeWidth={2.2} className="text-emerald" />
              <span>Zero-Knowledge Vault</span>
            </div>

            {/* Floating Tactile Readiness Instrument (Temperature Dial Style) */}
            <div className="fo-profile__dial-widget">
              <div className="fo-profile__dial-head">
                <span className="fo-profile__dial-label">READINESS METRIC</span>
                <span className="fo-profile__dial-arrow">↗</span>
              </div>

              {/* Circular Dial Visual */}
              <div className="fo-profile__dial-circle-wrap">
                <svg className="fo-profile__dial-svg" viewBox="0 0 96 96">
                  {/* Outer subtle ticks */}
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    className="fo-profile__dial-track"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    className="fo-profile__dial-progress"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                </svg>

                <div className="fo-profile__dial-value">
                  <span className="fo-profile__dial-number">{score}</span>
                  <span className="fo-profile__dial-percent">%</span>
                </div>
              </div>

              {/* Status Segment Pills */}
              <div className="fo-profile__dial-status-pills">
                <span className={`fo-profile__dial-status-pill${score < 50 ? " fo-profile__dial-status-pill--active" : ""}`}>
                  Pending
                </span>
                <span className={`fo-profile__dial-status-pill${score >= 50 && score < 100 ? " fo-profile__dial-status-pill--active" : ""}`}>
                  Prepped
                </span>
                <span className={`fo-profile__dial-status-pill${score === 100 ? " fo-profile__dial-status-pill--active" : ""}`}>
                  Ready
                </span>
              </div>
            </div>

            {/* Floating Facepile / Profile Card Widget (Bottom Right) */}
            <div className="fo-profile__facepile-widget">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="fo-profile__facepile-avatar"
                title="Change photo"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="52px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="fo-profile__facepile-cam" aria-hidden>
                  <Camera size={10} strokeWidth={2} />
                </span>
              </button>

              <div className="fo-profile__facepile-info">
                <p className="fo-profile__facepile-name">{displayName}</p>
                <p className="fo-profile__facepile-sub">{authUser?.email || profile.userId.slice(0, 12)}</p>
                <div className="fo-profile__facepile-status">
                  <span className={`fo-profile__facepile-dot${isReady ? " fo-profile__facepile-dot--ready" : ""}`} />
                  <span>{isReady ? "Hands-Free Ready" : `${score}% Complete`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Tab Content Panel ─────────────────────────────────── */}
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`profile-tab-${activeTab.toLowerCase()}`}
        className="fo-profile__panel-container"
      >
        {activeTab === "PREFERENCES" ? (
          <div className="space-y-6">
            <CompletenessCard profile={profile} onNavigate={goToReadinessTarget} />
            <PreferencesForm profile={profile} />
          </div>
        ) : null}

        {activeTab === "COMPANIONS" ? <CompanionsSection /> : null}
        {activeTab === "EMERGENCY" ? <EmergencySection /> : null}
        {activeTab === "LOYALTY" ? <LoyaltySection /> : null}
        {activeTab === "DOCUMENTS" ? <DocumentsSection /> : null}
        {activeTab === "SECURITY" ? (
          <div className="space-y-6">
            <TwoFactorSection />
            <SessionsSection />
          </div>
        ) : null}
        {activeTab === "HISTORY" ? (
          <div className="space-y-6">
            <TravelHistorySection />
            <div className="fo-profile__tactile-card p-6">
              <h3 className="text-base font-bold text-navy">Suggested Next Trips</h3>
              <p className="mb-4 text-xs text-ink-soft">AI-curated destinations based on your travel history and preferences.</p>
              <PredictiveSuggestions
                onSearch={(q) => {
                  window.location.href = `/chat?q=${encodeURIComponent(q)}`;
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Avatar Edit Modal (Luxury Frosted Dialog) ────────────────── */}
      {isAvatarModalOpen && typeof document !== "undefined"
        ? createPortal(
        <div
          className="fo-profile__modal-backdrop"
          onClick={() => setIsAvatarModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-photo-title"
        >
          <div
            className="fo-profile__modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fo-profile__modal-header">
              <div>
                <h3 id="profile-photo-title" className="fo-profile__modal-title">
                  Update Profile Photo
                </h3>
                <p className="fo-profile__modal-lede">
                  Select a curated avatar persona or upload a custom image.
                </p>
              </div>
              <button
                type="button"
                className="fo-profile__modal-close-btn"
                onClick={() => setIsAvatarModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {avatarError ? (
              <p className="fo-profile__error-pill" role="alert">
                {avatarError}
              </p>
            ) : null}

            {/* Custom Upload Dropzone */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                className="fo-profile__upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUpdatingAvatar}
              >
                <div className="fo-profile__upload-dropzone-icon">
                  <Upload size={18} strokeWidth={2} />
                </div>
                <div>
                  <p className="fo-profile__upload-dropzone-title">Upload Image</p>
                  <p className="fo-profile__upload-dropzone-sub">JPG, PNG, WebP up to 10MB</p>
                </div>
              </button>
            </div>

            {/* Curated Presets Grid */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Curated Personas
              </p>
              <div className="fo-profile__preset-grid">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="fo-profile__preset-chip"
                    onClick={() => handleSaveAvatar(preset.url)}
                    disabled={isUpdatingAvatar}
                  >
                    <div className="fo-profile__preset-thumb">
                      <Image
                        src={preset.url}
                        alt={preset.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="fo-profile__preset-name">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="fo-profile__modal-footer">
              {avatarUrl ? (
                <button
                  type="button"
                  className="fo-profile__modal-remove-btn"
                  onClick={() => handleSaveAvatar(null)}
                  disabled={isUpdatingAvatar}
                >
                  Remove Custom Photo
                </button>
              ) : <span />}

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsAvatarModalOpen(false)}
                disabled={isUpdatingAvatar}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
}
