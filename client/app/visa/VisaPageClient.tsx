"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, MessageCircle, Stamp } from "lucide-react";
import { Button, Spinner, buttonClassName } from "@/components/ui";
import {
  useAssessVisaMutation,
  useEscalateVisaMutation,
  useGetVisaCapabilityQuery,
  type VisaAssessment,
} from "@/lib/api/visa.api";
import { useAuthStore } from "@/store/auth.store";
import {
  VisaApplicationsSection,
  VisaAssessForm,
  VisaAssessmentResult,
  VisaDisclaimer,
  VisaSpecialistSupport,
} from "./_components";
import "./visa.css";

export function VisaPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = Boolean(accessToken);
  const [destination, setDestination] = useState("AE");
  const [nationality, setNationality] = useState("PK");
  const [transit, setTransit] = useState("");
  const [purpose, setPurpose] = useState("tourism");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [assessment, setAssessment] = useState<VisaAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escalateMsg, setEscalateMsg] = useState<string | null>(null);

  const {
    data: capability,
    isLoading: capLoading,
    isError: capError,
    refetch: refetchCapability,
  } = useGetVisaCapabilityQuery(undefined, { skip: !hasHydrated });
  const [assess, { isLoading: assessing }] = useAssessVisaMutation();
  const [escalate, { isLoading: escalating }] = useEscalateVisaMutation();

  async function onAssess(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAssessment(null);
    setEscalateMsg(null);
    const dest = destination.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(dest)) {
      setError("Destination must be a valid 2-letter ISO country code (e.g. AE, TR, GB).");
      return;
    }
    const nat = nationality.trim().toUpperCase();
    if (nat && !/^[A-Z]{2}$/.test(nat)) {
      setError("Nationality must be a valid 2-letter ISO country code (e.g. PK, US, GB).");
      return;
    }
    const transitCountries = transit
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z]{2}$/.test(s));

    try {
      const data = await assess({
        destination: dest,
        ...(nat ? { nationality: nat } : {}),
        ...(transitCountries.length ? { transitCountries } : {}),
        ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
      }).unwrap();
      setAssessment(data);
    } catch (err) {
      setError(
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message || "Assessment failed")
          : "Visa assessment failed. Please verify the country code and try again.",
      );
    }
  }

  async function onEscalate() {
    setError(null);
    setEscalateMsg(null);
    try {
      await escalate({
        destination: destination.trim().toUpperCase(),
        nationality: nationality.trim().toUpperCase(),
        reason: `Traveller requested visa assistance for ${destination.trim().toUpperCase()} (${purpose || "general"})`,
      }).unwrap();
      setEscalateMsg(
        "Request routed to the Visa Advisory Desk. A travel consultant will review your case.",
      );
    } catch {
      setError("Could not record escalation request. Please contact support via Ava Chat.");
    }
  }

  if (!hasHydrated || capLoading) {
    return (
      <div className="fo-visa__boot" role="status" aria-live="polite">
        <Spinner label="Loading visa advisory…" />
        <p className="fo-visa__boot-label">Loading visa advisory</p>
      </div>
    );
  }

  if (capError && !capability) {
    return (
      <div className="fo-visa__gate">
        <div className="fo-visa__gate-box">
          <div className="fo-visa__gate-icon fo-visa__gate-icon--warn" aria-hidden>
            <AlertCircle size={22} strokeWidth={2} />
          </div>
          <h2 className="fo-visa__gate-title">Visa Advisory Unavailable</h2>
          <p className="fo-visa__gate-desc">
            Could not reach the visa rules capability endpoint. Check connectivity and try again.
          </p>
          <Button size="md" variant="secondary" onClick={() => void refetchCapability()}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const req = assessment?.requirement;

  return (
    <div className="fo-visa__master-stage">
      <div className="fo-visa__nav-rail">
        <span className="fo-visa__brand-badge">
          <span className="fo-visa__brand-dot" aria-hidden />
          Visa Advisory
        </span>
        <div className="fo-visa__rail-actions">
          <Link href="/chat">
            <Button
              size="sm"
              variant="secondary"
              icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden />}
            >
              Ask Ava
            </Button>
          </Link>
          {!isAuthenticated ? (
            <Link href="/login?redirect=%2Fvisa" className={buttonClassName({ size: "sm" })}>
              Sign In
            </Link>
          ) : null}
        </div>
      </div>

      <header className="fo-visa__hero">
        <p className="fo-visa__eyebrow">
          <Stamp size={13} strokeWidth={2.2} aria-hidden />
          Passport × destination corridor
        </p>
        <h1 className="fo-visa__title">Visa advisory</h1>
        <p className="fo-visa__lede">
          Cross-checked with your{" "}
          <Link href="/profile" className="text-navy underline-offset-2 hover:underline">
            Profile
          </Link>{" "}
          and{" "}
          <Link href="/vault" className="text-navy underline-offset-2 hover:underline">
            Travel Vault
          </Link>
          . Unverified or stale data is never presented as a travel guarantee.
        </p>
        <p className="text-[0.75rem] text-ink-faint">
          {capability?.configured
            ? `Data source · ${capability.provider} (${capability.sourceKind})`
            : capability?.reasons?.[0] || "Visa rules database ready for advisory lookup."}
        </p>
      </header>

      <div className="fo-visa__panel">
        <VisaDisclaimer />
      </div>

      <div className="fo-visa__panel">
        <VisaAssessForm
          destination={destination}
          nationality={nationality}
          transit={transit}
          purpose={purpose}
          departDate={departDate}
          returnDate={returnDate}
          assessing={assessing}
          canLookup={Boolean(capability?.canLookup)}
          error={error}
          onDestination={setDestination}
          onNationality={setNationality}
          onTransit={setTransit}
          onPurpose={setPurpose}
          onDepartDate={setDepartDate}
          onReturnDate={setReturnDate}
          onSubmit={onAssess}
        />
      </div>

      {assessment ? (
        <>
          <div className="fo-visa__panel">
            <VisaAssessmentResult
              assessment={assessment}
              destination={destination.trim().toUpperCase()}
              nationalityFallback={nationality}
            />
          </div>

          <VisaApplicationsSection
            nationality={assessment.traveller?.nationality || nationality}
            destination={destination.trim().toUpperCase()}
            category={req?.category}
          />

          <VisaSpecialistSupport
            isAuthenticated={isAuthenticated}
            escalating={escalating}
            escalateMsg={escalateMsg}
            onEscalate={() => void onEscalate()}
          />
        </>
      ) : null}
    </div>
  );
}
