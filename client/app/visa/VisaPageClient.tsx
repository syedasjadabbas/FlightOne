"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import {
  useAssessVisaMutation,
  useCreateVisaApplicationMutation,
  useEscalateVisaMutation,
  useGetVisaCapabilityQuery,
  useListVisaApplicationsQuery,
  useUpdateVisaApplicationMutation,
  type VisaAssessment,
  type VisaCategory,
} from "@/lib/api/visa.api";
import { useAuthStore } from "@/store/auth.store";

const POPULAR_DESTINATIONS = [
  { code: "AE", label: "United Arab Emirates (AE)" },
  { code: "SA", label: "Saudi Arabia (SA)" },
  { code: "TR", label: "Turkey (TR)" },
  { code: "GB", label: "United Kingdom (GB)" },
  { code: "US", label: "United States (US)" },
  { code: "DE", label: "Germany / Schengen (DE)" },
  { code: "TH", label: "Thailand (TH)" },
  { code: "MY", label: "Malaysia (MY)" },
  { code: "SG", label: "Singapore (SG)" },
  { code: "QA", label: "Qatar (QA)" },
  { code: "CA", label: "Canada (CA)" },
  { code: "CN", label: "China (CN)" },
];

const POPULAR_NATIONALITIES = [
  { code: "PK", label: "Pakistan (PK)" },
  { code: "IN", label: "India (IN)" },
  { code: "GB", label: "United Kingdom (GB)" },
  { code: "US", label: "United States (US)" },
  { code: "AE", label: "United Arab Emirates (AE)" },
  { code: "SA", label: "Saudi Arabia (SA)" },
  { code: "CA", label: "Canada (CA)" },
  { code: "AU", label: "Australia (AU)" },
];

const PURPOSE_OPTIONS = [
  { value: "tourism", label: "Tourism & Leisure" },
  { value: "business", label: "Business & Corporate Meetings" },
  { value: "transit", label: "Airport Transit & Layover" },
  { value: "mice", label: "Conference & MICE Event" },
  { value: "family", label: "Family / Relative Visit" },
  { value: "employment", label: "Work / Employment" },
  { value: "study", label: "Student / Educational" },
  { value: "umrah", label: "Umrah / Religious Pilgrimage" },
];

function FactBadge({ isFact, dataStatus }: { isFact: boolean; dataStatus?: string | null }) {
  if (isFact) {
    return <TravellerChip>Attributed fact</TravellerChip>;
  }
  return (
    <TravellerChip tone="warn">
      Guidance only{dataStatus ? ` · ${dataStatus}` : ""}
    </TravellerChip>
  );
}

function CategoryBadge({ category }: { category?: VisaCategory | string | null }) {
  switch (category) {
    case "VISA_FREE":
      return <TravellerChip tone="default">Visa Free Access</TravellerChip>;
    case "VOA":
      return <TravellerChip tone="default">Visa On Arrival</TravellerChip>;
    case "E_VISA":
      return <TravellerChip tone="default">Electronic Visa (eVisa)</TravellerChip>;
    case "EMBASSY":
      return <TravellerChip tone="warn">Embassy / Consulate Visa Required</TravellerChip>;
    default:
      return <TravellerChip tone="muted">Verification Required</TravellerChip>;
  }
}

function ChecklistBlock({ checklist }: { checklist: VisaAssessment["checklist"] }) {
  if (!checklist || typeof checklist !== "object") return null;
  const c = checklist as {
    items?: Array<{ item: string; presentHint?: boolean; matchHint?: string | null }>;
    missingCount?: number;
    note?: string;
  };
  if (!c.items?.length) {
    return <p className="text-[13px] text-ink-faint">{c.note || "No specific documents required on file."}</p>;
  }
  return (
    <div className="space-y-2">
      <ul className="fo-traveller__list">
        {c.items.map((item) => (
          <li
            key={item.item}
            className="fo-traveller__row border-x-0 border-t-0 first:border-t"
          >
            <p className="fo-traveller__row-title">{item.item}</p>
            <p className="fo-traveller__row-meta">
              {item.presentHint ? "Profile/Vault hint: Document present" : "Profile/Vault hint: Not found"}
              {item.matchHint ? ` — ${item.matchHint}` : ""}
            </p>
            <p className="fo-traveller__row-meta text-[11px] text-slate-400">
              Checklist provided for advisory purposes; not a legal determination of document sufficiency.
            </p>
          </li>
        ))}
      </ul>
      {c.note ? <p className="text-[12px] text-ink-faint">{c.note}</p> : null}
    </div>
  );
}

