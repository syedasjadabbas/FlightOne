"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import {
  useCreateMiceEventMutation,
  useListMiceEventsQuery,
  type MiceEventType,
} from "@/lib/api/mice.api";
import { useAuthStore } from "@/store/auth.store";

const TYPES: MiceEventType[] = ["MEETING", "INCENTIVE", "CONFERENCE", "EXHIBITION"];

const TYPE_OPTIONS = [
  { value: "CONFERENCE", label: "International Conference / Convention" },
  { value: "INCENTIVE", label: "Corporate Incentive & Executive Retreat" },
  { value: "MEETING", label: "Board / Partner Strategic Summit" },
  { value: "EXHIBITION", label: "Trade Exhibition & Industry Expo" },
];

const CURRENCY_OPTIONS = [
  { value: "PKR", label: "PKR — Pakistani Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
];

export function MicePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const skip = !hasHydrated || !accessToken;

  const { data, isLoading, isError, refetch } = useListMiceEventsQuery(undefined, { skip });
  const [create, createState] = useCreateMiceEventMutation();

  const [activeTab, setActiveTab] = useState<"register" | "events">("register");

  // Event form state
  const [name, setName] = useState("");
  const [type, setType] = useState<MiceEventType>("CONFERENCE");
  const [organization, setOrganization] = useState("");
  const [destinationCity, setDestinationCity] = useState("Dubai, UAE");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [delegateCount, setDelegateCount] = useState("50");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  // Services checklist
  const [reqFlights, setReqFlights] = useState(true);
  const [reqHotels, setReqHotels] = useState(true);
  const [reqTransfers, setReqTransfers] = useState(true);
  const [reqConferenceHalls, setReqConferenceHalls] = useState(true);
  const [reqCatering, setReqCatering] = useState(true);
  const [reqVisas, setReqVisas] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

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
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">Conferences, Incentives & Exhibitions</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
            FlightOne MICE Solutions
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
            Turnkey logistical planning for corporate summits, incentive journeys, multinational trade expos, and board retreats.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fmice">
              <Button size="sm">Sign in to event desk</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">Consult with Ava</Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">🏢</div>
            <p className="text-sm font-semibold text-slate-900">Meetings & Summits</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Venue selection, block hotel rooms, presentation spaces, and multi-origin flight coordination for executive gatherings.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">🌴</div>
            <p className="text-sm font-semibold text-slate-900">Incentive Travel</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Curated luxury reward trips, bespoke cultural experiences, private charters, and high-touch hospitality.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">🌐</div>
            <p className="text-sm font-semibold text-slate-900">Exhibitions & Conferences</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Delegation tracking, airport meet-and-greet, ground transfers, and centralized invoicing for international attendee contingents.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Event Organizer Portal</h2>
          <p className="mt-1 text-xs text-slate-600">
            Sign in to register your company event, import attendee lists, generate airport transfer rosters, and monitor arrival statuses.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fmice">
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
        <p className="fo-gm-msg fo-gm-msg--danger">Could not load MICE events.</p>
        <Button type="button" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const eventsList = data || [];

  return (
    <div className="fo-gm-page space-y-6">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">Corporate & Global Events</p>
          <h1 className="fo-gm-title">MICE Solutions</h1>
          <p className="fo-gm-lede">
            Meetings, Incentives, Conferences, and Exhibitions — delegate manifests, flight rosters, room blocks, and onsite logistical management.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("register")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "register"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Register / Plan New Event
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
          Your Events & Desks ({eventsList.length})
        </button>
      </div>

      {activeTab === "register" ? (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-base font-semibold text-slate-900">Event Registration & Enquiry</h2>
            <p className="text-xs text-slate-500 mt-1">
              Initialize a dedicated MICE event workspace with delegate management, flight manifest tracking, and budget oversight.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              if (!name.trim() || !startsAt || !endsAt) {
                setMsg("Please specify the event name, start date, and end date.");
                return;
              }

              try {
                const combinedVenue = [venue.trim(), destinationCity.trim(), organization.trim() ? `Org: ${organization.trim()}` : ""]
                  .filter(Boolean)
                  .join(" · ");

                const ev = await create({
                  name: name.trim(),
                  type,
                  venue: combinedVenue || undefined,
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                  budgetMinor: budget ? Math.round(Number(budget) * 100) : undefined,
                  currency,
                  autoCreateGroup: true,
                }).unwrap();

                window.location.href = `/mice/${ev.id}`;
              } catch {
                setMsg("Could not create event. Please check date formats and try again.");
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="Event Title *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asia-Pacific FinTech Summit 2026"
                  required
                />
              </div>
              <div>
                <SearchableSelect
                  label="Event Category"
                  options={TYPE_OPTIONS}
                  value={type}
                  onChange={(v) => setType(v as MiceEventType)}
                  searchable={false}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Input
                  label="Host Organization / Corporation"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Apex Financial Group"
                />
              </div>
              <div>
                <Input
                  label="Host City / Destination *"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  placeholder="e.g. Dubai, Singapore, Istanbul, Riyadh"
                  required
                />
              </div>
              <div>
                <Input
                  label="Venue / Conference Center (optional)"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Dubai World Trade Centre / Atlantis"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Input
                  label="Event Start Date & Time *"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="Event End Date & Time *"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="Expected Delegate Count"
                  type="number"
                  min={1}
                  value={delegateCount}
                  onChange={(e) => setDelegateCount(e.target.value)}
                  placeholder="e.g. 75"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <SearchableSelect
                  label="Budget Currency"
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={(v) => setCurrency(String(v))}
                  searchable={false}
                />
              </div>
              <div>
                <Input
                  label="Estimated Overall Budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 50000"
                />
              </div>
            </div>

            {/* Logistics Checklist */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Required MICE Logistics & Services
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={reqFlights}
                    onChange={(e) => setReqFlights(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Multi-origin Group Flights</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={reqHotels}
                    onChange={(e) => setReqHotels(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Hotel Room Block Reservation</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={reqTransfers}
                    onChange={(e) => setReqTransfers(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Airport VIP & Coach Transfers</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={reqConferenceHalls}
                    onChange={(e) => setReqConferenceHalls(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Conference Halls & Audiovisual</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={reqCatering}
                    onChange={(e) => setReqCatering(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Catering & Gala Dinners</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={reqVisas}
                    onChange={(e) => setReqVisas(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Delegate Visa Assistance Desk</span>
                </label>
              </div>
            </div>

            <div>
              <Input
                label="Additional Specifications & Agenda Requirements"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Keynote speakers, breakout rooms, special accessibility requirements"
              />
            </div>

            {msg ? <p className="text-xs text-red-600">{msg}</p> : null}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={createState.isLoading}>
                {createState.isLoading ? "Creating Event Desk…" : "Create MICE Event Workspace"}
              </Button>
              <Link href="/chat">
                <Button type="button" variant="ghost">
                  Plan with Ava Assistant
                </Button>
              </Link>
            </div>
          </form>
        </section>
      ) : (
        /* Events List */
        <section className="fo-gm-ledger" aria-labelledby="fo-mice-list-heading">
          <div className="fo-gm-section">
            <h2 id="fo-mice-list-heading" className="fo-gm-section__title">
              Your Registered MICE Events
            </h2>
            {eventsList.length === 0 ? (
              <div className="fo-gm-empty">
                <p className="fo-gm-empty__title">No events registered yet</p>
                <p className="fo-gm-empty__body">
                  Create an event above to open the desk for delegates, agenda scheduling, transfer manifests, and check-in.
                </p>
              </div>
            ) : (
              <ul className="fo-gm-list fo-gm-list--flush">
                {eventsList.map((e) => (
                  <li key={e.id}>
                    <Link href={`/mice/${e.id}`} className="fo-gm-row">
                      <div>
                        <p className="fo-gm-row__title">{e.name}</p>
                        <p className="fo-gm-row__meta">
                          {e.type} · {new Date(e.startsAt).toLocaleDateString()} – {new Date(e.endsAt).toLocaleDateString()}
                          {e.venue ? ` · ${e.venue}` : ""}
                        </p>
                      </div>
                      <span className="fo-gm-row__action">Open Event Desk →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
