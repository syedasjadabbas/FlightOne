"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
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

const TYPES: MiceEventType[] = ["MEETING", "INCENTIVE", "CONFERENCE", "EXHIBITION"];

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
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="space-y-8">
        <header className="border-b border-slate-200/80 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
            MICE & Events
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
            FlightOne MICE desk
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
            Submit a meetings, incentives, conferences, or exhibitions enquiry. The desk reviews
            requests manually — FlightOne does not invent venue holds, fares, or tickets.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fmice">
              <Button size="sm">Sign in to submit an enquiry</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">Ask Ava</Button>
            </Link>
          </div>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900">Structured enquiry</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Event dates, attendees, travel, accommodation, and meeting requirements are stored as
              your request — not as live supplier bookings.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900">Manual MICE desk</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Availability and pricing are confirmed only when a supplier actually confirms them.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900">Event workspace</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              After submit, you can open a workspace for delegates, agenda, and transfers while the
              desk works the enquiry.
            </p>
          </div>
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
    <div className="fo-gm-page space-y-6">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">MICE & Events</p>
          <h1 className="fo-gm-title">MICE desk</h1>
          <p className="fo-gm-lede">
            Enquiries are reviewed by the MICE desk. This is not automated event ticketing.
          </p>
        </div>
      </header>

      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("enquiry")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "enquiry"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Event enquiry
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "events"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Event workspaces ({eventsList.length})
        </button>
      </div>

      {activeTab === "enquiry" ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-base font-semibold text-slate-900">MICE event enquiry</h2>
              <p className="text-xs text-slate-500 mt-1">
                Submitting creates a desk request and, when possible, a workspace. Inventory is not
                held until a supplier confirms it.
              </p>
            </div>

            {formSuccess ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-900">{formSuccess}</p>
                <div className="flex flex-wrap gap-2">
                  {createdEventId ? (
                    <Link href={`/mice/${createdEventId}`}>
                      <Button size="sm">Open workspace</Button>
                    </Link>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setFormSuccess(null)}>
                    Submit another enquiry
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleEnquirySubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="grid gap-4 sm:grid-cols-3">
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
                <div className="grid gap-4 sm:grid-cols-4">
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
                <div className="grid gap-4 sm:grid-cols-3">
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
                <div className="grid gap-4 sm:grid-cols-3">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Requirements (optional — requests only)
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        { checked: reqFlights, set: setReqFlights, label: "Flights" },
                        { checked: reqHotels, set: setReqHotels, label: "Accommodation" },
                        { checked: reqTransfers, set: setReqTransfers, label: "Transfers" },
                        {
                          checked: reqConferenceHalls,
                          set: setReqConferenceHalls,
                          label: "Meeting / event space",
                        },
                        { checked: reqCatering, set: setReqCatering, label: "Catering" },
                        { checked: reqVisas, set: setReqVisas, label: "Visa assistance" },
                      ] as const
                    ).map((item) => (
                      <label
                        key={item.label}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
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
                {msg ? <p className="text-xs text-red-600">{msg}</p> : null}
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={enquiryState.isLoading}>
                    {enquiryState.isLoading ? "Submitting…" : "Submit MICE enquiry"}
                  </Button>
                  <Link href="/chat">
                    <Button type="button" variant="ghost">
                      Ask Ava
                    </Button>
                  </Link>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">Your MICE enquiries</h2>
            <p className="text-xs text-slate-500 mt-1">
              Only you can see these. Status is the enquiry lifecycle, not a confirmation.
            </p>
            {enquiriesLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : enquiriesError ? (
              <div className="fo-gm-status mt-3">
                <p className="fo-gm-msg fo-gm-msg--danger">Could not load enquiries.</p>
                <Button type="button" size="sm" onClick={() => void refetchEnquiries()}>
                  Retry
                </Button>
              </div>
            ) : enquiries.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No MICE enquiries yet.</p>
            ) : (
              <ul className="fo-gm-list fo-gm-list--flush mt-3">
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
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="fo-gm-row__title">{r.name}</p>
                          <span className="text-[10px] uppercase font-semibold tracking-wider bg-sky-100 text-sky-800 rounded px-1.5 py-0.5">
                            {r.status} · {r.attendeeCount} pax
                          </span>
                        </div>
                        <p className="fo-gm-row__meta">
                          {r.type} · {r.destination}
                          {r.origin ? ` from ${r.origin}` : ""}
                        </p>
                      </div>
                      <span className="fo-gm-row__action">
                        {selectedEnquiryId === r.id ? "Hide" : "Details"}
                      </span>
                    </button>
                    {selected?.id === r.id ? (
                      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-700 space-y-2 bg-slate-50/70">
                        <p>{r.fulfilmentNote}</p>
                        <p>
                          Event: {formatDate(r.eventStartsAt)} – {formatDate(r.eventEndsAt)}
                        </p>
                        <p>
                          Contact: {r.contactName} · {r.contactEmail}
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
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.eventId ? (
                            <Link href={`/mice/${r.eventId}`}>
                              <Button size="sm" variant="secondary">
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
          </section>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="fo-gm-status">
          <p className="fo-gm-msg fo-gm-msg--danger">Could not load MICE events.</p>
          <Button type="button" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="fo-gm-ledger">
            <div className="fo-gm-section">
              <h2 className="fo-gm-section__title">Your event workspaces</h2>
              {eventsList.length === 0 ? (
                <div className="fo-gm-empty">
                  <p className="fo-gm-empty__title">No event workspaces yet</p>
                  <p className="fo-gm-empty__body">Submit an enquiry or create a workspace below.</p>
                </div>
              ) : (
                <ul className="fo-gm-list fo-gm-list--flush">
                  {eventsList.map((e) => (
                    <li key={e.id}>
                      <Link href={`/mice/${e.id}`} className="fo-gm-row">
                        <div>
                          <p className="fo-gm-row__title">{e.name}</p>
                          <p className="fo-gm-row__meta">
                            {e.type} · {new Date(e.startsAt).toLocaleDateString()} –{" "}
                            {new Date(e.endsAt).toLocaleDateString()}
                            {e.venue ? ` · ${e.venue}` : ""}
                          </p>
                        </div>
                        <span className="fo-gm-row__action">Open desk →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className="fo-gm-panel">
            <h2 className="fo-gm-panel__title">Quick workspace</h2>
            <div className="fo-gm-form">
              <Input label="Event name" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
              <SearchableSelect
                label="Type"
                options={TYPE_OPTIONS}
                value={quickType}
                onChange={(v) => setQuickType(v as MiceEventType)}
                searchable={false}
              />
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
              <Button
                type="button"
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
              {quickMsg ? <p className="fo-gm-msg">{quickMsg}</p> : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