function VisaApplicationsSection({
  nationality,
  destination,
  category,
}: {
  nationality?: string | null;
  destination: string;
  category?: VisaCategory;
}) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const { data, isLoading, refetch } = useListVisaApplicationsQuery(undefined, {
    skip: !hasHydrated || !isAuthenticated,
  });
  const [createApp, createState] = useCreateVisaApplicationMutation();
  const [updateApp, updateState] = useUpdateVisaApplicationMutation();
  const [apptAt, setApptAt] = useState("");
  const [apptLoc, setApptLoc] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  if (hasHydrated && !isAuthenticated) {
    return (
      <TravellerSection
        title="Application & appointment tracking"
        note="Track embassy appointments and document submissions."
        panel
      >
        <p className="text-[13px] text-ink-soft">
          Sign in to your FlightOne account to open tracked visa cases, record embassy biometrics appointments, and store application reference IDs.
        </p>
        <div className="mt-3">
          <Link href="/login?redirect=%2Fvisa">
            <Button size="sm" variant="secondary">
              Sign in to track applications
            </Button>
          </Link>
        </div>
      </TravellerSection>
    );
  }

  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown } | undefined)?.items)
      ? (data as { items: Array<Record<string, unknown>> }).items
      : [];

  return (
    <TravellerSection
      title="Application & appointment tracking"
      note="Track embassy appointments for this destination. Reminders are delivered via verified notifications."
      panel
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={createState.isLoading || !nationality || !/^[A-Z]{2}$/.test(destination)}
          onClick={async () => {
            setLocalMsg(null);
            try {
              await createApp({
                nationality: nationality!,
                destination,
                ...(category ? { category } : {}),
              }).unwrap();
              setLocalMsg("Application tracking case opened successfully.");
              refetch();
            } catch {
              setLocalMsg("Could not create application case. Please check inputs.");
            }
          }}
        >
          {createState.isLoading ? "Opening…" : `Open application for ${destination}`}
        </Button>
      </div>

      {isLoading ? <Spinner /> : null}

      {!items.length ? (
        <TravellerState title="No active applications">
          Open a tracking case above to record your VAC/consulate biometrics appointment and tracking number.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list mt-3">
          {items.map((raw) => {
            const a = raw as {
              id: string;
              destinationCode: string;
              nationalityCode: string;
              status: string;
              appointmentAt?: string | null;
              appointmentLocation?: string | null;
            };
            return (
              <li key={a.id} className="fo-traveller__row">
                <div className="flex items-center justify-between">
                  <p className="fo-traveller__row-title">
                    {a.nationalityCode} → {a.destinationCode} · {a.status}
                  </p>
                  <TravellerChip tone={a.appointmentAt ? "default" : "muted"}>
                    {a.appointmentAt ? "Appointment Set" : "Pending Booking"}
                  </TravellerChip>
                </div>
                <p className="fo-traveller__row-meta">
                  Appointment:{" "}
                  {a.appointmentAt ? new Date(a.appointmentAt).toLocaleString() : "Not scheduled"}
                  {a.appointmentLocation ? ` · Location: ${a.appointmentLocation}` : ""}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-fit"
                  onClick={() => {
                    setSelectedId(selectedId === a.id ? null : a.id);
                    if (a.appointmentAt) {
                      try {
                        setApptAt(new Date(a.appointmentAt).toISOString().slice(0, 16));
                      } catch {
                        setApptAt("");
                      }
                    }
                    if (a.appointmentLocation) {
                      setApptLoc(a.appointmentLocation);
                    }
                  }}
                >
                  {selectedId === a.id ? "Cancel edit" : "Update appointment"}
                </Button>
                {selectedId === a.id ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3">
                    <Input
                      label="Appointment date & time"
                      type="datetime-local"
                      value={apptAt}
                      onChange={(e) => setApptAt(e.target.value)}
                    />
                    <Input
                      label="Embassy / VAC Location"
                      value={apptLoc}
                      onChange={(e) => setApptLoc(e.target.value)}
                      placeholder="e.g. VFS Global / Embassy Center"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={updateState.isLoading}
                        onClick={async () => {
                          setLocalMsg(null);
                          try {
                            await updateApp({
                              id: a.id,
                              appointmentAt: apptAt ? new Date(apptAt).toISOString() : null,
                              appointmentLocation: apptLoc.trim() || null,
                            }).unwrap();
                            setLocalMsg("Appointment saved.");
                            setSelectedId(null);
                            refetch();
                          } catch {
                            setLocalMsg("Appointment update failed.");
                          }
                        }}
                      >
                        {updateState.isLoading ? "Saving…" : "Save appointment"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {localMsg ? <p className="text-[12px] text-ink-soft">{localMsg}</p> : null}
    </TravellerSection>
  );
}

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
      setEscalateMsg("Your request has been routed to our Visa Advisory Desk. A travel consultant will review your case.");
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
    <>
      <TravellerPageHeader
        title="Visa Advisory & Intelligence"
        lede={
          <>
            Attributed passport nationality × destination visa intelligence cross-referenced with your{" "}
            <Link href="/profile" className="underline underline-offset-2">Profile</Link> and{" "}
            <Link href="/vault" className="underline underline-offset-2">Travel Vault</Link>. Unverified
            or stale data is never presented as a travel guarantee.
          </>
        }
        meta={
          capability?.configured
            ? `Data source · ${capability.provider} (${capability.sourceKind})`
            : capability?.reasons?.[0] || "Visa rules database ready for advisory lookup."
        }
      />

      {/* Official Consular Disclaimer Banner */}
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs text-amber-900 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-none">⚠️</span>
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">Official Sovereign Immigration Notice</p>
            <p className="leading-relaxed text-amber-800/90">
              Visa, passport, and entry regulations are established by national immigration authorities and are subject to immediate revision. FlightOne provides advisory guidance based on cataloged bilateral rules and your travel documents. Always confirm entry conditions with the respective consulate or official visa center before departure.
            </p>
          </div>
        </div>
      </div>

      <TravellerSection title="Check Visa Requirements" panel>
        <form className="space-y-4" onSubmit={onAssess}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Destination Country (ISO2 code)"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="e.g. AE, TR, GB, US"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1 self-center">Popular:</span>
                {POPULAR_DESTINATIONS.slice(0, 6).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setDestination(c.code)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      destination === c.code
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Input
                label="Passport / Nationality (ISO2 code)"
                value={nationality}
                onChange={(e) => setNationality(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="e.g. PK, IN, US, GB"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1 self-center">Popular:</span>
                {POPULAR_NATIONALITIES.slice(0, 6).map((n) => (
                  <button
                    key={n.code}
                    type="button"
                    onClick={() => setNationality(n.code)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      nationality === n.code
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {n.code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <SearchableSelect
                label="Travel Purpose"
                options={PURPOSE_OPTIONS}
                value={purpose}
                onChange={(v) => setPurpose(String(v))}
                searchable={false}
              />
            </div>
            <div>
              <Input
                label="Departure Date (optional)"
                type="date"
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Return Date (optional)"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
          </div>

          <Input
            label="Transit Countries (optional, comma-separated ISO2)"
            value={transit}
            onChange={(e) => setTransit(e.target.value.toUpperCase())}
            placeholder="e.g. QA, TR, DE"
          />

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="sm" disabled={assessing || !capability?.canLookup}>
              {assessing ? "Evaluating rules…" : "Evaluate Visa Requirements"}
            </Button>
            <Link href="/chat">
              <Button type="button" size="sm" variant="ghost">
                Consult with Ava
              </Button>
            </Link>
          </div>
        </form>
        {error ? <p className="text-[13px] text-red-600 mt-2">{error}</p> : null}
      </TravellerSection>

      {assessment ? (
        <>
          <TravellerSection
            title="Evaluation Summary"
            actions={
              <div className="flex items-center gap-2">
                <CategoryBadge category={req?.category || assessment.requirement?.category} />
                {req ? (
                  <FactBadge isFact={Boolean(assessment.isFact)} dataStatus={req.dataStatus} />
                ) : (
                  <FactBadge isFact={false} dataStatus={assessment.status} />
                )}
              </div>
            }
          >
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs">
              <p className="text-[14px] font-medium leading-relaxed text-slate-900">
                {assessment.avaSummary}
              </p>
            </div>

            <dl className="fo-traveller__facts mt-4">
              <div className="fo-traveller__fact">
                <dt>Nationality</dt>
                <dd>{assessment.traveller?.nationality ?? nationality ?? "—"}</dd>
              </div>
              <div className="fo-traveller__fact">
                <dt>Destination</dt>
                <dd>{destination}</dd>
              </div>
              <div className="fo-traveller__fact">
                <dt>Passport on file</dt>
                <dd>{assessment.traveller?.hasPassport ? "Verified in Vault" : "Not uploaded"}</dd>
              </div>
              {req ? (
                <>
                  <div className="fo-traveller__fact">
                    <dt>Requirement Category</dt>
                    <dd>{req.category}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Data Confidence</dt>
                    <dd>{req.dataStatus}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Authority / Source</dt>
                    <dd className="truncate">{req.source ?? "Consular Database"}</dd>
                  </div>
                  {req.lastVerifiedAt ? (
                    <div className="fo-traveller__fact">
                      <dt>Last verified</dt>
                      <dd>{new Date(req.lastVerifiedAt).toLocaleDateString()}</dd>
                    </div>
                  ) : null}
                  {req.processingDaysMin != null || req.processingDaysMax != null ? (
                    <div className="fo-traveller__fact">
                      <dt>Processing Timeline</dt>
                      <dd>
                        {req.processingDaysMin ?? "?"}–{req.processingDaysMax ?? "?"} business days
                      </dd>
                    </div>
                  ) : null}
                  {assessment.traveller?.passportExpiry ? (
                    <div className="fo-traveller__fact">
                      <dt>Passport Expiry</dt>
                      <dd>
                        {new Date(assessment.traveller.passportExpiry).toLocaleDateString()}
                        {assessment.traveller.passportExpiryStatus
                          ? ` (${assessment.traveller.passportExpiryStatus})`
                          : ""}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
              {assessment.missingInputs?.length ? (
                <div className="fo-traveller__fact">
                  <dt>Additional Inputs Required</dt>
                  <dd>{assessment.missingInputs.join(", ")}</dd>
                </div>
              ) : null}
            </dl>

            {!assessment.isFact ? (
              <div className="fo-traveller__panel fo-traveller__panel--warn mt-3">
                <p className="text-[12px] text-ink-soft">
                  This assessment is guidance based on general catalog parameters. Do not treat unverified or advisory data as an official travel guarantee.
                </p>
              </div>
            ) : null}
          </TravellerSection>

          {/* Transit Countries Section */}
          {Array.isArray(req?.transit) && req.transit.length > 0 ? (
            <TravellerSection title="Transit & Layover Regulations">
              <ul className="fo-traveller__list">
                {req.transit.map((t) => (
                  <li key={t.destinationCode} className="fo-traveller__row">
                    <div className="flex items-center justify-between">
                      <p className="fo-traveller__row-title">
                        Transit through {t.destinationCode}
                      </p>
                      <CategoryBadge category={t.category} />
                    </div>
                    <p className="fo-traveller__row-body">
                      {t.transitGuidance?.notes ||
                        t.transitNotes ||
                        "Standard airside transit permissible without visa if remaining inside international transit area under 24 hours."}
                    </p>
                    <p className="fo-traveller__row-meta">
                      {t.transitGuidance?.note ||
                        "Subject to operating terminal and airline baggage interlining rules."}
                    </p>
                  </li>
                ))}
              </ul>
            </TravellerSection>
          ) : null}

          {/* Embassy / Consular Section */}
          {req?.embassyInfo && typeof req.embassyInfo === "object" ? (
            <TravellerSection title="Embassy & Visa Application Center">
              <dl className="fo-traveller__facts">
                {Object.entries(req.embassyInfo as Record<string, unknown>).map(([k, v]) =>
                  v == null || v === "" ? null : (
                    <div key={k} className="fo-traveller__fact">
                      <dt className="capitalize">{k.replaceAll(/([A-Z])/g, " $1")}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ),
                )}
              </dl>
            </TravellerSection>
          ) : null}

          {/* Required Documents Section */}
          {Array.isArray(req?.requiredDocuments) && req.requiredDocuments.length > 0 ? (
            <TravellerSection title="Standard Required Documents">
              <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-slate-700">
                {(req.requiredDocuments as unknown[]).map((d, i) => (
                  <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
                ))}
              </ul>
            </TravellerSection>
          ) : null}

          {/* Held Visas in Profile/Vault */}
          {assessment.heldVisa && typeof assessment.heldVisa === "object" ? (
            <TravellerSection title="Visas on File (Travel Vault)">
              {(() => {
                const hv = assessment.heldVisa as {
                  hasMatchingVisaOnFile?: boolean;
                  expiresAt?: string | null;
                  expiryStatus?: string | null;
                  note?: string | null;
                };
                return (
                  <dl className="fo-traveller__facts">
                    <div className="fo-traveller__fact">
                      <dt>Matching visa in Vault</dt>
                      <dd>{hv.hasMatchingVisaOnFile ? "Found on record" : "None on record"}</dd>
                    </div>
                    {hv.expiresAt ? (
                      <div className="fo-traveller__fact">
                        <dt>Valid Until</dt>
                        <dd>
                          {new Date(hv.expiresAt).toLocaleDateString()}
                          {hv.expiryStatus ? ` (${hv.expiryStatus})` : ""}
                        </dd>
                      </div>
                    ) : null}
                    {hv.note ? <p className="fo-traveller__section-note">{hv.note}</p> : null}
                  </dl>
                );
              })()}
            </TravellerSection>
          ) : null}

          {/* Document Checklist */}
          <TravellerSection title="Traveller Document Checklist">
            <ChecklistBlock checklist={assessment.checklist} />
          </TravellerSection>

          {/* Embassy Application Tracking */}
          <VisaApplicationsSection
            nationality={assessment.traveller?.nationality || nationality}
            destination={destination.trim().toUpperCase()}
            category={req?.category}
          />

          {/* Human Consultant Assistance Desk */}
          <TravellerSection title="Human Visa Specialist Support" panel>
            <div className="space-y-3">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Need end-to-end processing, appointment scheduling, document verification, or corporate delegation handling? Connect with our dedicated FlightOne visa consultants.
              </p>
              {escalateMsg ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                  ✓ {escalateMsg}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {isAuthenticated ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={escalating}
                      onClick={() => void onEscalate()}
                    >
                      {escalating ? "Connecting…" : "Request Visa Specialist Review"}
                    </Button>
                  ) : (
                    <Link href="/login?redirect=%2Fvisa">
                      <Button type="button" size="sm" variant="secondary">
                        Sign in for specialist review
                      </Button>
                    </Link>
                  )}
                  <Link href="/chat">
                    <Button type="button" size="sm" variant="ghost">
                      Open Ava Assistant Chat
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </TravellerSection>
        </>
      ) : null}
    </>
  );
}
