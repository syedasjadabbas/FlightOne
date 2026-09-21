"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Camera,
  Check,
  Copy,
  Globe2,
  Phone,
  Upload,
  X,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
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
  const { data: profile, isLoading, isError, refetch } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdatingAvatar }] = useUpdateProfileMutation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading profile…" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="fo-profile">
        <TravellerPageHeader
          title="Profile"
          lede="Your traveller details for booking prep, documents, and account security."
        />
        <TravellerState
          variant="error"
          title="Profile unavailable"
          action={
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load your traveller profile.
        </TravellerState>
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

  const panelId = `profile-panel-${activeTab.toLowerCase()}`;

  return (
    <div className="fo-profile">
      <TravellerPageHeader
        title="Profile"
        lede="Traveller details for booking prep, documents, loyalty, and account security."
        meta={
          <button type="button" className="fo-profile__link" onClick={handleCopyTravelerId}>
            {isCopiedId ? (
              <>
                <Check size={12} strokeWidth={2} aria-hidden />
                Traveller ID copied
              </>
            ) : (
              <>
                <Copy size={12} strokeWidth={2} aria-hidden />
                Copy traveller ID
              </>
            )}
          </button>
        }
      />

      <div className="fo-profile__identity">
        <div className="fo-profile__person">
          <button
            type="button"
            className="fo-profile__avatar"
            onClick={() => setIsAvatarModalOpen(true)}
            aria-label="Change profile photo"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span aria-hidden>{initials}</span>
            )}
            <span className="fo-profile__avatar-edit" aria-hidden>
              <Camera size={12} strokeWidth={2} />
            </span>
          </button>

          <div className="fo-profile__bio">
            <h2 className="fo-profile__name">{displayName}</h2>
            {authUser?.email ? <p className="fo-profile__email">{authUser.email}</p> : null}
            <ul className="fo-profile__facts">
              {profile.phone ? (
                <li>
                  <Phone size={12} strokeWidth={1.75} aria-hidden />
                  {profile.phone}
                </li>
              ) : null}
              {profile.nationality ? (
                <li>
                  <Globe2 size={12} strokeWidth={1.75} aria-hidden />
                  <span>
                    Nationality <strong>{profile.nationality}</strong>
                  </span>
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  className="fo-profile__link"
                  onClick={() => setIsAvatarModalOpen(true)}
                >
                  Edit photo
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="fo-profile__readiness" aria-label="Profile readiness">
          <div className="fo-profile__readiness-head">
            <p className="fo-profile__readiness-label">Readiness</p>
            <p className="fo-profile__readiness-score">{score}%</p>
          </div>
          <div
            className="fo-traveller__progress"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
          </div>
          <p className="fo-profile__readiness-note">
            {isReady
              ? "Ready for hands-free booking prep."
              : "Add required identity details to finish booking prep."}
          </p>
        </div>
      </div>

      <ProfileTabs active={activeTab} onChange={setActiveTab} />

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`profile-tab-${activeTab.toLowerCase()}`}
        className="space-y-6"
      >
        {activeTab === "PREFERENCES" ? (
          <>
            <PreferencesForm profile={profile} />
            <CompletenessCard profile={profile} />
          </>
        ) : null}
        {activeTab === "COMPANIONS" ? <CompanionsSection /> : null}
        {activeTab === "EMERGENCY" ? <EmergencySection /> : null}
        {activeTab === "LOYALTY" ? <LoyaltySection /> : null}
        {activeTab === "DOCUMENTS" ? <DocumentsSection /> : null}
        {activeTab === "SECURITY" ? (
          <>
            <TwoFactorSection />
            <SessionsSection />
          </>
        ) : null}
        {activeTab === "HISTORY" ? (
          <>
            <TravelHistorySection />
            <TravellerSection title="Suggested next trips" note="Based on your booking patterns.">
              <PredictiveSuggestions
                onSearch={(q) => {
                  window.location.href = `/chat?q=${encodeURIComponent(q)}`;
                }}
              />
            </TravellerSection>
          </>
        ) : null}
      </div>

      {isAvatarModalOpen ? (
        <div
          className="fo-profile__modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAvatarModalOpen(false);
          }}
        >
          <div
            className="fo-profile__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-photo-title"
          >
            <div className="fo-profile__modal-head">
              <div>
                <h3 id="profile-photo-title" className="fo-profile__modal-title">
                  Profile photo
                </h3>
                <p className="fo-profile__modal-lede">Upload a photo or pick a preset.</p>
              </div>
              <button
                type="button"
                className="fo-profile__modal-close"
                onClick={() => setIsAvatarModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {avatarError ? <p className="fo-profile__error">{avatarError}</p> : null}

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
                className="fo-profile__upload"
              >
                <span className="fo-profile__upload-icon" aria-hidden>
                  <Upload size={16} strokeWidth={1.75} />
                </span>
                <span>
                  <p className="fo-profile__upload-title">Upload from device</p>
                  <p className="fo-profile__upload-hint">JPG, PNG, or WebP · max 10MB</p>
                </span>
              </button>
            </div>

            <div>
              <p className="fo-profile__form-label" style={{ marginBottom: "0.55rem" }}>
                Presets
              </p>
              <div className="fo-profile__presets">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isUpdatingAvatar}
                    onClick={() => handleSaveAvatar(preset.url)}
                    className="fo-profile__preset"
                  >
                    <span className="fo-profile__preset-img">
                      <Image
                        src={preset.url}
                        alt=""
                        fill
                        sizes="52px"
                        className="object-cover"
                        unoptimized
                      />
                    </span>
                    <span className="fo-profile__preset-name">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fo-profile__modal-foot">
              {avatarUrl ? (
                <button
                  type="button"
                  disabled={isUpdatingAvatar}
                  onClick={() => handleSaveAvatar(null)}
                  className="fo-profile__danger-link"
                >
                  Remove photo
                </button>
              ) : (
                <span />
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
