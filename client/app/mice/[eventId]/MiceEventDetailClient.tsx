"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import {
  useBookMiceTransferMutation,
  useCreateMiceSessionMutation,
  useCreateMiceSponsorMutation,
  useCreateMiceTransferMutation,
  useGetMiceAttendanceQuery,
  useGetMiceBudgetQuery,
  useGetMiceEventQuery,
  useGetMiceReportQuery,
  useGetMiceTransferCapabilityQuery,
  useLazyGetMiceBadgeQuery,
  useLinkMiceBookingMutation,
  useListMiceDelegatesQuery,
  useListMiceSessionsQuery,
  useListMiceSponsorsQuery,
  useListMiceTransfersQuery,
  useListMiceTravelQuery,
  useMiceCheckInMutation,
  useRegisterMiceDelegateMutation,
  useSaveMiceBudgetLineMutation,
  useSelfRegisterMiceMutation,
} from "@/lib/api/mice.api";
import type { MiceTransferDirection } from "@/lib/api/mice.api";
import { useAuthStore } from "@/store/auth.store";

const TRANSFER_DIRECTION_OPTIONS = [
  { value: "AIRPORT_PICKUP", label: "Airport pickup" },
  { value: "AIRPORT_DROPOFF", label: "Airport drop-off" },
];

function DeskSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="fo-gm-section">
      <h2 className="fo-gm-section__title">{title}</h2>
      {hint ? <p className="fo-gm-section__hint">{hint}</p> : null}
      {children}
    </section>
  );
}

