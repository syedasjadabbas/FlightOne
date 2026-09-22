"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Users,
} from "lucide-react";
import { Button, Input, SearchableSelect, Spinner, buttonClassName } from "@/components/ui";
import "./mice.css";
import {
  useCancelMiceEnquiryMutation,
  useCreateMiceEnquiryMutation,
  useCreateMiceEventMutation,
  useListMiceEnquiriesQuery,
  useListMiceEventsQuery,
  useUpdateMiceEnquiryMutation,
  type MiceEventType,
} from "@/lib/api/mice.api";
import { useAuthStore } from "@/store/auth.store";
import { MiceRequirementToggles } from "./_components/MiceRequirementToggles";
import { MiceStatusChip } from "./_components/MiceStatusChip";

const TYPE_OPTIONS = [
  { value: "CONFERENCE", label: "Conference" },
  { value: "INCENTIVE", label: "Incentive" },
  { value: "MEETING", label: "Meeting" },
  { value: "EXHIBITION", label: "Exhibition" },
];

const CURRENCY_OPTIONS = [
  { value: "PKR", label: "PKR" },
  { value: "USD", label: "USD" },
  { value: "AED", label: "AED" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "SAR", label: "SAR" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function MicePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const skip = !hasHydrated || !accessToken;

  const { data, isLoading, isError, refetch } = useListMiceEventsQuery(undefined, { skip });
  const {
    data: enquiriesData,
    isLoading: enquiriesLoading,
    isError: enquiriesError,
    refetch: refetchEnquiries,
  } = useListMiceEnquiriesQuery(undefined, { skip });
  const [createEvent, createState] = useCreateMiceEventMutation();
  const [createEnquiry, enquiryState] = useCreateMiceEnquiryMutation();
  const [cancelEnquiry, cancelState] = useCancelMiceEnquiryMutation();
  const [updateEnquiry, updateState] = useUpdateMiceEnquiryMutation();
  const [enquiryIdempotencyKey, setEnquiryIdempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mice-enq-${Date.now()}`,
  );
  const [editNotes, setEditNotes] = useState("");
  const [editAttendees, setEditAttendees] = useState("");

  const [activeTab, setActiveTab] = useState<"enquiry" | "events">("enquiry");
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<MiceEventType>("CONFERENCE");
  const [organization, setOrganization] = useState("");
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [travelStartsAt, setTravelStartsAt] = useState("");
  const [travelEndsAt, setTravelEndsAt] = useState("");
  const [delegateCount, setDelegateCount] = useState("1");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [reqFlights, setReqFlights] = useState(false);
  const [reqHotels, setReqHotels] = useState(false);
  const [reqTransfers, setReqTransfers] = useState(false);
  const [reqConferenceHalls, setReqConferenceHalls] = useState(false);
  const [reqCatering, setReqCatering] = useState(false);
  const [reqVisas, setReqVisas] = useState(false);
  const [accommodationNotes, setAccommodationNotes] = useState("");
  const [transportNotes, setTransportNotes] = useState("");
  const [flightNotes, setFlightNotes] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  const [quickName, setQuickName] = useState("");
  const [quickType, setQuickType] = useState<MiceEventType>("MEETING");
  const [quickStart, setQuickStart] = useState("");
  const [quickEnd, setQuickEnd] = useState("");
  const [quickMsg, setQuickMsg] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <div className="fo-mice__boot" role="status" aria-live="polite">
        <Spinner label="Loading MICE…" />
        <p className="fo-mice__boot-label">Loading MICE desk</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-mice__gate">
        <div className="fo-mice__gate-box">
          <div className="fo-mice__gate-icon" aria-hidden>
            <Lock size={22} strokeWidth={2} />
          </div>
          <h2 className="fo-mice__gate-title">Authentication Required</h2>
          <p className="fo-mice__gate-desc">
            Sign in to submit a meetings, incentives, conferences, or exhibitions enquiry. The desk
            reviews requests manually — nothing is held or ticketed until a supplier confirms it.
          </p>
          <Link href="/login?redirect=%2Fmice" className={buttonClassName({ size: "md" })}>
            Sign In to FlightOne
          </Link>
        </div>
      </div>
    );
  }

  const eventsList = data || [];
  const enquiries = enquiriesData?.items || [];
  const selected = enquiries.find((r) => r.id === selectedEnquiryId) || null;

  async function handleEnquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setFormSuccess(null);
    setCreatedEventId(null);

    const count = parseInt(delegateCount, 10);
    if (!name.trim() || !destination.trim() || !startsAt || !endsAt) {
      setMsg("Event name, destination, start, and end are required.");
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setMsg("Attendee count must be at least 1.");
      return;
    }
    const email = contactEmail.trim() || user?.email || "";
    const cName = contactName.trim() || user?.name || "";
    if (!email || !cName) {
      setMsg("Contact name and email are required.");
      return;
    }

    try {
      const created = await createEnquiry({
        name: name.trim(),
        type,
        organization: organization.trim() || undefined,
        destination: destination.trim(),
        origin: origin.trim() || undefined,
        venue: venue.trim() || undefined,
        eventStartsAt: new Date(startsAt).toISOString(),
        eventEndsAt: new Date(endsAt).toISOString(),
        travelStartsAt: travelStartsAt ? new Date(travelStartsAt).toISOString() : undefined,
        travelEndsAt: travelEndsAt ? new Date(travelEndsAt).toISOString() : undefined,
        attendeeCount: count,
        budgetMinor: budget ? Math.round(Number(budget) * 100) : undefined,
        currency,
        contactName: cName,
        contactEmail: email,
        contactPhone: contactPhone.trim() || undefined,
        flightsRequired: reqFlights,
        hotelsRequired: reqHotels,
        transfersRequired: reqTransfers,
        meetingSpaceRequired: reqConferenceHalls,
        cateringRequired: reqCatering,
        visaAssistanceRequired: reqVisas,
        accommodationNotes: accommodationNotes.trim() || undefined,
        transportNotes: transportNotes.trim() || undefined,
        flightNotes: flightNotes.trim() || undefined,
        meetingNotes: meetingNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: enquiryIdempotencyKey,
      }).unwrap();

      setFormSuccess(
        `Enquiry submitted for “${created.name}”. Status: ${created.status}. No venues, flights, or hotels have been confirmed.`,
      );
      setSelectedEnquiryId(created.id);
      setCreatedEventId(created.eventId || created.event?.id || null);
      setName("");
      setNotes("");
      setEnquiryIdempotencyKey(
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `mice-enq-${Date.now()}`,
      );
      void refetchEnquiries();
      void refetch();
    } catch {
      setMsg("Could not submit the enquiry. Check dates and required fields.");
    }
  }

  return (
    <div className="fo-mice__master-stage">
      <div className="fo-mice__nav-rail">
        <span className="fo-mice__brand-badge">
          <span className="fo-mice__brand-dot" aria-hidden />
          MICE
        </span>
        <div className="fo-mice__tabs" role="tablist" aria-label="MICE sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "enquiry"}
            className={`fo-mice__tab${activeTab === "enquiry" ? " fo-mice__tab--active" : ""}`}
            onClick={() => setActiveTab("enquiry")}
          >
            Enquiry
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "events"}
            className={`fo-mice__tab${activeTab === "events" ? " fo-mice__tab--active" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            Events ({eventsList.length})
          </button>
        </div>
      </div>

      <header className="fo-mice__hero">
        <h1 className="fo-mice__title">MICE desk</h1>
        <p className="fo-mice__lede">
          Enquiries are reviewed by the MICE desk. This is not automated event ticketing.
        </p>
      </header>

      <div className="fo-gm-page">
      {activeTab === "enquiry" ? (
        <div className="space-y-5">
          <section className="fo-gm-ledger">
            <div className="fo-gm-section">
              <h2 className="fo-gm-section__title">Event enquiry</h2>
              <p className="fo-gm-section__hint">
                Submitting creates a desk request and, when possible, a workspace. Inventory is not
                held until a supplier confirms it.
              </p>

              {formSuccess ? (
                <div className="fo-gm-success" role="status">
                  <p className="fo-gm-success__title">{formSuccess}</p>
                  <div className="fo-gm-success__actions">
                    {createdEventId ? (
                      <Link href={`/mice/${createdEventId}`}>
                        <Button size="sm" icon={<ChevronRight size={14} strokeWidth={2} />}>
                          Open workspace
                        </Button>
                      </Link>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setFormSuccess(null)}>
                      Submit another
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="fo-gm-form" onSubmit={handleEnquirySubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Event name *"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <SearchableSelect
                      label="Event type"
                      options={TYPE_OPTIONS}
                      value={type}
                      onChange={(v) => setType(v as MiceEventType)}
                      searchable={false}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Organization / company"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                    <Input
                      label="Destination *"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      required
                    />
                    <Input
                      label="Origin (optional)"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Venue (optional)"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      label="Event start *"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      required
                    />
                    <Input
                      label="Event end *"
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      required
                    />
                    <Input
                      label="Travel start"
                      type="datetime-local"
                      value={travelStartsAt}
                      onChange={(e) => setTravelStartsAt(e.target.value)}
                    />
                    <Input
                      label="Travel end"
                      type="datetime-local"
                      value={travelEndsAt}
                      onChange={(e) => setTravelEndsAt(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Attendee count *"
                      type="number"
                      min={1}
                      value={delegateCount}
                      onChange={(e) => setDelegateCount(e.target.value)}
                      required
                    />
                    <SearchableSelect
                      label="Budget currency"
                      options={CURRENCY_OPTIONS}
                      value={currency}
                      onChange={(v) => setCurrency(String(v))}
                      searchable={false}
                    />
                    <Input
                      label="Estimated budget (major units)"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Contact name *"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder={user?.name || ""}
                    />
                    <Input
                      label="Contact email *"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder={user?.email || ""}
                    />
                    <Input
                      label="Contact phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>

                  <MiceRequirementToggles
                    flights={reqFlights}
                    hotels={reqHotels}
                    transfers={reqTransfers}
                    meetingSpace={reqConferenceHalls}
                    catering={reqCatering}
                    visas={reqVisas}
                    onFlights={setReqFlights}
                    onHotels={setReqHotels}
                    onTransfers={setReqTransfers}
                    onMeetingSpace={setReqConferenceHalls}
                    onCatering={setReqCatering}
                    onVisas={setReqVisas}
                  />

                  {reqHotels ? (
                    <Input
                      label="Accommodation notes"
                      value={accommodationNotes}
                      onChange={(e) => setAccommodationNotes(e.target.value)}
                    />
                  ) : null}
                  {reqTransfers ? (
                    <Input
                      label="Transport notes"
                      value={transportNotes}
                      onChange={(e) => setTransportNotes(e.target.value)}
                    />
                  ) : null}
                  {reqFlights ? (
                    <Input
                      label="Flight notes"
                      value={flightNotes}
                      onChange={(e) => setFlightNotes(e.target.value)}
                    />
                  ) : null}
                  {reqConferenceHalls ? (
                    <Input
                      label="Meeting / event notes"
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                    />
                  ) : null}
                  <Input
                    label="Additional notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  {msg ? (
                    <p className="fo-gm-msg fo-gm-msg--danger" role="alert">
                      {msg}
                    </p>
                  ) : null}
                  <div className="fo-gm-actions">
                    <Button type="submit" disabled={enquiryState.isLoading}>
                      {enquiryState.isLoading ? "Submitting…" : "Submit MICE enquiry"}
                    </Button>
                    <Link href="/chat">
                      <Button
                        type="button"
                        variant="ghost"
                        icon={<MessageCircle size={14} strokeWidth={2} />}
                      >
                        Ask Ava
                      </Button>
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </section>

          <section className="fo-gm-ledger">
            <div className="fo-gm-section">
              <h2 className="fo-gm-section__title">Your enquiries</h2>
              <p className="fo-gm-section__hint">
                Only you can see these. Status is the enquiry lifecycle, not a confirmation.
              </p>
              {enquiriesLoading ? (
                <div className="flex flex-col items-center gap-2 py-8" aria-busy="true">
                  <Spinner />
                  <p className="m-0 text-sm text-ink-soft">Loading enquiries…</p>
                </div>
              ) : enquiriesError ? (
                <div className="fo-gm-status">
                  <p className="fo-gm-msg fo-gm-msg--danger">Could not load enquiries.</p>
                  <Button type="button" size="sm" onClick={() => void refetchEnquiries()}>
                    Retry
                  </Button>
                </div>
              ) : enquiries.length === 0 ? (
                <div className="fo-gm-empty">
                  <p className="fo-gm-empty__title">No MICE enquiries yet</p>
                  <p className="fo-gm-empty__body">
                    Submit the form above to open a desk request.
                  </p>
                </div>
              ) : (
                <ul className="fo-gm-list fo-gm-list--flush">
                  {enquiries.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="fo-gm-row w-full text-left"
                        onClick={() => {
                          setSelectedEnquiryId((current) => (current === r.id ? null : r.id));
                          setEditNotes(r.notes || "");
                          setEditAttendees(String(r.attendeeCount));
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="fo-gm-row__title">{r.name}</p>
                            <MiceStatusChip status={r.status} attendees={r.attendeeCount} />
                          </div>
                          <p className="fo-gm-row__meta">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={12} strokeWidth={2} aria-hidden />
                              {formatType(r.type)} · {r.destination}
                              {r.origin ? ` from ${r.origin}` : ""}
                            </span>
                          </p>
                        </div>
                        <span className="fo-gm-row__action">
                          {selectedEnquiryId === r.id ? "Hide" : "Details"}
                        </span>
                      </button>
                      {selected?.id === r.id ? (
                        <div className="fo-gm-detail">
                          <p>{r.fulfilmentNote}</p>
                          <p className="inline-flex items-start gap-1.5">
                            <CalendarDays size={13} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
                            <span>
                              {formatDate(r.eventStartsAt)} – {formatDate(r.eventEndsAt)}
                            </span>
                          </p>
                          <p className="inline-flex items-start gap-1.5">
                            <Users size={13} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
                            <span>
                              {r.contactName} · {r.contactEmail}
                            </span>
                          </p>
                          {r.notes ? <p>Notes: {r.notes}</p> : null}
                          {r.status === "SUBMITTED" ? (
                            <div className="grid gap-2 sm:grid-cols-2 pt-1">
                              <Input
                                label="Update attendee count"
                                type="number"
                                min={1}
                                value={editAttendees}
                                onChange={(e) => setEditAttendees(e.target.value)}
                              />
                              <Input
                                label="Update notes"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={updateState.isLoading}
                                onClick={async () => {
                                  const count = parseInt(editAttendees, 10);
                                  if (!Number.isInteger(count) || count < 1) return;
                                  await updateEnquiry({
                                    enquiryId: r.id,
                                    body: { attendeeCount: count, notes: editNotes || undefined },
                                  }).unwrap();
                                  void refetchEnquiries();
                                }}
                              >
                                {updateState.isLoading ? "Saving…" : "Save changes"}
                              </Button>
                            </div>
                          ) : null}
                          <div className="fo-gm-actions">
                            {r.eventId ? (
                              <Link href={`/mice/${r.eventId}`}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<ChevronRight size={14} strokeWidth={2} />}
                                >
                                  Open workspace
                                </Button>
                              </Link>
                            ) : null}
                            {r.status === "SUBMITTED" || r.status === "IN_REVIEW" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={cancelState.isLoading}
                                onClick={async () => {
                                  await cancelEnquiry({ enquiryId: r.id });
                                  void refetchEnquiries();
                                }}
                              >
                                {cancelState.isLoading ? "Cancelling…" : "Cancel enquiry"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center gap-2 py-16" aria-busy="true">
          <Spinner />
          <p className="m-0 text-sm text-ink-soft">Loading MICE events…</p>
        </div>
      ) : isError ? (
        <div className="fo-gm-status">
          <p className="fo-gm-msg fo-gm-msg--danger">Could not load MICE events.</p>
          <Button type="button" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="fo-gm-ledger">
            <div className="fo-gm-section">
              <h2 className="fo-gm-section__title">Your event workspaces</h2>
              {eventsList.length === 0 ? (
                <div className="fo-gm-empty">
                  <p className="fo-gm-empty__title">No event workspaces yet</p>
                  <p className="fo-gm-empty__body">
                    Submit an enquiry or create a quick workspace below.
                  </p>
                </div>
              ) : (
                <ul className="fo-gm-list fo-gm-list--flush">
                  {eventsList.map((e) => (
                    <li key={e.id}>
                      <Link href={`/mice/${e.id}`} className="fo-gm-row">
                        <div className="min-w-0">
                          <p className="fo-gm-row__title">{e.name}</p>
                          <p className="fo-gm-row__meta">
                            {formatType(e.type)} · {new Date(e.startsAt).toLocaleDateString()} –{" "}
                            {new Date(e.endsAt).toLocaleDateString()}
                            {e.venue ? ` · ${e.venue}` : ""}
                          </p>
                        </div>
                        <span className="fo-gm-row__action inline-flex items-center gap-0.5">
                          Open
                          <ChevronRight size={14} strokeWidth={2} aria-hidden />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="fo-gm-panel">
            <h2 className="fo-gm-panel__title">Quick workspace</h2>
            <p className="fo-gm-section__hint" style={{ marginTop: "-0.35rem" }}>
              Create an empty coordination space without a full enquiry.
            </p>
            <div className="fo-gm-form">
              <Input
                label="Event name"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
              />
              <SearchableSelect
                label="Type"
                options={TYPE_OPTIONS}
                value={quickType}
                onChange={(v) => setQuickType(v as MiceEventType)}
                searchable={false}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Start"
                  type="datetime-local"
                  value={quickStart}
                  onChange={(e) => setQuickStart(e.target.value)}
                />
                <Input
                  label="End"
                  type="datetime-local"
                  value={quickEnd}
                  onChange={(e) => setQuickEnd(e.target.value)}
                />
              </div>
              <Button
                type="button"
                icon={<Plus size={14} strokeWidth={2} />}
                disabled={createState.isLoading || !quickName.trim() || !quickStart || !quickEnd}
                onClick={async () => {
                  setQuickMsg(null);
                  try {
                    const ev = await createEvent({
                      name: quickName.trim(),
                      type: quickType,
                      startsAt: new Date(quickStart).toISOString(),
                      endsAt: new Date(quickEnd).toISOString(),
                      autoCreateGroup: true,
                    }).unwrap();
                    window.location.href = `/mice/${ev.id}`;
                  } catch {
                    setQuickMsg("Could not create workspace.");
                  }
                }}
              >
                {createState.isLoading ? "Creating…" : "Create workspace"}
              </Button>
              {quickMsg ? <p className="fo-gm-msg fo-gm-msg--danger">{quickMsg}</p> : null}
            </div>
          </section>
        </div>
      )}
    </div>
    </div>
  );
}
