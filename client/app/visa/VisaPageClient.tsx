"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
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

function ChecklistBlock({ checklist }: { checklist: VisaAssessment["checklist"] }) {
  if (!checklist || typeof checklist !== "object") return null;
  const c = checklist as {
    items?: Array<{ item: string; presentHint?: boolean; matchHint?: string | null }>;
    missingCount?: number;
    note?: string;
  };
  if (!c.items?.length) {
    return <p className="text-[13px] text-ink-faint">{c.note || "No checklist on file."}</p>;
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
              {item.presentHint ? "Profile/Vault hint: present" : "Profile/Vault hint: not found"}
              {item.matchHint ? ` — ${item.matchHint}` : ""}
            </p>
            <p className="fo-traveller__row-meta">Not a legal determination of sufficiency.</p>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-faint">{c.note}</p>
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
        title="Appointment tracking"
        note="Track embassy appointments and document requirements."
        panel
      >
        <p className="text-[13px] text-ink-soft">
          Sign in to save and manage your embassy appointments and visa tracking.
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
      title="Appointment tracking"
      note="Track embassy appointments for this destination. Expiry reminders are delivered via notifications — not invented on this page."
      panel
    >
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
            setLocalMsg("Application opened.");
            refetch();
          } catch {
            setLocalMsg("Could not create application.");
          }
        }}
      >
        Open application for {destination}
      </Button>
      {isLoading ? <Spinner /> : null}
      {!items.length ? (
        <TravellerState title="No applications yet">
          Open an application to track an embassy appointment.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
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
                <p className="fo-traveller__row-title">
                  {a.nationalityCode} → {a.destinationCode} · {a.status}
                </p>
                <p className="fo-traveller__row-meta">
                  Appointment:{" "}
                  {a.appointmentAt ? new Date(a.appointmentAt).toLocaleString() : "not set"}
                  {a.appointmentLocation ? ` · ${a.appointmentLocation}` : ""}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-fit"
                  onClick={() => setSelectedId(a.id)}
                >
                  Update appointment
                </Button>
                {selectedId === a.id ? (
                  <div className="mt-2 space-y-2">
                    <Input
                      label="Appointment date/time"
                      type="datetime-local"
                      value={apptAt}
                      onChange={(e) => setApptAt(e.target.value)}
                    />
                    <Input
                      label="Location"
                      value={apptLoc}
                      onChange={(e) => setApptLoc(e.target.value)}
                      placeholder="Embassy / VAC"
                    />
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
                          setLocalMsg("Appointment updated.");
                          setSelectedId(null);
                          refetch();
                        } catch {
                          setLocalMsg("Appointment update failed.");
                        }
                      }}
                    >
                      Save appointment
                    </Button>
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
  const [purpose, setPurpose] = useState("");
  const [assessment, setAssessment] = useState<VisaAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: capability, isLoading: capLoading } = useGetVisaCapabilityQuery();
  const [assess, { isLoading: assessing }] = useAssessVisaMutation();
  const [escalate, { isLoading: escalating }] = useEscalateVisaMutation();

  async function onAssess(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAssessment(null);
    const dest = destination.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(dest)) {
      setError("Destination must be an ISO country code (e.g. AE, TR, GB).");
      return;
    }
    const nat = nationality.trim().toUpperCase();
    if (nat && !/^[A-Z]{2}$/.test(nat)) {
      setError("Nationality must be a 2-letter ISO country code (e.g. PK, US, GB).");
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
          : "Assessment failed",
      );
    }
  }

  async function onEscalate() {
    setError(null);
    try {
      await escalate({
        destination: destination.trim().toUpperCase(),
        reason: "Traveller requested human help from Visa page — confidence insufficient",
      }).unwrap();
    } catch {
      setError("Could not record escalation. Try again or contact support from Chat.");
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
        title="Visa check"
        lede={
          <>
            Attributed nationality × destination lookup using your{" "}
            <Link href="/profile">Profile</Link> and <Link href="/vault">Vault</Link>. Unverified
            or stale data is never shown as a guarantee.
          </>
        }
        meta={
          capability?.configured
            ? `Data source · ${capability.provider} (${capability.sourceKind})`
            : capability?.reasons?.[0] || "Visa data provider is unconfigured."
        }
      />

      <TravellerSection title="Assess" panel>
        <form className="space-y-2.5" onSubmit={onAssess}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Destination (ISO2)"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="AE"
            />
            <Input
              label="Passport / Nationality (ISO2)"
              value={nationality}
              onChange={(e) => setNationality(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="PK"
            />
          </div>
          <Input
            label="Transit countries (optional, comma-separated ISO2)"
            value={transit}
            onChange={(e) => setTransit(e.target.value.toUpperCase())}
            placeholder="TR,DE"
          />
          <Input
            label="Travel purpose (optional)"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="tourism"
          />
          <Button type="submit" size="sm" disabled={assessing || !capability?.canLookup}>
            {assessing ? "Checking…" : "Check requirements"}
          </Button>
        </form>
        {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}
      </TravellerSection>

      {assessment ? (
        <>
          <TravellerSection
            title="Result"
            actions={
              req ? (
                <FactBadge isFact={Boolean(assessment.isFact)} dataStatus={req.dataStatus} />
              ) : (
                <FactBadge isFact={false} dataStatus={assessment.status} />
              )
            }
          >
            <p className="text-[14px] text-ink">{assessment.avaSummary}</p>
            <dl className="fo-traveller__facts">
              <div className="fo-traveller__fact">
                <dt>Nationality</dt>
                <dd>{assessment.traveller?.nationality ?? "—"}</dd>
              </div>
              <div className="fo-traveller__fact">
                <dt>Passport on file</dt>
                <dd>{assessment.traveller?.hasPassport ? "Yes" : "No"}</dd>
              </div>
              {req ? (
                <>
                  <div className="fo-traveller__fact">
                    <dt>Category</dt>
                    <dd>{req.category}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Status</dt>
                    <dd>{req.dataStatus}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Source</dt>
                    <dd className="truncate">{req.source ?? "—"}</dd>
                  </div>
                  {req.lastVerifiedAt ? (
                    <div className="fo-traveller__fact">
                      <dt>Last verified</dt>
                      <dd>{new Date(req.lastVerifiedAt).toLocaleDateString()}</dd>
                    </div>
                  ) : null}
                  {req.confidenceNote ? (
                    <p className="fo-traveller__section-note">{req.confidenceNote}</p>
                  ) : null}
                  {req.processingDaysMin != null || req.processingDaysMax != null ? (
                    <div className="fo-traveller__fact">
                      <dt>Processing (attributed)</dt>
                      <dd>
                        {req.processingDaysMin ?? "?"}–{req.processingDaysMax ?? "?"} days
                      </dd>
                    </div>
                  ) : null}
                  {assessment.traveller?.passportExpiry ? (
                    <div className="fo-traveller__fact">
                      <dt>Passport expiry</dt>
                      <dd>
                        {new Date(assessment.traveller.passportExpiry).toLocaleDateString()}
                        {assessment.traveller.passportExpiryStatus
                          ? ` · ${assessment.traveller.passportExpiryStatus}`
                          : ""}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
              {assessment.missingInputs?.length ? (
                <div className="fo-traveller__fact">
                  <dt>Missing</dt>
                  <dd>{assessment.missingInputs.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            {!assessment.isFact ? (
              <div className="fo-traveller__panel fo-traveller__panel--warn">
                <p className="text-[12px] text-ink-soft">
                  This is not a confirmed visa eligibility result. Do not treat catalog guidance or
                  stale data as a travel guarantee.
                </p>
              </div>
            ) : null}
          </TravellerSection>

          {Array.isArray(req?.transit) && req.transit.length > 0 ? (
            <TravellerSection title="Transit (distinct from destination)">
              <ul className="fo-traveller__list">
                {req.transit.map((t) => (
                  <li key={t.destinationCode} className="fo-traveller__row">
                    <p className="fo-traveller__row-title">
                      {t.destinationCode} · {t.category} · {t.dataStatus}
                    </p>
                    <p className="fo-traveller__row-body">
                      {t.transitGuidance?.notes ||
                        t.transitNotes ||
                        "No attributed transit notes."}
                    </p>
                    <p className="fo-traveller__row-meta">
                      {t.transitGuidance?.note ||
                        "Airport/duration-specific rules need an external authority feed."}
                    </p>
                  </li>
                ))}
              </ul>
            </TravellerSection>
          ) : null}

          {req?.embassyInfo && typeof req.embassyInfo === "object" ? (
            <TravellerSection title="Embassy / consulate">
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

          {Array.isArray(req?.requiredDocuments) && req.requiredDocuments.length > 0 ? (
            <TravellerSection title="Required documents (catalog)">
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink">
                {(req.requiredDocuments as unknown[]).map((d, i) => (
                  <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
                ))}
              </ul>
            </TravellerSection>
          ) : null}

          {assessment.heldVisa && typeof assessment.heldVisa === "object" ? (
            <TravellerSection title="Held visas (from profile/vault)">
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
                      <dt>Matching visa on file</dt>
                      <dd>{hv.hasMatchingVisaOnFile ? "Yes" : "No"}</dd>
                    </div>
                    {hv.expiresAt ? (
                      <div className="fo-traveller__fact">
                        <dt>Expires</dt>
                        <dd>
                          {new Date(hv.expiresAt).toLocaleDateString()}
                          {hv.expiryStatus ? ` · ${hv.expiryStatus}` : ""}
                        </dd>
                      </div>
                    ) : null}
                    {hv.note ? <p className="fo-traveller__section-note">{hv.note}</p> : null}
                  </dl>
                );
              })()}
            </TravellerSection>
          ) : null}

          <TravellerSection title="Document checklist">
            <ChecklistBlock checklist={assessment.checklist} />
          </TravellerSection>

          <VisaApplicationsSection
            nationality={assessment.traveller?.nationality}
            destination={destination.trim().toUpperCase()}
            category={req?.category}
          />

          {assessment.escalateRecommended ? (
            <TravellerSection title="Human help" panel warn>
              <p className="text-[13px] text-ink-soft">
                This case cannot be confirmed from attributed data alone. Record a{" "}
                <code className="text-[12px]">VISA_UNCERTAIN</code> escalation intent, or continue in
                Chat with a consultant.
              </p>
              <div className="flex flex-wrap gap-2">
                {isAuthenticated ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={escalating}
                    onClick={() => void onEscalate()}
                  >
                    {escalating ? "Recording…" : "Request consultant review"}
                  </Button>
                ) : (
                  <Link href="/login?redirect=%2Fvisa">
                    <Button type="button" size="sm" variant="secondary">
                      Sign in for consultant review
                    </Button>
                  </Link>
                )}
                <Link href="/chat">
                  <Button type="button" size="sm" variant="ghost">
                    Open Chat
                  </Button>
                </Link>
              </div>
            </TravellerSection>
          ) : null}
        </>
      ) : null}
    </>
  );
}