export function MiceEventDetailClient({ eventId }: { eventId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data: event, isLoading, isError, error, refetch } = useGetMiceEventQuery(eventId, { skip });
  const { data: delegates } = useListMiceDelegatesQuery(eventId, { skip });
  const { data: sessions } = useListMiceSessionsQuery(eventId, { skip });
  const { data: attendance } = useGetMiceAttendanceQuery(eventId, { skip });
  const { data: travel } = useListMiceTravelQuery(eventId, { skip });
  const { data: transfersPayload } = useListMiceTransfersQuery(eventId, { skip });
  const { data: transferCapability } = useGetMiceTransferCapabilityQuery(undefined, { skip });
  const { data: budget } = useGetMiceBudgetQuery(eventId, { skip });
  const { data: sponsors } = useListMiceSponsorsQuery(eventId, { skip });
  const { data: report } = useGetMiceReportQuery(eventId, {
    skip: skip || event?.myRole !== "MANAGER",
  });

  const transfers = transfersPayload?.items || [];

  const [register] = useRegisterMiceDelegateMutation();
  const [selfReg] = useSelfRegisterMiceMutation();
  const [createSession] = useCreateMiceSessionMutation();
  const [checkIn] = useMiceCheckInMutation();
  const [linkBooking] = useLinkMiceBookingMutation();
  const [createTransfer] = useCreateMiceTransferMutation();
  const [bookTransfer] = useBookMiceTransferMutation();
  const [saveBudget] = useSaveMiceBudgetLineMutation();
  const [createSponsor] = useCreateMiceSponsorMutation();
  const [fetchBadge] = useLazyGetMiceBadgeQuery();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [badgeCode, setBadgeCode] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [transferLabel, setTransferLabel] = useState("");
  const [transferDirection, setTransferDirection] = useState<MiceTransferDirection>("AIRPORT_PICKUP");
  const [transferAirport, setTransferAirport] = useState("");
  const [transferPax, setTransferPax] = useState("1");
  const [transferPickup, setTransferPickup] = useState("");
  const [transferDropoff, setTransferDropoff] = useState("");
  const [transferFlightRef, setTransferFlightRef] = useState("");
  const [transferFlightBookingId, setTransferFlightBookingId] = useState("");
  const [transferDelegateId, setTransferDelegateId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [budgetLabel, setBudgetLabel] = useState("");
  const [budgetAmt, setBudgetAmt] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const isManager = event?.myRole === "MANAGER";

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!accessToken) {
    return (
      <div className="fo-gm-status">
        <Link href="/login" className="fo-gm-link">
          Log in
        </Link>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError || !event) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : null;
    return (
      <div className="fo-gm-status">
        <p className="fo-gm-msg fo-gm-msg--danger">
          {status === 403 ? "You don’t have access to this event." : "Could not load event."}
        </p>
        <Button type="button" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
        <Link href="/mice" className="fo-gm-link">
          Back to MICE
        </Link>
      </div>
    );
  }

  return (
    <div className="fo-gm-page">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <Link href="/mice" className="fo-gm-back">
            ← MICE
          </Link>
          <p className="fo-gm-kicker">Event desk</p>
          <h1 className="fo-gm-title">{event.name}</h1>
          <p className="fo-gm-meta">
            <span>{event.type}</span>
            <span>{event.venue || "Venue TBA"}</span>
            <span>{new Date(event.startsAt).toLocaleString()}</span>
          </p>
          {msg ? <p className="fo-gm-msg">{msg}</p> : null}
        </div>
      </header>

      {!isManager ? (
        <Button
          type="button"
          size="sm"
          onClick={async () => {
            try {
              await selfReg(eventId).unwrap();
              setMsg("You are registered.");
            } catch {
              setMsg("Registration failed or already registered.");
            }
          }}
        >
          Register myself
        </Button>
      ) : null}

      <div className="fo-gm-ledger">
        <DeskSection title="Delegates">
          {(delegates || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No delegates yet</p>
              <p className="fo-gm-empty__body">
                Managers add people here; attendees can register themselves when invited.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(delegates || []).map((d) => (
                <li key={String(d.id)} className="fo-gm-inline">
                  <span>
                    {String(d.fullName)} · {String(d.registrationStatus)}
                  </span>
                  {d.badgeCode ? (
                    <button
                      type="button"
                      className="fo-gm-link"
                      onClick={async () => {
                        try {
                          const badge = await fetchBadge({
                            eventId,
                            delegateId: String(d.id),
                          }).unwrap();
                          const bin = atob(badge.contentBase64);
                          const bytes = new Uint8Array(bin.length);
                          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
                          const blob = new Blob([bytes], { type: badge.contentType });
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank");
                        } catch {
                          setMsg("Badge download failed.");
                        }
                      }}
                    >
                      Badge
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isManager ? (
            <div className="fo-gm-form">
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await register({ eventId, fullName, email }).unwrap();
                  setFullName("");
                  setEmail("");
                }}
              >
                Add delegate
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Agenda">
          {(sessions || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No sessions yet</p>
              <p className="fo-gm-empty__body">Add agenda blocks with start and end times.</p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(sessions || []).map((s) => (
                <li key={String(s.id)} className="fo-gm-item">
                  <p className="fo-gm-row__title">{String(s.title)}</p>
                  <p className="fo-gm-row__meta">
                    {s.speakers ? `${String(s.speakers)} · ` : ""}
                    {new Date(String(s.startsAt)).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {isManager ? (
            <div className="fo-gm-form">
              <Input
                label="Session title"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
              />
              <Input
                label="Starts"
                value={sessionStart}
                onChange={(e) => setSessionStart(e.target.value)}
              />
              <Input label="Ends" value={sessionEnd} onChange={(e) => setSessionEnd(e.target.value)} />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await createSession({
                    eventId,
                    title: sessionTitle,
                    startsAt: new Date(sessionStart).toISOString(),
                    endsAt: new Date(sessionEnd).toISOString(),
                  }).unwrap();
                  setSessionTitle("");
                }}
              >
                Add session
              </Button>
            </div>
          ) : null}
        </DeskSection>

        {isManager ? (
          <DeskSection title="QR check-in">
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Badge code"
                value={badgeCode}
                onChange={(e) => setBadgeCode(e.target.value.toUpperCase())}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    await checkIn({ eventId, badgeCode }).unwrap();
                    setMsg("Check-in recorded.");
                    setBadgeCode("");
                  } catch {
                    setMsg("Invalid badge or unauthorized.");
                  }
                }}
              >
                Check in
              </Button>
            </div>
          </DeskSection>
        ) : null}

        <DeskSection title="Attendance">
          <p className="fo-gm-lede fo-gm-lede--flush">
            Delegates: {String(attendance?.totalDelegates ?? "—")} · Scope:{" "}
            {String(attendance?.scope ?? "—")}
          </p>
          <pre className="fo-gm-pre">
            {JSON.stringify(attendance?.byRegistrationStatus || {}, null, 2)}
          </pre>
        </DeskSection>

        <DeskSection
          title="Flights & hotels"
          hint="Links real Module 03 bookings only — never invents inventory."
        >
          {(travel?.items || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No linked bookings</p>
              <p className="fo-gm-empty__body">
                Managers can link an existing booking ID to this event.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(travel?.items || []).map((t) => (
                <li key={String(t.shareId)} className="fo-gm-item">
                  {String(t.kind)} · {String((t.booking as { status?: string })?.status)} ·{" "}
                  {String((t.booking as { amountMinor?: number })?.amountMinor)}{" "}
                  {String((t.booking as { currency?: string })?.currency)}
                </li>
              ))}
            </ul>
          )}
          {isManager ? (
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Booking ID"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    await linkBooking({ eventId, bookingId }).unwrap();
                    setBookingId("");
                  } catch {
                    setMsg("Could not link booking.");
                  }
                }}
              >
                Link booking
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection
          title="Transfers"
          hint={
            <>
              Requirements are stored on the event. Live booking only when{" "}
              <code className="fo-gm-code">MICE_TRANSFER_BOOK_PROVIDER</code> is configured —
              never invented.
            </>
          }
        >
          <p className="fo-gm-section__hint">
            Provider:{" "}
            {String(
              transferCapability?.provider ||
                (transfersPayload?.capability as { provider?: string } | undefined)?.provider ||
                "—",
            )}{" "}
            ·{" "}
            {transferCapability?.configured ||
            (transfersPayload?.capability as { configured?: boolean } | undefined)?.configured
              ? "configured"
              : "UNCONFIGURED"}
            {!(
              transferCapability?.canBookLive ||
              (transfersPayload?.capability as { canBookLive?: boolean } | undefined)?.canBookLive
            )
              ? " · live book unavailable"
              : " · live book available"}
          </p>
          {transfers.length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No transfer requirements yet</p>
              <p className="fo-gm-empty__body">
                Capture airport pickup or drop-off needs for delegates here.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {transfers.map((t) => (
                <li key={t.id} className="fo-gm-item">
                  <p className="fo-gm-row__title">
                    {t.label} · {t.direction} · {t.status}
                  </p>
                  <p className="fo-gm-row__meta">
                    {t.airportCode ? `${t.airportCode} · ` : ""}
                    {t.passengerCount} pax
                    {t.pickupLocation ? ` · from ${t.pickupLocation}` : ""}
                    {t.dropoffLocation ? ` · to ${t.dropoffLocation}` : ""}
                    {t.pickupAt ? ` · ${new Date(String(t.pickupAt)).toLocaleString()}` : ""}
                  </p>
                  {t.flightRef || t.flightLinkage ? (
                    <p className="fo-gm-row__meta">
                      Flight: {String(t.flightRef || t.flightLinkage?.flightNumber || "—")}
                      {t.flightLinkage?.liveFlightStatus
                        ? ` · live ${String(t.flightLinkage.liveFlightStatus)}`
                        : ""}
                    </p>
                  ) : null}
                  {t.providerReason ? (
                    <p className="fo-gm-row__meta">{t.providerReason}</p>
                  ) : null}
                  {t.transferRef ? (
                    <p className="fo-gm-row__meta">Confirmation: {t.transferRef}</p>
                  ) : null}
                  {t.liveTransferStatus ? (
                    <p className="fo-gm-row__meta">
                      Live transfer status: {String(t.liveTransferStatus.dataStatus)}
                      {t.liveTransferStatus.reason
                        ? ` — ${String(t.liveTransferStatus.reason)}`
                        : ""}
                    </p>
                  ) : null}
                  {isManager && t.status !== "CONFIRMED" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      onClick={async () => {
                        try {
                          const r = await bookTransfer({ eventId, transferId: t.id }).unwrap();
                          setMsg(
                            `Transfer book → ${r.status}${r.providerReason ? `: ${r.providerReason}` : ""}`,
                          );
                        } catch {
                          setMsg("Transfer booking attempt failed.");
                        }
                      }}
                    >
                      Retry provider book
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isManager ? (
            <div className="fo-gm-form">
              <div className="fo-gm-form fo-gm-form--row">
                <Input
                  label="Label"
                  value={transferLabel}
                  onChange={(e) => setTransferLabel(e.target.value)}
                />
                <SearchableSelect
                  label="Direction"
                  options={TRANSFER_DIRECTION_OPTIONS}
                  value={transferDirection}
                  onChange={(v) => setTransferDirection(v as MiceTransferDirection)}
                  searchable={false}
                />
                <Input
                  label="Airport"
                  value={transferAirport}
                  onChange={(e) => setTransferAirport(e.target.value.toUpperCase())}
                />
                <Input
                  label="Passengers"
                  value={transferPax}
                  onChange={(e) => setTransferPax(e.target.value.replace(/\D/g, "") || "1")}
                />
              </div>
              <div className="fo-gm-form fo-gm-form--row">
                <Input
                  label="Pickup location"
                  value={transferPickup}
                  onChange={(e) => setTransferPickup(e.target.value)}
                />
                <Input
                  label="Drop-off location"
                  value={transferDropoff}
                  onChange={(e) => setTransferDropoff(e.target.value)}
                />
                <Input
                  label="Flight ref"
                  value={transferFlightRef}
                  onChange={(e) => setTransferFlightRef(e.target.value)}
                />
                <Input
                  label="Flight booking ID"
                  value={transferFlightBookingId}
                  onChange={(e) => setTransferFlightBookingId(e.target.value)}
                />
              </div>
              <div className="fo-gm-form fo-gm-form--row">
                <SearchableSelect
                  className="min-w-[12rem]"
                  label="Delegate"
                  options={[
                    { value: "", label: "— none —" },
                    ...(delegates || []).map((d) => ({
                      value: String(d.id),
                      label: String(d.fullName),
                    })),
                  ]}
                  value={transferDelegateId}
                  onChange={setTransferDelegateId}
                  clearable
                />
                <Input
                  label="Notes"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    if (!transferLabel.trim()) {
                      setMsg("Transfer label required.");
                      return;
                    }
                    try {
                      const r = await createTransfer({
                        eventId,
                        label: transferLabel.trim(),
                        direction: transferDirection,
                        passengerCount: Number(transferPax) || 1,
                        airportCode: transferAirport.trim() || undefined,
                        pickupLocation: transferPickup.trim() || undefined,
                        dropoffLocation: transferDropoff.trim() || undefined,
                        flightRef: transferFlightRef.trim() || undefined,
                        flightBookingId: transferFlightBookingId.trim() || undefined,
                        delegateId: transferDelegateId || undefined,
                        notes: transferNotes.trim() || undefined,
                        idempotencyKey: `ui-${eventId}-${transferLabel.trim()}-${transferDirection}-${transferAirport}`,
                      }).unwrap();
                      setMsg(`Transfer saved · ${r.status}`);
                      setTransferLabel("");
                      setTransferNotes("");
                      setTransferFlightRef("");
                      setTransferFlightBookingId("");
                    } catch {
                      setMsg("Could not create transfer (check flight link / permissions).");
                    }
                  }}
                >
                  Add transfer requirement
                </Button>
              </div>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Budget">
          <p className="fo-gm-lede fo-gm-lede--flush">
            Ceiling: {String(budget?.budgetCeilingMinor ?? "—")} · Travel actual:{" "}
            {String(budget?.travelActualMinor ?? "—")} · Actual total:{" "}
            {String(budget?.actualTotalMinor ?? "—")}
          </p>
          {isManager ? (
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Line label"
                value={budgetLabel}
                onChange={(e) => setBudgetLabel(e.target.value)}
              />
              <Input
                label="Planned minor"
                value={budgetAmt}
                onChange={(e) => setBudgetAmt(e.target.value.replace(/\D/g, ""))}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await saveBudget({
                    eventId,
                    category: "OTHER",
                    label: budgetLabel,
                    plannedMinor: Number(budgetAmt) || 0,
                  }).unwrap();
                  setBudgetLabel("");
                }}
              >
                Add line
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Sponsors">
          {(sponsors || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No sponsors listed</p>
              <p className="fo-gm-empty__body">Add partner names when the event has sponsorships.</p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(sponsors || []).map((s) => (
                <li key={String(s.id)} className="fo-gm-item">
                  {String(s.name)}
                  {s.tier ? ` · ${String(s.tier)}` : ""}
                </li>
              ))}
            </ul>
          )}
          {isManager ? (
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Sponsor"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await createSponsor({ eventId, name: sponsorName }).unwrap();
                  setSponsorName("");
                }}
              >
                Add sponsor
              </Button>
            </div>
          ) : null}
        </DeskSection>

        {isManager && report ? (
          <DeskSection title="Event report">
            <pre className="fo-gm-pre">{JSON.stringify(report, null, 2)}</pre>
          </DeskSection>
        ) : null}
      </div>

      <p className="fo-gm-footer">
        Ask Ava about this event in{" "}
        <Link href="/chat" className="fo-gm-link">
          chat
        </Link>
        .
      </p>
    </div>
  );
}
