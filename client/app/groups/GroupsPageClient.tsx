"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import {
  useAcceptInviteMutation,
  useCancelGroupTravelRequestMutation,
  useCreateGroupMutation,
  useCreateGroupTravelRequestMutation,
  useDeclineInviteMutation,
  useJoinGroupMutation,
  useListGroupTravelRequestsQuery,
  useListMyGroupsQuery,
  type GroupCabinPreference,
  type GroupDateFlexibility,
  type GroupType,
} from "@/lib/api/groups.api";
import { isValidGroupPassengerCount, MIN_GROUP_PASSENGERS } from "@/lib/groups/groupRequest";
import { useAuthStore } from "@/store/auth.store";

const TYPES: GroupType[] = [
  "FAMILY",
  "LEISURE",
  "STUDENT",
  "CORPORATE_TOUR",
  "UMRAH_HAJJ",
  "SPORTS",
  "OTHER",
];

const TYPE_OPTIONS = TYPES.map((t) => ({
  value: t,
  label: t.replace(/_/g, " "),
}));

const FLEXIBILITY_OPTIONS: Array<{ value: GroupDateFlexibility; label: string }> = [
  { value: "EXACT", label: "Exact travel dates only" },
  { value: "PLUS_MINUS_1", label: "Flexible ± 1 day" },
  { value: "PLUS_MINUS_3", label: "Flexible ± 3 days" },
  { value: "FLEXIBLE_WEEK", label: "Flexible within travel week" },
];

