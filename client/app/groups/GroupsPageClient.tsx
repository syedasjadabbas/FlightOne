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
      <div className="fo-gm-status">
        <p className="fo-gm-kicker">Group travel</p>
        <h1 className="fo-gm-title">Groups</h1>
        <p className="fo-gm-lede">
          Group travel is account-based. Sign in to create or join a trip group.
        </p>
        <Link href="/login?redirect=%2Fgroups" className="fo-gm-link">
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
