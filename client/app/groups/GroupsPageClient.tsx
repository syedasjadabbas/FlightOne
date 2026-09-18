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

export function GroupsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading, isError, refetch } = useListMyGroupsQuery(undefined, { skip });
  const [createGroup, createState] = useCreateGroupMutation();
  const [joinGroup, joinState] = useJoinGroupMutation();
  const [acceptInvite] = useAcceptInviteMutation();
  const [declineInvite] = useDeclineInviteMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupType>("FAMILY");
  const [inviteCode, setInviteCode] = useState("");
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
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">Group Travel & Coordinated Bookings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
            FlightOne Groups
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
            Coordinated flights, stays, and bespoke itineraries for family reunions, wedding parties, tour delegations, and sports teams (10+ travelers).
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Fgroups">
              <Button size="sm">Sign in to manage groups</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">Plan with Ava</Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">👥</div>
            <p className="text-sm font-semibold text-slate-900">Coordinated Travel</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Keep everyone on the same flights and accommodations with synchronized bookings and split payment options.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">🏷️</div>
            <p className="text-sm font-semibold text-slate-900">Volume Fares</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Access negotiated group contracts with flexible name change policies and extended ticketing windows.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">✨</div>
            <p className="text-sm font-semibold text-slate-900">Dedicated Coordination</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Work with our group travel specialists and Ava to manage luggage allowances, seating blocks, and dietary preferences.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Create or Join a Trip Group</h2>
          <p className="mt-1 text-xs text-slate-600">
            Sign in to create a new family or corporate group, invite passengers with a unique invite code, and track confirmations.
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

  return (
    <div className="fo-gm-page">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">Group travel</p>
          <h1 className="fo-gm-title">Groups</h1>
          <p className="fo-gm-lede">
            Coordinate family trips, tours, and teams — itinerary, docs, polls, and updates in one
            place.
          </p>
        </div>
      </header>

      {pending.length > 0 ? (
        <div className="fo-gm-callout" role="region" aria-label="Pending invitations">
          <p className="fo-gm-callout__title">Pending invitations</p>
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

      <section className="fo-gm-ledger" aria-labelledby="fo-groups-list-heading">
        <div className="fo-gm-section">
          <h2 id="fo-groups-list-heading" className="fo-gm-section__title">
            Your groups
          </h2>
          {active.length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No groups yet</p>
              <p className="fo-gm-empty__body">
                Create a trip group below, or join one with an invite code from your organizer.
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
                        {g.myRole ? ` · ${g.myRole}` : ""}
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

      <div className="fo-gm-panel-grid">
        <section className="fo-gm-panel" aria-labelledby="fo-create-group-heading">
          <h2 id="fo-create-group-heading" className="fo-gm-panel__title">
            Create group
          </h2>
          <div className="fo-gm-form">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <SearchableSelect
              label="Type"
              options={TYPE_OPTIONS}
              value={type}
              onChange={(v) => setType(v as GroupType)}
              searchable={false}
            />
            <Button
              type="button"
              disabled={createState.isLoading || !name.trim()}
              onClick={async () => {
                setMsg(null);
                try {
                  const g = await createGroup({ name: name.trim(), type }).unwrap();
                  setName("");
                  window.location.href = `/groups/${g.id}`;
                } catch {
                  setMsg("Could not create group.");
                }
              }}
            >
              {createState.isLoading ? "Creating…" : "Create"}
            </Button>
          </div>
        </section>

        <section className="fo-gm-panel" aria-labelledby="fo-join-group-heading">
          <h2 id="fo-join-group-heading" className="fo-gm-panel__title">
            Join with code
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
                setMsg(null);
                try {
                  await joinGroup({ inviteCode: inviteCode.trim() }).unwrap();
                  setInviteCode("");
                  void refetch();
                  setMsg("Joined.");
                } catch {
                  setMsg("Invalid code or could not join.");
                }
              }}
            >
              Join
            </Button>
            {msg ? <p className="fo-gm-msg">{msg}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
