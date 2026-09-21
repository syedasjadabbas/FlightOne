"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  Car,
  ClipboardList,
  Handshake,
  MapPin,
  MessageCircle,
  Plane,
  QrCode,
  RefreshCw,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
import type { MiceTransferDirection, MiceTransferStatus } from "@/lib/api/mice.api";
import { useAuthStore } from "@/store/auth.store";

const TRANSFER_DIRECTION_OPTIONS = [
  { value: "AIRPORT_PICKUP", label: "Airport pickup" },
  { value: "AIRPORT_DROPOFF", label: "Airport drop-off" },
];

const EVENT_TYPE_LABEL: Record<string, string> = {
  MEETING: "Meeting",
  INCENTIVE: "Incentive",
  CONFERENCE: "Conference",
  EXHIBITION: "Exhibition",
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMinor(minor: unknown, currency?: unknown) {
  const n = typeof minor === "number" ? minor : Number(minor);
  if (!Number.isFinite(n)) return "—";
  const cur = typeof currency === "string" && currency ? currency : "";
  return `${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ""}`;
}

function labelize(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function transferChipTone(status: MiceTransferStatus | string): "ok" | "warn" | "danger" {
  if (status === "CONFIRMED") return "ok";
  if (status === "FAILED" || status === "DATA_UNAVAILABLE") return "danger";
  return "warn";
}

function DeskSection({
  title,
  icon: Icon,
  hint,
  children,
}: {
  title: string;
  icon: LucideIcon;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="fo-gm-section">
      <div className="fo-mice-event__section-head">
        <Icon size={15} strokeWidth={2} aria-hidden />
        <h2 className="fo-gm-section__title">{title}</h2>
      </div>
      {hint ? <p className="fo-gm-section__hint">{hint}</p> : null}
      {children}
    </section>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="fo-gm-empty">
      <span className="fo-mice-event__empty-icon" aria-hidden>
        <Icon size={16} strokeWidth={2} />
      </span>
      <p className="fo-gm-empty__title">{title}</p>
      <p className="fo-gm-empty__body">{body}</p>
    </div>
  );
}

function FactsBlock({
  entries,
}: {
  entries: Array<{ label: string; value: ReactNode }>;
}) {
  if (entries.length === 0) return null;
  return (
    <dl className="fo-mice-event__facts">
      {entries.map((e) => (
        <div key={e.label} className="fo-mice-event__fact">
          <dt>{e.label}</dt>
          <dd>{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecordFacts({ data, prefer }: { data: Record<string, unknown>; prefer?: string[] }) {
  const keys = prefer?.length
    ? [...prefer.filter((k) => k in data), ...Object.keys(data).filter((k) => !prefer.includes(k))]
    : Object.keys(data);

  const entries = keys
    .filter((k) => data[k] != null && typeof data[k] !== "object")
    .map((k) => ({
      label: labelize(k),
      value: String(data[k]),
    }));

  const nested = keys.filter((k) => data[k] != null && typeof data[k] === "object");

  return (
    <>
      <FactsBlock entries={entries} />
      {nested.map((k) => {
        const val = data[k];
        if (Array.isArray(val)) {
          return (
            <div key={k} className="mt-2">
              <p className="fo-gm-subhead">{labelize(k)}</p>
              <p className="fo-gm-row__meta">{val.length ? val.map(String).join(" · ") : "—"}</p>
            </div>
          );
        }
        if (val && typeof val === "object") {
          const obj = val as Record<string, unknown>;
          return (
            <div key={k} className="mt-2">
              <p className="fo-gm-subhead">{labelize(k)}</p>
              <FactsBlock
                entries={Object.entries(obj)
                  .filter(([, v]) => v != null && typeof v !== "object")
                  .map(([nk, nv]) => ({ label: labelize(nk), value: String(nv) }))}
              />
            </div>
          );
        }
        return null;
      })}
    </>
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
  const [busy, setBusy] = useState<string | null>(null);

  const isManager = event?.myRole === "MANAGER";

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">Loading event desk</span>
      </div>
    );
  }
  if (!accessToken) {
    return (
      <div className="fo-gm-status">
        <p className="fo-gm-empty__title">Sign in required</p>
        <p className="fo-gm-empty__body">Open this event desk after you sign in.</p>
        <Link href={`/login?redirect=${encodeURIComponent(`/mice/${eventId}`)}`} className="fo-gm-link">
          Sign in
        </Link>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">Loading event</span>
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
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            icon={<RefreshCw size={14} strokeWidth={2} aria-hidden />}
            onClick={() => void refetch()}
          >
            Retry
          </Button>
          <Link href="/mice" className="fo-gm-link">
            Back to MICE
          </Link>
        </div>
      </div>
    );
  }

  const byStatus =
    attendance?.byRegistrationStatus &&
    typeof attendance.byRegistrationStatus === "object" &&
    !Array.isArray(attendance.byRegistrationStatus)
      ? (attendance.byRegistrationStatus as Record<string, unknown>)
      : null;

  const providerName =
    transferCapability?.provider ||
    (transfersPayload?.capability as { provider?: string } | undefined)?.provider ||
    null;
  const providerConfigured = Boolean(
    transferCapability?.configured ||
      (transfersPayload?.capability as { configured?: boolean } | undefined)?.configured,
  );
  const canBookLive = Boolean(
    transferCapability?.canBookLive ||
      (transfersPayload?.capability as { canBookLive?: boolean } | undefined)?.canBookLive,
  );

  const currency = event.currency || (budget?.currency as string | undefined) || null;

  return (
    <div className="fo-gm-page fo-mice-event">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <Link href="/mice" className="fo-gm-back">
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            MICE
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <p className="fo-gm-kicker">Event desk</p>
            <span className="fo-mice-event__chip">{EVENT_TYPE_LABEL[event.type] || event.type}</span>
            {isManager ? (
              <span className="fo-mice-event__chip fo-mice-event__chip--role">Manager</span>
            ) : null}
          </div>
          <h1 className="fo-gm-title">{event.name}</h1>
          <p className="fo-gm-meta">
            <span className="fo-mice-event__meta-item">
              <MapPin size={13} strokeWidth={2} aria-hidden />
              {event.venue || "Venue TBA"}
            </span>
            <span className="fo-mice-event__meta-item">
              <Calendar size={13} strokeWidth={2} aria-hidden />
              {formatWhen(event.startsAt)}
              {event.endsAt ? ` – ${formatWhen(event.endsAt)}` : ""}
            </span>
          </p>
          {msg ? (
            <p className="fo-gm-msg" role="status">
              {msg}
            </p>
          ) : null}
        </div>
      </header>

      {!isManager ? (
        <div className="fo-mice-event__register">
          <p className="fo-mice-event__register-copy">
            Register yourself as a delegate for this event. Your badge unlocks once registration is
            confirmed.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy === "selfReg"}
            icon={<UserPlus size={14} strokeWidth={2} aria-hidden />}
            onClick={async () => {
              setBusy("selfReg");
              try {
                await selfReg(eventId).unwrap();
                setMsg("You are registered.");
              } catch {
                setMsg("Registration failed or already registered.");
              } finally {
                setBusy(null);
              }
            }}
          >
            Register myself
          </Button>
        </div>
      ) : null}

      <div className="fo-gm-ledger">
        <DeskSection title="Delegates" icon={Users}>
          {(delegates || []).length === 0 ? (
            <EmptyBlock
              icon={Users}
              title="No delegates yet"
              body="Managers add people here; attendees can register themselves when invited."
            />
          ) : (
            <ul className="fo-gm-list">
              {(delegates || []).map((d) => (
                <li key={String(d.id)} className="fo-gm-inline">
                  <span>
                    {String(d.fullName)}
                    <span className="fo-gm-inline__muted"> · {String(d.registrationStatus)}</span>
                  </span>
                  {d.badgeCode ? (
                    <button
                      type="button"
                      className="fo-gm-link inline-flex items-center gap-1"
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
                      <BadgeCheck size={13} strokeWidth={2} aria-hidden />
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
                disabled={busy === "register" || !fullName.trim() || !email.trim()}
                onClick={async () => {
                  setBusy("register");
                  try {
                    await register({ eventId, fullName, email }).unwrap();
                    setFullName("");
                    setEmail("");
                    setMsg("Delegate added.");
                  } catch {
                    setMsg("Could not add delegate.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Add delegate
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Agenda" icon={ClipboardList}>
          {(sessions || []).length === 0 ? (
            <EmptyBlock
              icon={ClipboardList}
              title="No sessions yet"
              body="Add agenda blocks with start and end times."
            />
          ) : (
            <ul className="fo-gm-list">
              {(sessions || []).map((s) => (
                <li key={String(s.id)} className="fo-gm-item">
                  <p className="fo-gm-row__title">{String(s.title)}</p>
                  <p className="fo-gm-row__meta">
                    {s.speakers ? `${String(s.speakers)} · ` : ""}
                    {formatWhen(String(s.startsAt))}
                    {s.endsAt ? ` – ${formatWhen(String(s.endsAt))}` : ""}
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
              <div className="fo-gm-form fo-gm-form--row">
                <Input
                  label="Starts"
                  type="datetime-local"
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                />
                <Input
                  label="Ends"
                  type="datetime-local"
                  value={sessionEnd}
                  onChange={(e) => setSessionEnd(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy === "session" || !sessionTitle.trim() || !sessionStart || !sessionEnd}
                onClick={async () => {
                  setBusy("session");
                  try {
                    await createSession({
                      eventId,
                      title: sessionTitle,
                      startsAt: new Date(sessionStart).toISOString(),
                      endsAt: new Date(sessionEnd).toISOString(),
                    }).unwrap();
                    setSessionTitle("");
                    setSessionStart("");
                    setSessionEnd("");
                    setMsg("Session added.");
                  } catch {
                    setMsg("Could not add session.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Add session
              </Button>
            </div>
          ) : null}
        </DeskSection>

        {isManager ? (
          <DeskSection title="QR check-in" icon={QrCode} hint="Scan or type the badge code at the door.">
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Badge code"
                value={badgeCode}
                onChange={(e) => setBadgeCode(e.target.value.toUpperCase())}
              />
              <Button
                type="button"
                size="sm"
                disabled={busy === "checkin" || !badgeCode.trim()}
                onClick={async () => {
                  setBusy("checkin");
                  try {
                    await checkIn({ eventId, badgeCode }).unwrap();
                    setMsg("Check-in recorded.");
                    setBadgeCode("");
                  } catch {
                    setMsg("Invalid badge or unauthorized.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Check in
              </Button>
            </div>
          </DeskSection>
        ) : null}

        <DeskSection title="Attendance" icon={BadgeCheck}>
          <FactsBlock
            entries={[
              {
                label: "Delegates",
                value: String(attendance?.totalDelegates ?? "—"),
              },
              {
                label: "Scope",
                value: String(attendance?.scope ?? "—"),
              },
            ]}
          />
          {byStatus && Object.keys(byStatus).length > 0 ? (
            <ul className="fo-mice-event__status-list" aria-label="By registration status">
              {Object.entries(byStatus).map(([status, count]) => (
                <li key={status}>
                  <span>{labelize(status)}</span>
                  <span>{String(count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fo-gm-row__meta mt-1">No registration breakdown yet.</p>
          )}
        </DeskSection>

        <DeskSection
          title="Flights & hotels"
          icon={Plane}
          hint="Links real bookings only — never invents inventory."
        >
          {(travel?.items || []).length === 0 ? (
            <EmptyBlock
              icon={Plane}
              title="No linked bookings"
              body="Managers can link an existing booking ID to this event."
            />
          ) : (
            <ul className="fo-gm-list">
              {(travel?.items || []).map((t) => {
                const booking = t.booking as
                  | { status?: string; amountMinor?: number; currency?: string }
                  | undefined;
                return (
                  <li key={String(t.shareId)} className="fo-gm-item">
                    <p className="fo-gm-row__title">{String(t.kind)}</p>
                    <p className="fo-gm-row__meta">
                      {String(booking?.status ?? "—")}
                      {booking?.amountMinor != null
                        ? ` · ${formatMinor(booking.amountMinor, booking.currency)}`
                        : ""}
                    </p>
                  </li>
                );
              })}
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
                disabled={busy === "link" || !bookingId.trim()}
                onClick={async () => {
                  setBusy("link");
                  try {
                    await linkBooking({ eventId, bookingId }).unwrap();
                    setBookingId("");
                    setMsg("Booking linked.");
                  } catch {
                    setMsg("Could not link booking.");
                  } finally {
                    setBusy(null);
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
          icon={Car}
          hint="Requirements are stored on the event. Live booking only when a transfer provider is configured."
        >
          <p className="fo-mice-event__provider">
            <span
              className={`fo-mice-event__chip fo-mice-event__chip--${providerConfigured ? "ok" : "warn"}`}
            >
              {providerConfigured ? "Provider ready" : "Provider unset"}
            </span>
            <span>{providerName || "No provider"}</span>
            <span>{canBookLive ? "Live book available" : "Live book unavailable"}</span>
          </p>
          {transfers.length === 0 ? (
            <EmptyBlock
              icon={Car}
              title="No transfer requirements yet"
              body="Capture airport pickup or drop-off needs for delegates here."
            />
          ) : (
            <ul className="fo-gm-list">
              {transfers.map((t) => (
                <li key={t.id} className="fo-gm-item">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="fo-gm-row__title mb-0">{t.label}</p>
                    <span
                      className={`fo-mice-event__chip fo-mice-event__chip--${transferChipTone(t.status)}`}
                    >
                      {t.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="fo-gm-row__meta">
                    {t.direction.replaceAll("_", " ").toLowerCase()}
                    {t.airportCode ? ` · ${t.airportCode}` : ""}
                    {` · ${t.passengerCount} pax`}
                    {t.pickupLocation ? ` · from ${t.pickupLocation}` : ""}
                    {t.dropoffLocation ? ` · to ${t.dropoffLocation}` : ""}
                    {t.pickupAt ? ` · ${formatWhen(String(t.pickupAt))}` : ""}
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
                      Live: {String(t.liveTransferStatus.dataStatus)}
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
                      disabled={busy === `book-${t.id}`}
                      onClick={async () => {
                        setBusy(`book-${t.id}`);
                        try {
                          const r = await bookTransfer({ eventId, transferId: t.id }).unwrap();
                          setMsg(
                            `Transfer book → ${r.status}${r.providerReason ? `: ${r.providerReason}` : ""}`,
                          );
                        } catch {
                          setMsg("Transfer booking attempt failed.");
                        } finally {
                          setBusy(null);
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
                  className="min-w-48"
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
                  disabled={busy === "transfer" || !transferLabel.trim()}
                  onClick={async () => {
                    if (!transferLabel.trim()) {
                      setMsg("Transfer label required.");
                      return;
                    }
                    setBusy("transfer");
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
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Add transfer requirement
                </Button>
              </div>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Budget" icon={Wallet}>
          <FactsBlock
            entries={[
              {
                label: "Ceiling",
                value: formatMinor(budget?.budgetCeilingMinor, currency),
              },
              {
                label: "Travel actual",
                value: formatMinor(budget?.travelActualMinor, currency),
              },
              {
                label: "Actual total",
                value: formatMinor(budget?.actualTotalMinor, currency),
              },
            ]}
          />
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
                disabled={busy === "budget" || !budgetLabel.trim()}
                onClick={async () => {
                  setBusy("budget");
                  try {
                    await saveBudget({
                      eventId,
                      category: "OTHER",
                      label: budgetLabel,
                      plannedMinor: Number(budgetAmt) || 0,
                    }).unwrap();
                    setBudgetLabel("");
                    setBudgetAmt("");
                    setMsg("Budget line saved.");
                  } catch {
                    setMsg("Could not save budget line.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Add line
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Sponsors" icon={Handshake}>
          {(sponsors || []).length === 0 ? (
            <EmptyBlock
              icon={Handshake}
              title="No sponsors listed"
              body="Add partner names when the event has sponsorships."
            />
          ) : (
            <ul className="fo-gm-list">
              {(sponsors || []).map((s) => (
                <li key={String(s.id)} className="fo-gm-item">
                  <p className="fo-gm-row__title">{String(s.name)}</p>
                  {s.tier ? <p className="fo-gm-row__meta">{String(s.tier)}</p> : null}
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
                disabled={busy === "sponsor" || !sponsorName.trim()}
                onClick={async () => {
                  setBusy("sponsor");
                  try {
                    await createSponsor({ eventId, name: sponsorName }).unwrap();
                    setSponsorName("");
                    setMsg("Sponsor added.");
                  } catch {
                    setMsg("Could not add sponsor.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Add sponsor
              </Button>
            </div>
          ) : null}
        </DeskSection>

        {isManager && report ? (
          <DeskSection title="Event report" icon={Building2}>
            <RecordFacts
              data={report}
              prefer={["eventId", "name", "type", "delegateCount", "sessionCount", "status"]}
            />
          </DeskSection>
        ) : null}
      </div>

      <p className="fo-gm-footer fo-mice-event__footer">
        <MessageCircle size={13} strokeWidth={2} aria-hidden />
        <span>
          Ask Ava about this event in{" "}
          <Link href="/chat" className="fo-gm-link">
            chat
          </Link>
          .
        </span>
      </p>
    </div>
  );
}