const CABIN_OPTIONS: Array<{ value: GroupCabinPreference | ""; label: string }> = [
  { value: "", label: "No preference" },
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium economy" },
  { value: "BUSINESS", label: "Business" },
  { value: "FIRST", label: "First" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function GroupsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const skip = !hasHydrated || !accessToken;

  const { data, isLoading, isError, refetch } = useListMyGroupsQuery(undefined, { skip });
  const {
    data: requestsData,
    isLoading: requestsLoading,
    isError: requestsError,
    refetch: refetchRequests,
  } = useListGroupTravelRequestsQuery(undefined, { skip });
  const [createGroup, createState] = useCreateGroupMutation();
  const [createRequest, requestState] = useCreateGroupTravelRequestMutation();
  const [cancelRequest, cancelState] = useCancelGroupTravelRequestMutation();
  const [joinGroup, joinState] = useJoinGroupMutation();
  const [acceptInvite] = useAcceptInviteMutation();
  const [declineInvite] = useDeclineInviteMutation();

  const [activeTab, setActiveTab] = useState<"enquiry" | "groups">("enquiry");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const [quickName, setQuickName] = useState("");
  const [quickType, setQuickType] = useState<GroupType>("FAMILY");
  const [inviteCode, setInviteCode] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("CORPORATE_TOUR");
  const [passengerCount, setPassengerCount] = useState(String(MIN_GROUP_PASSENGERS));
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flexibility, setFlexibility] = useState<GroupDateFlexibility>("PLUS_MINUS_1");
  const [cabinPreference, setCabinPreference] = useState<GroupCabinPreference | "">("");
  const [purpose, setPurpose] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [reqBaggage, setReqBaggage] = useState(false);
  const [reqSeating, setReqSeating] = useState(false);
  const [reqTransfers, setReqTransfers] = useState(false);
  const [reqSplitBilling, setReqSplitBilling] = useState(false);
  const [reqAccommodation, setReqAccommodation] = useState(false);
  const [accommodationNotes, setAccommodationNotes] = useState("");
  const [transportNotes, setTransportNotes] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
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
            Group Travel
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
            FlightOne Group Bookings
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
            Submit a group travel request for {MIN_GROUP_PASSENGERS} or more travellers. The group
            desk reviews enquiries manually — FlightOne does not auto-ticket group inventory or
            invent fares.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fgroups">
              <Button size="sm">Sign in to request group travel</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">Plan with Ava</Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900">Structured enquiry</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Origin, destination, dates, group size, cabin and contact details — stored as your
              request, not as a live airline booking.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900">Manual group desk</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              A specialist reviews the request. Availability, fares, and tickets are confirmed only
              when a supplier actually confirms them.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900">Shared workspace</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              After you submit, you can invite members, share documents, and coordinate in a group
              workspace while the desk works the request.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">
            Start a group request ({MIN_GROUP_PASSENGERS}+ passengers)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Sign in to submit a request, track status, and open the collaboration workspace.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fgroups">
              <Button size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="ghost">Create account</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pending = (data || []).filter((g) => g.myStatus === "INVITED");
  const active = (data || []).filter((g) => g.myStatus !== "INVITED");
  const requests = requestsData?.items || [];
  const selected = requests.find((r) => r.id === selectedRequestId) || null;

  async function handleEnquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setFormSuccess(null);
    setCreatedRequestId(null);
    setCreatedGroupId(null);

    const count = parseInt(passengerCount, 10);
    if (!isValidGroupPassengerCount(count)) {
      setFormMsg(`Group travel requires at least ${MIN_GROUP_PASSENGERS} passengers.`);
      return;
    }
    if (!groupName.trim() || !origin.trim() || !destination.trim()) {
      setFormMsg("Please enter a group name, origin, and destination.");
      return;
    }
    const email = contactEmail.trim() || user?.email || "";
    const name = contactName.trim() || user?.name || "";
    if (!name || !email) {
      setFormMsg("Contact name and email are required.");
      return;
    }

    try {
      const created = await createRequest({
        name: groupName.trim(),
        type: groupType,
        origin: origin.trim(),
        destination: destination.trim(),
        departureDate: departureDate || undefined,
        returnDate: returnDate || undefined,
        flexibility,
        passengerCount: count,
        cabinPreference: cabinPreference || null,
        purpose: purpose.trim() || undefined,
        contactName: name,
        contactEmail: email,
        contactPhone: contactPhone.trim() || undefined,
        organization: organization.trim() || undefined,
        baggageRequired: reqBaggage,
        seatingTogether: reqSeating,
        airportTransfers: reqTransfers,
        splitBilling: reqSplitBilling,
        accommodationRequired: reqAccommodation,
        accommodationNotes: accommodationNotes.trim() || undefined,
        transportNotes: transportNotes.trim() || undefined,
        notes: specialNotes.trim() || undefined,
        idempotencyKey:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `grp-req-${Date.now()}`,
      }).unwrap();

      setFormSuccess(
        `Request submitted for “${created.name}”. Status: ${created.status}. The group desk will review it manually — no tickets or fares have been issued.`,
      );
      setCreatedRequestId(created.id);
      setCreatedGroupId(created.groupId || created.group?.id || null);
      setSelectedRequestId(created.id);
      setGroupName("");
      setSpecialNotes("");
      setAccommodationNotes("");
      setTransportNotes("");
      void refetchRequests();
      void refetch();
    } catch {
      setFormMsg("Could not submit the group request. Check the fields and try again, or ask Ava.");
    }
  }

  return (
    <div className="fo-gm-page space-y-6">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">Group Travel</p>
          <h1 className="fo-gm-title">Group Bookings</h1>
          <p className="fo-gm-lede">
            Enquiries for {MIN_GROUP_PASSENGERS}+ travellers are reviewed by the group desk. This
            is not automated group ticketing.
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
          Group request ({MIN_GROUP_PASSENGERS}+)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "groups"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          My groups ({active.length})
        </button>
      </div>

      {pending.length > 0 ? (
        <div className="fo-gm-callout" role="region" aria-label="Pending invitations">
          <p className="fo-gm-callout__title">Pending group invitations</p>
          {pending.map((g) => (
            <div key={g.id} className="fo-gm-invite">
              <div>
                <p className="fo-gm-row__title">{g.name}</p>
                <p className="fo-gm-row__meta">{g.type.replace(/_/g, " ")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    await acceptInvite(g.id);
                    void refetch();
                  }}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await declineInvite(g.id);
                    void refetch();
                  }}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === "enquiry" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-base font-semibold text-slate-900">Group travel request</h2>
              <p className="text-xs text-slate-500 mt-1">
                Minimum {MIN_GROUP_PASSENGERS} passengers. Submitting creates a request for the
                group desk and, when possible, a collaboration workspace. No airline inventory is
                held until a supplier confirms it.
              </p>
            </div>

            {formSuccess ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-900">{formSuccess}</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  You can track this request below. Fulfilment is manual — we will not invent a PNR
                  or fare here.
                </p>
                <div className="flex flex-wrap gap-2">
                  {createdGroupId ? (
                    <Link href={`/groups/${createdGroupId}`}>
                      <Button size="sm">Open workspace</Button>
                    </Link>
                  ) : null}
                  {createdRequestId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedRequestId(createdRequestId)}
                    >
                      View request
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setFormSuccess(null)}>
                    Submit another request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEnquirySubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Group / trip name *"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Team offsite"
                    required
                  />
                  <SearchableSelect
                    label="Group type"
                    options={TYPE_OPTIONS}
                    value={groupType}
                    onChange={(v) => setGroupType(v as GroupType)}
                    searchable={false}
                  />
                  <Input
                    label={`Passenger count (min. ${MIN_GROUP_PASSENGERS}) *`}
                    type="number"
                    min={MIN_GROUP_PASSENGERS}
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <Input
                    label="Origin *"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                    placeholder="IATA or city code"
                    required
                  />
                  <Input
                    label="Destination *"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    placeholder="IATA or city code"
                    required
                  />
                  <Input
                    label="Departure date"
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                  />
                  <Input
                    label="Return date"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <SearchableSelect
                    label="Date flexibility"
                    options={FLEXIBILITY_OPTIONS}
                    value={flexibility}
                    onChange={(v) => setFlexibility(v as GroupDateFlexibility)}
                    searchable={false}
                  />
                  <SearchableSelect
                    label="Cabin preference"
                    options={CABIN_OPTIONS}
                    value={cabinPreference}
                    onChange={(v) => setCabinPreference((v as GroupCabinPreference) || "")}
                    searchable={false}
                  />
                  <Input
                    label="Travel purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. conference, sports tour"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Organization / company (optional)"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Primary contact name *"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={user?.name || "Organizer name"}
                  />
                  <Input
                    label="Contact email *"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={user?.email || "organizer@example.com"}
                  />
                  <Input
                    label="Contact phone / WhatsApp"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Requirements (optional)
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqSeating}
                        onChange={(e) => setReqSeating(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Request seats together</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqBaggage}
                        onChange={(e) => setReqBaggage(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Extra baggage needs</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqTransfers}
                        onChange={(e) => setReqTransfers(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Airport transfers</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqSplitBilling}
                        onChange={(e) => setReqSplitBilling(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Split billing request</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={reqAccommodation}
                        onChange={(e) => setReqAccommodation(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Accommodation required</span>
                    </label>
                  </div>
                </div>

                {reqAccommodation ? (
                  <Input
                    label="Accommodation notes"
                    value={accommodationNotes}
                    onChange={(e) => setAccommodationNotes(e.target.value)}
                    placeholder="Rooming, location, or board preference — not a hotel booking"
                  />
                ) : null}
                {reqTransfers ? (
                  <Input
                    label="Transport notes"
                    value={transportNotes}
                    onChange={(e) => setTransportNotes(e.target.value)}
                    placeholder="Coach, meet-and-greet, or other transfer notes"
                  />
                ) : null}

                <Input
                  label="Additional notes"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Anything else the group desk should know"
                />

                {formMsg ? <p className="text-xs text-red-600">{formMsg}</p> : null}

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={requestState.isLoading}>
                    {requestState.isLoading ? "Submitting…" : "Submit group request"}
                  </Button>
                  <Link href="/chat">
                    <Button type="button" variant="ghost">
                      Ask Ava
                    </Button>
                  </Link>
                </div>
              </form>
            )}
          </div>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">Your group requests</h2>
            <p className="text-xs text-slate-500 mt-1">
              Only you can see these. Status is the enquiry lifecycle, not a ticket.
            </p>
            {requestsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : requestsError ? (
              <div className="fo-gm-status mt-3">
                <p className="fo-gm-msg fo-gm-msg--danger">Could not load your requests.</p>
                <Button type="button" size="sm" onClick={() => void refetchRequests()}>
                  Retry
                </Button>
              </div>
            ) : requests.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No group requests yet.</p>
            ) : (
              <ul className="fo-gm-list fo-gm-list--flush mt-3">
                {requests.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="fo-gm-row w-full text-left"
                      onClick={() =>
                        setSelectedRequestId((current) => (current === r.id ? null : r.id))
                      }
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="fo-gm-row__title">{r.name}</p>
                          <span className="text-[10px] uppercase font-semibold tracking-wider bg-sky-100 text-sky-800 rounded px-1.5 py-0.5">
                            {r.status} · {r.passengerCount} pax
                          </span>
                        </div>
                        <p className="fo-gm-row__meta">
                          {r.origin} → {r.destination}
                          {r.departureDate ? ` · ${formatDate(r.departureDate)}` : ""}
                        </p>
                      </div>
                      <span className="fo-gm-row__action">
                        {selectedRequestId === r.id ? "Hide" : "Details"}
                      </span>
                    </button>
                    {selected?.id === r.id ? (
                      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-700 space-y-2 bg-slate-50/70">
                        <p>{r.fulfilmentNote}</p>
                        <dl className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500">Status</dt>
                            <dd>{r.status}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Cabin</dt>
                            <dd>{r.cabinPreference || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Return</dt>
                            <dd>{formatDate(r.returnDate)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Purpose</dt>
                            <dd>{r.purpose || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Contact</dt>
                            <dd>
                              {r.contactName} · {r.contactEmail}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Submitted</dt>
                            <dd>{formatDate(r.createdAt)}</dd>
                          </div>
                        </dl>
                        {r.notes ? <p>Notes: {r.notes}</p> : null}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.groupId ? (
                            <Link href={`/groups/${r.groupId}`}>
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
                                await cancelRequest({ requestId: r.id });
                                void refetchRequests();
                              }}
                            >
                              {cancelState.isLoading ? "Cancelling…" : "Cancel request"}
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
      ) : (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="fo-gm-status">
              <p className="fo-gm-msg fo-gm-msg--danger">Could not load groups.</p>
              <Button type="button" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <section className="fo-gm-ledger" aria-labelledby="fo-groups-list-heading">
                <div className="fo-gm-section">
                  <h2 id="fo-groups-list-heading" className="fo-gm-section__title">
                    Your group workspaces
                  </h2>
                  {active.length === 0 ? (
                    <div className="fo-gm-empty">
                      <p className="fo-gm-empty__title">No trip groups yet</p>
                      <p className="fo-gm-empty__body">
                        Submit a group request or join a team with an invite code.
                      </p>
                    </div>
                  ) : (
                    <ul className="fo-gm-list fo-gm-list--flush">
                      {active.map((g) => (
                        <li key={g.id}>
                          <Link href={`/groups/${g.id}`} className="fo-gm-row">
                            <div>
                              <p className="fo-gm-row__title">{g.name}</p>
                              <p className="fo-gm-row__meta">
                                {g.type.replace(/_/g, " ")}
                                {g.myRole ? ` · Role: ${g.myRole}` : ""}
                                {g.inviteCode ? ` · Invite: ${g.inviteCode}` : ""}
                              </p>
                            </div>
                            <span className="fo-gm-row__action">Open workspace →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <div className="fo-gm-panel-grid">
                <section className="fo-gm-panel" aria-labelledby="fo-create-group-heading">
                  <h2 id="fo-create-group-heading" className="fo-gm-panel__title">
                    Quick setup group
                  </h2>
                  <div className="fo-gm-form">
                    <Input label="Group name" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
                    <SearchableSelect
                      label="Type"
                      options={TYPE_OPTIONS}
                      value={quickType}
                      onChange={(v) => setQuickType(v as GroupType)}
                      searchable={false}
                    />
                    <Button
                      type="button"
                      disabled={createState.isLoading || !quickName.trim()}
                      onClick={async () => {
                        setQuickMsg(null);
                        try {
                          const g = await createGroup({ name: quickName.trim(), type: quickType }).unwrap();
                          setQuickName("");
                          window.location.href = `/groups/${g.id}`;
                        } catch {
                          setQuickMsg("Could not create group.");
                        }
                      }}
                    >
                      {createState.isLoading ? "Creating…" : "Create workspace"}
                    </Button>
                  </div>
                </section>

                <section className="fo-gm-panel" aria-labelledby="fo-join-group-heading">
                  <h2 id="fo-join-group-heading" className="fo-gm-panel__title">
                    Join with invite code
                  </h2>
                  <div className="fo-gm-form">
                    <Input
                      label="Invite code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={joinState.isLoading || !inviteCode.trim()}
                      onClick={async () => {
                        setQuickMsg(null);
                        try {
                          await joinGroup({ inviteCode: inviteCode.trim() }).unwrap();
                          setInviteCode("");
                          void refetch();
                          setQuickMsg("Successfully joined trip group.");
                        } catch {
                          setQuickMsg("Invalid invite code or unable to join.");
                        }
                      }}
                    >
                      {joinState.isLoading ? "Joining…" : "Join group"}
                    </Button>
                    {quickMsg ? <p className="fo-gm-msg">{quickMsg}</p> : null}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
