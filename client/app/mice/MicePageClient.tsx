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

const TYPE_OPTIONS = TYPES.map((t) => ({ value: t, label: t }));

export function MicePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading, isError, refetch } = useListMiceEventsQuery(undefined, { skip });
  const [create, createState] = useCreateMiceEventMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<MiceEventType>("CONFERENCE");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [budget, setBudget] = useState("");
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
            End-to-end logistics for corporate summits, incentive retreats, international trade exhibitions, and executive conferences.
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
        <p className="fo-gm-msg fo-gm-msg--danger">Could not load events.</p>
        <Button type="button" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="fo-gm-page">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">Events</p>
          <h1 className="fo-gm-title">MICE</h1>
          <p className="fo-gm-lede">
            Meetings, incentives, conferences, and exhibitions — delegates, agenda, check-in, and
            reporting.
          </p>
        </div>
      </header>

      <section className="fo-gm-ledger" aria-labelledby="fo-mice-list-heading">
        <div className="fo-gm-section">
          <h2 id="fo-mice-list-heading" className="fo-gm-section__title">
            Your events
          </h2>
          {(data || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No events yet</p>
              <p className="fo-gm-empty__body">
                Create an event below to open the desk for delegates, agenda, and check-in.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list fo-gm-list--flush">
              {data!.map((e) => (
                <li key={e.id}>
                  <Link href={`/mice/${e.id}`} className="fo-gm-row">
                    <div>
                      <p className="fo-gm-row__title">{e.name}</p>
                      <p className="fo-gm-row__meta">
                        {e.type} · {new Date(e.startsAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="fo-gm-row__action">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="fo-gm-panel" aria-labelledby="fo-create-mice-heading">
        <h2 id="fo-create-mice-heading" className="fo-gm-panel__title">
          Create event
        </h2>
        <div className="fo-gm-form">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <SearchableSelect
            label="Type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(v) => setType(v as MiceEventType)}
            searchable={false}
          />
          <Input label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          <Input
            label="Starts (ISO or local)"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            placeholder="2026-10-01T09:00"
          />
          <Input
            label="Ends"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            placeholder="2026-10-02T18:00"
          />
          <Input
            label="Budget (minor units)"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            type="button"
            disabled={createState.isLoading || !name || !startsAt || !endsAt}
            onClick={async () => {
              setMsg(null);
              try {
                const ev = await create({
                  name: name.trim(),
                  type,
                  venue: venue.trim() || undefined,
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                  budgetMinor: budget ? Number(budget) : undefined,
                  currency: "PKR",
                  autoCreateGroup: true,
                }).unwrap();
                window.location.href = `/mice/${ev.id}`;
              } catch {
                setMsg("Could not create event — check dates.");
              }
            }}
          >
            {createState.isLoading ? "Creating…" : "Create event"}
          </Button>
          {msg ? <p className="fo-gm-msg">{msg}</p> : null}
        </div>
      </section>
    </div>
  );
}
