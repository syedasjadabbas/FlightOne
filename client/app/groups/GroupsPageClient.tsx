"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import {
  useAcceptInviteMutation,
  useCreateGroupMutation,
  useDeclineInviteMutation,
  useJoinGroupMutation,
  useListMyGroupsQuery,
  type GroupType,
} from "@/lib/api/groups.api";
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

const FLEXIBILITY_OPTIONS = [
  { value: "EXACT", label: "Exact travel dates only" },
  { value: "PLUS_MINUS_1", label: "Flexible ± 1 day" },
  { value: "PLUS_MINUS_3", label: "Flexible ± 3 days" },
  { value: "FLEXIBLE_WEEK", label: "Flexible within travel week" },
];

export function GroupsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const skip = !hasHydrated || !accessToken;

  const { data, isLoading, isError, refetch } = useListMyGroupsQuery(undefined, { skip });
  const [createGroup, createState] = useCreateGroupMutation();
  const [joinGroup, joinState] = useJoinGroupMutation();
  const [acceptInvite] = useAcceptInviteMutation();
  const [declineInvite] = useDeclineInviteMutation();

  const [activeTab, setActiveTab] = useState<"enquiry" | "groups">("enquiry");

  // Quick create group state
  const [quickName, setQuickName] = useState("");
  const [quickType, setQuickType] = useState<GroupType>("FAMILY");
  const [inviteCode, setInviteCode] = useState("");

  // Dedicated 10+ Passenger Group Booking Enquiry State
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("CORPORATE_TOUR");
  const [passengerCount, setPassengerCount] = useState("12");
  const [origin, setOrigin] = useState("KHI");
  const [destination, setDestination] = useState("DXB");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flexibility, setFlexibility] = useState("PLUS_MINUS_1");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [reqBaggage, setReqBaggage] = useState(true);
  const [reqSeating, setReqSeating] = useState(true);
  const [reqTransfers, setReqTransfers] = useState(false);
  const [reqSplitBilling, setReqSplitBilling] = useState(false);
  const [specialNotes, setSpecialNotes] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
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
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">Group Travel & Coordinated Bookings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
            FlightOne Group Bookings
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
            Negotiated group contracts, flexible name submissions up to 72 hours prior to flight departure, and shared itinerary hubs for parties of 10 or more travelers.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fgroups">
              <Button size="sm">Sign in to request group fares</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">Plan with Ava</Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">👥</div>
            <p className="text-sm font-semibold text-slate-900">Guaranteed Block Seats</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Lock airline seats and hotel room blocks with staged deposits instead of full immediate passenger payment.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">🏷️</div>
            <p className="text-sm font-semibold text-slate-900">Flexible Passenger Names</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Submit final passenger passport details up to 72 hours prior to departure without costly name change penalties.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">✨</div>
            <p className="text-sm font-semibold text-slate-900">Dedicated Coordination Desk</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Real-time collaboration workspace with member announcements, group polls, waypoint checklists, and luggage tracking.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Start a Group Booking (10+ Passengers)</h2>
          <p className="mt-1 text-xs text-slate-600">
            Sign in to submit a customized group quote request, invite group members via code, and manage documents centrally.
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fo-gm-status">
        <p className="fo-gm-msg fo-gm-msg--danger">Could not load groups.</p>
        <Button type="button" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const pending = (data || []).filter((g) => g.myStatus === "INVITED");
  const active = (data || []).filter((g) => g.myStatus !== "INVITED");

  async function handleEnquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setFormSuccess(null);

    const count = parseInt(passengerCount, 10);
    if (isNaN(count) || count < 10) {
      setFormMsg("Group bookings require a minimum of 10 passengers per airline group policies.");
      return;
    }
    if (!groupName.trim()) {
      setFormMsg("Please enter a group or trip name.");
      return;
    }
    if (!origin.trim() || !destination.trim()) {
      setFormMsg("Please specify both origin and destination cities/airports.");
      return;
    }

    try {
      const metadata = {
        isGroupBookingEnquiry: true,
        passengerCount: count,
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departureDate: departureDate || null,
        returnDate: returnDate || null,
        flexibility,
        contact: {
          name: contactName.trim() || user?.name || "Group Organizer",
          email: contactEmail.trim() || user?.email || "",
          phone: contactPhone.trim(),
          organization: organization.trim(),
        },
        requirements: {
          baggageAllowance: reqBaggage,
          seatingTogether: reqSeating,
          airportTransfers: reqTransfers,
          splitBilling: reqSplitBilling,
          specialNotes: specialNotes.trim(),
        },
        status: "REQUESTED",
        requestedAt: new Date().toISOString(),
      };

      const g = await createGroup({
        name: groupName.trim(),
        type: groupType,
        metadata,
      }).unwrap();

      setFormSuccess(`Group quote enquiry submitted for "${g.name}". Group desk workspace created.`);
      setGroupName("");
      setSpecialNotes("");
      void refetch();
    } catch {
      setFormMsg("Could not submit group request. Please try again or consult Ava in Chat.");
    }
  }

  return (
    <div className="fo-gm-page space-y-6">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">Group Travel & Delegation Desk</p>
          <h1 className="fo-gm-title">Group Bookings</h1>
          <p className="fo-gm-lede">
            Specialized fares, block seat holding, flexible ticketing windows, and unified coordination for 10 or more passengers.
          </p>
        </div>
      </header>

      {/* Tabs */}
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
          Request Group Fares (10+ Travelers)
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
          My Active Groups ({active.length})
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
              <h2 className="text-base font-semibold text-slate-900">Group Travel Quote Enquiry</h2>
              <p className="text-xs text-slate-500 mt-1">
                For groups of 10 or more passengers. Our group desk negotiates volume contracts with airlines and hotels to deliver blocked seat holds and flexible name submission.
              </p>
            </div>

            {formSuccess ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-900">✓ {formSuccess}</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Your request has been registered in the FlightOne group queue. You can now open your group workspace to invite members, post flight updates, and manage attendees.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setActiveTab("groups")}>
                    View Active Groups
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setFormSuccess(null)}>
                    Submit Another Request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEnquirySubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Input
                      label="Group / Delegation Name *"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g. Acme Dubai Annual Summit"
                      required
                    />
                  </div>
                  <div>
                    <SearchableSelect
                      label="Group Type"
                      options={TYPE_OPTIONS}
                      value={groupType}
                      onChange={(v) => setGroupType(v as GroupType)}
                      searchable={false}
                    />
                  </div>
                  <div>
                    <Input
                      label="Passenger Count (Min. 10) *"
                      type="number"
                      min={10}
                      value={passengerCount}
                      onChange={(e) => setPassengerCount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <Input
                      label="Origin (City / Airport) *"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                      placeholder="e.g. KHI, LHE, ISB, LHR"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Destination (City / Airport) *"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value.toUpperCase())}
                      placeholder="e.g. DXB, IST, JED, LHR"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Departure Date"
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      label="Return Date"
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SearchableSelect
                      label="Date Flexibility"
                      options={FLEXIBILITY_OPTIONS}
                      value={flexibility}
                      onChange={(v) => setFlexibility(String(v))}
                      searchable={false}
                    />
                  </div>
                  <div>
                    <Input
                      label="Organization / Company (optional)"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Global Tech Solutions"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Input
                      label="Primary Contact Name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder={user?.name || "Organizer Name"}
                    />
                  </div>
                  <div>
                    <Input
                      label="Contact Email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder={user?.email || "organizer@company.com"}
                    />
                  </div>
                  <div>
                    <Input
                      label="Contact Phone / WhatsApp"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                    />
                  </div>
                </div>

                {/* Special Requirements Checklist */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Special Service Requirements
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqSeating}
                        onChange={(e) => setReqSeating(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Block group seats together on flights</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqBaggage}
                        onChange={(e) => setReqBaggage(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Additional collective baggage allowance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqTransfers}
                        onChange={(e) => setReqTransfers(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Airport coach transfers & meet-and-greet</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={reqSplitBilling}
                        onChange={(e) => setReqSplitBilling(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span>Split billing / individual member payment links</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Input
                    label="Additional Trip Specifications / Special Requests"
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    placeholder="e.g. Dietary preferences, hotel star rating, preferred airlines, wheelchair assistance"
                  />
                </div>

                {formMsg ? <p className="text-xs text-red-600">{formMsg}</p> : null}

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={createState.isLoading}>
                    {createState.isLoading ? "Submitting Group Request…" : "Submit Group Booking Request"}
                  </Button>
                  <Link href="/chat">
                    <Button type="button" variant="ghost">
                      Discuss with Ava Assistant
                    </Button>
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* My Active Groups Tab */
        <div className="space-y-6">
          <section className="fo-gm-ledger" aria-labelledby="fo-groups-list-heading">
            <div className="fo-gm-section">
              <h2 id="fo-groups-list-heading" className="fo-gm-section__title">
                Your Managed Groups & Delegations
              </h2>
              {active.length === 0 ? (
                <div className="fo-gm-empty">
                  <p className="fo-gm-empty__title">No trip groups yet</p>
                  <p className="fo-gm-empty__body">
                    Submit a group booking request above or join a team with an invite code.
                  </p>
                </div>
              ) : (
                <ul className="fo-gm-list fo-gm-list--flush">
                  {active.map((g) => {
                    const meta = g.metadata as Record<string, unknown> | null;
                    const isEnquiry = Boolean(meta?.isGroupBookingEnquiry);
                    return (
                      <li key={g.id}>
                        <Link href={`/groups/${g.id}`} className="fo-gm-row">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="fo-gm-row__title">{g.name}</p>
                              {isEnquiry && (
                                <span className="text-[10px] uppercase font-semibold tracking-wider bg-sky-100 text-sky-800 rounded px-1.5 py-0.5">
                                  {String(meta?.passengerCount ?? "10+")} Pax · {String(meta?.status ?? "Quote")}
                                </span>
                              )}
                            </div>
                            <p className="fo-gm-row__meta">
                              {g.type.replace(/_/g, " ")}
                              {g.myRole ? ` · Role: ${g.myRole}` : ""}
                              {g.inviteCode ? ` · Invite: ${g.inviteCode}` : ""}
                            </p>
                          </div>
                          <span className="fo-gm-row__action">Open Workspace →</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <div className="fo-gm-panel-grid">
            <section className="fo-gm-panel" aria-labelledby="fo-create-group-heading">
              <h2 id="fo-create-group-heading" className="fo-gm-panel__title">
                Quick Setup Group
              </h2>
              <div className="fo-gm-form">
                <Input label="Group Name" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
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
                  {createState.isLoading ? "Creating…" : "Create Workspace"}
                </Button>
              </div>
            </section>

            <section className="fo-gm-panel" aria-labelledby="fo-join-group-heading">
              <h2 id="fo-join-group-heading" className="fo-gm-panel__title">
                Join with Invite Code
              </h2>
              <div className="fo-gm-form">
                <Input
                  label="6-Digit Invite Code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GRP123"
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
                  {joinState.isLoading ? "Joining…" : "Join Group"}
                </Button>
                {quickMsg ? <p className="fo-gm-msg">{quickMsg}</p> : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
