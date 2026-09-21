"use client";

import { useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui";
import { TravellerPageHeader } from "@/app/components/traveller";
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

export function VisaPageClient() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const [destination, setDestination] = useState("AE");
  const [nationality, setNationality] = useState("PK");
  const [transit, setTransit] = useState("");
  const [purpose, setPurpose] = useState("tourism");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [assessment, setAssessment] = useState<VisaAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escalateMsg, setEscalateMsg] = useState<string | null>(null);

  const { data: capability, isLoading: capLoading } = useGetVisaCapabilityQuery();
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

  if (capLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const req = assessment?.requirement;

  return (
    <div className="fo-visa">
      <TravellerPageHeader
        title="Visa advisory"
        lede={
          <>
            Passport nationality × destination rules, cross-checked with your{" "}
            <Link href="/profile">Profile</Link> and <Link href="/vault">Travel Vault</Link>.
            Unverified or stale data is never presented as a travel guarantee.
          </>
        }
        meta={
          capability?.configured
            ? `Data source · ${capability.provider} (${capability.sourceKind})`
            : capability?.reasons?.[0] || "Visa rules database ready for advisory lookup."
        }
      />

      <VisaDisclaimer />

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

      {assessment ? (
        <>
          <VisaAssessmentResult
            assessment={assessment}
            destination={destination.trim().toUpperCase()}
            nationalityFallback={nationality}
          />

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
