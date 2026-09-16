"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import {
  useCreateAnnouncementMutation,
  useCreateEmergencyMutation,
  useCreatePollMutation,
  useCreateWaypointMutation,
  useGenerateMemoryMutation,
  useGetFlightStatusQuery,
  useGetGroupQuery,
  useGetItineraryQuery,
  useGetLiveUpdatesQuery,
  useInviteMemberMutation,
  useLeaveGroupMutation,
  useListAnnouncementsQuery,
  useListAttendanceQuery,
  useListGroupDocumentsQuery,
  useListMembersQuery,
  useListMemoriesQuery,
  useListPhotosQuery,
  useListPollsQuery,
  useMarkAttendanceMutation,
  useShareBookingMutation,
  useShareDocumentMutation,
  useUploadPhotoMutation,
  useVotePollMutation,
} from "@/lib/api/groups.api";
import { useAuthStore } from "@/store/auth.store";

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

export function GroupDetailClient({ groupId }: { groupId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data: group, isLoading, isError, error, refetch } = useGetGroupQuery(groupId, { skip });
  const { data: members } = useListMembersQuery(groupId, { skip });
  const { data: announcements } = useListAnnouncementsQuery(groupId, { skip });
  const { data: polls } = useListPollsQuery(groupId, { skip });
  const { data: itinerary } = useGetItineraryQuery(groupId, { skip });
  const { data: flightStatus } = useGetFlightStatusQuery(groupId, { skip });
  const { data: liveUpdates } = useGetLiveUpdatesQuery(groupId, { skip });
  const { data: documents } = useListGroupDocumentsQuery(groupId, { skip });
  const { data: attendance } = useListAttendanceQuery(groupId, { skip });
  const { data: photos } = useListPhotosQuery(groupId, { skip });
  const { data: memories } = useListMemoriesQuery(groupId, { skip });

  const [inviteEmail, setInviteEmail] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [emBody, setEmBody] = useState("");
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState("Yes, No");
  const [bookingId, setBookingId] = useState("");
  const [vaultDocId, setVaultDocId] = useState("");
  const [waypointLabel, setWaypointLabel] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const [invite] = useInviteMemberMutation();
  const [announce] = useCreateAnnouncementMutation();
  const [emergency] = useCreateEmergencyMutation();
  const [createPoll] = useCreatePollMutation();
  const [vote] = useVotePollMutation();
  const [shareBooking] = useShareBookingMutation();
  const [shareDoc] = useShareDocumentMutation();
  const [createWp] = useCreateWaypointMutation();
  const [markAtt] = useMarkAttendanceMutation();
  const [uploadPhoto] = useUploadPhotoMutation();
  const [genMemory] = useGenerateMemoryMutation();
  const [leave] = useLeaveGroupMutation();

  const isOrganizer = useMemo(() => {
    const role = group?.myMembership?.role || group?.myRole;
    return role === "ORGANIZER" || role === "ADMIN";
  }, [group]);

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
  if (isError || !group) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : null;
    return (
      <div className="fo-gm-status">
        <p className="fo-gm-msg fo-gm-msg--danger">
          {status === 403
            ? "You don’t have access to this group."
            : "Could not load this group."}
        </p>
        <Button type="button" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
        <Link href="/groups" className="fo-gm-link">
          Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="fo-gm-page">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <Link href="/groups" className="fo-gm-back">
            ← Groups
          </Link>
          <p className="fo-gm-kicker">Trip group</p>
          <h1 className="fo-gm-title">{group.name}</h1>
          <p className="fo-gm-meta">
            <span>{group.type.replace(/_/g, " ")}</span>
            {isOrganizer ? <span>Organizer tools enabled</span> : null}
          </p>
          <p className="fo-gm-meta">
            <span>Invite code</span>
            <span className="fo-gm-meta__code">{group.inviteCode}</span>
          </p>
          {localMsg ? <p className="fo-gm-msg">{localMsg}</p> : null}
        </div>
      </header>

      <div className="fo-gm-ledger">
        <DeskSection title="Members">
          {(members || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No members listed</p>
              <p className="fo-gm-empty__body">Invite travelers by email when you’re ready.</p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(members || []).map((m) => (
                <li key={m.id} className="fo-gm-inline">
                  <span>{m.displayName || m.userId.slice(0, 8)}</span>
                  <span className="fo-gm-inline__muted">
                    {m.role} · {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {isOrganizer ? (
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Invite by email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    await invite({ groupId, email: inviteEmail.trim() }).unwrap();
                    setInviteEmail("");
                    setLocalMsg("Invitation sent.");
                  } catch {
                    setLocalMsg("Invite failed.");
                  }
                }}
              >
                Invite
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection
          title="Shared itinerary"
          hint="Share one of your ticketed bookings so the group can see the same flight plan."
        >
          {(itinerary?.items || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No shared bookings yet</p>
              <p className="fo-gm-empty__body">
                Paste a booking ID you own to add it to the group itinerary.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {itinerary!.items.map((it) => {
                const slice = it.booking.itinerary as {
                  origin?: string;
                  destination?: string;
                  flightNumber?: string;
                } | null;
                return (
                  <li key={it.shareId} className="fo-gm-item fo-gm-item--boxed">
                    <p className="fo-gm-row__title">{it.booking.status}</p>
                    <p className="fo-gm-row__meta">
                      {[slice?.flightNumber, slice?.origin, slice?.destination]
                        .filter(Boolean)
                        .join(" · ") || "Booking linked (see booking record for details)"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="fo-gm-form fo-gm-form--row">
            <Input
              label="Your booking ID"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                try {
                  await shareBooking({ groupId, bookingId: bookingId.trim() }).unwrap();
                  setBookingId("");
                  setLocalMsg("Booking shared.");
                } catch {
                  setLocalMsg("Could not share booking (must be yours).");
                }
              }}
            >
              Share
            </Button>
          </div>
        </DeskSection>

        <DeskSection title="Flight status">
          {!flightStatus?.capability?.canPollLive ? (
            <p className="fo-gm-section__hint">
              Live status unavailable:{" "}
              {flightStatus?.capability?.reasons?.[0] || "provider unconfigured"}. Nothing is
              invented.
            </p>
          ) : null}
          <ul className="fo-gm-list">
            {(flightStatus?.updates || []).map((u, i) => (
              <li key={i} className="fo-gm-item">
                <p className="fo-gm-row__title">{String(u.dataStatus || u.status)}</p>
                {u.reason ? <p className="fo-gm-row__meta">{String(u.reason)}</p> : null}
              </li>
            ))}
          </ul>
          {(liveUpdates?.items || []).length > 0 ? (
            <div>
              <p className="fo-gm-subhead">Verified booking changes</p>
              <ul className="fo-gm-list">
                {liveUpdates!.items.slice(0, 8).map((t) => (
                  <li key={String(t.id)} className="fo-gm-item">
                    <p className="fo-gm-row__meta">
                      {String(t.fromStatus || "—")} → {String(t.toStatus)} ·{" "}
                      {t.createdAt ? new Date(String(t.createdAt)).toLocaleString() : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection
          title="Shared documents"
          hint="Private vault files stay private until you share them with this group."
        >
          {(documents?.items || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No documents shared</p>
              <p className="fo-gm-empty__body">
                Share a vault document ID, or open Vault to manage files first.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {documents!.items.map((d) => (
                <li key={String(d.shareId)} className="fo-gm-item">
                  {String((d.document as { title?: string })?.title || d.label || "Document")}
                </li>
              ))}
            </ul>
          )}
          <div className="fo-gm-form fo-gm-form--row">
            <Input
              label="Vault document ID"
              value={vaultDocId}
              onChange={(e) => setVaultDocId(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                try {
                  await shareDoc({ groupId, vaultDocumentId: vaultDocId.trim() }).unwrap();
                  setVaultDocId("");
                  setLocalMsg("Document shared with group.");
                } catch {
                  setLocalMsg("Share failed — you must own the vault document.");
                }
              }}
            >
              Share from Vault
            </Button>
          </div>
          <Link href="/vault" className="fo-gm-link">
            Open Vault
          </Link>
        </DeskSection>

        <DeskSection title="Announcements">
          {(announcements || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No announcements yet</p>
              <p className="fo-gm-empty__body">
                Organizers can post updates and emergency broadcasts here.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(announcements || []).map((a) => (
                <li
                  key={a.id}
                  className={
                    a.isEmergency
                      ? "fo-gm-item fo-gm-item--boxed fo-gm-item--emergency"
                      : "fo-gm-item"
                  }
                >
                  {a.isEmergency ? <p className="fo-gm-emergency-label">Emergency</p> : null}
                  <p>{a.body}</p>
                  <p className="fo-gm-row__meta">{new Date(a.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
          {isOrganizer ? (
            <div className="fo-gm-form">
              <Input label="Announcement" value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await announce({ groupId, body: annBody }).unwrap();
                  setAnnBody("");
                }}
              >
                Post
              </Button>
              <Input
                label="Emergency broadcast"
                value={emBody}
                onChange={(e) => setEmBody(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Send emergency broadcast to all members on APP/EMAIL/WhatsApp?",
                    )
                  ) {
                    return;
                  }
                  await emergency({ groupId, body: emBody }).unwrap();
                  setEmBody("");
                  setLocalMsg("Emergency broadcast sent.");
                }}
              >
                Send emergency
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Polls">
          {(polls || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No polls yet</p>
              <p className="fo-gm-empty__body">
                Use a poll when the group needs a quick decision.
              </p>
            </div>
          ) : (
            (polls || []).map((p) => (
              <div key={p.id} className="fo-gm-item">
                <p className="fo-gm-row__title">{p.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(p.options || []).map((opt, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      size="sm"
                      variant={p.myOptionIndex === idx ? "primary" : "secondary"}
                      onClick={() => void vote({ groupId, pollId: p.id, optionIndex: idx })}
                    >
                      {opt} ({p.voteCounts?.[String(idx)] || 0})
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
          {isOrganizer ? (
            <div className="fo-gm-form">
              <Input label="Question" value={pollQ} onChange={(e) => setPollQ(e.target.value)} />
              <Input
                label="Options (comma-separated)"
                value={pollOpts}
                onChange={(e) => setPollOpts(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  const options = pollOpts
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  await createPoll({ groupId, question: pollQ, options }).unwrap();
                  setPollQ("");
                }}
              >
                Create poll
              </Button>
            </div>
          ) : null}
        </DeskSection>

        <DeskSection title="Attendance">
          {(attendance?.waypoints || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No waypoints yet</p>
              <p className="fo-gm-empty__body">
                Organizers add meeting points so travelers can check in on site.
              </p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {attendance!.waypoints.map((w) => (
                <li key={w.id} className="fo-gm-inline">
                  <span>{w.label}</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void markAtt({ groupId, waypointId: w.id, status: "PRESENT" })}
                  >
                    Check in
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {isOrganizer ? (
            <div className="fo-gm-form fo-gm-form--row">
              <Input
                label="Waypoint label"
                value={waypointLabel}
                onChange={(e) => setWaypointLabel(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await createWp({ groupId, label: waypointLabel }).unwrap();
                  setWaypointLabel("");
                }}
              >
                Add waypoint
              </Button>
            </div>
          ) : null}
          <p className="fo-gm-section__hint">Scope: {attendance?.scope || "—"}</p>
        </DeskSection>

        <DeskSection title="Photo gallery">
          {!photos?.storage?.canUpload ? (
            <p className="fo-gm-section__hint">
              Photo storage is not configured on the server (Vault local storage required).
            </p>
          ) : null}
          {(photos?.items || []).length === 0 ? (
            <div className="fo-gm-empty">
              <p className="fo-gm-empty__title">No photos yet</p>
              <p className="fo-gm-empty__body">Upload a JPEG, PNG, or WebP when storage is ready.</p>
            </div>
          ) : (
            <ul className="fo-gm-list">
              {(photos?.items || []).map((p) => (
                <li key={String(p.id)} className="fo-gm-item">
                  {String(p.caption || "Photo")} · {String(p.contentType)} · {String(p.byteSize)}{" "}
                  bytes
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="fo-gm-file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const buf = await file.arrayBuffer();
              const bytes = new Uint8Array(buf);
              let binary = "";
              for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
              const contentBase64 = btoa(binary);
              try {
                await uploadPhoto({
                  groupId,
                  contentBase64,
                  contentType: file.type,
                  caption: file.name,
                }).unwrap();
                setLocalMsg("Photo uploaded.");
              } catch {
                setLocalMsg("Photo upload failed.");
              }
            }}
          />
        </DeskSection>

        <DeskSection title="Trip memories">
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              try {
                const m = await genMemory(groupId).unwrap();
                setLocalMsg(
                  m.status === "INSUFFICIENT_DATA"
                    ? "Not enough group activity for a memory yet."
                    : "Memory generated from attributed data.",
                );
              } catch {
                setLocalMsg("Could not generate memory.");
              }
            }}
          >
            Generate trip memory
          </Button>
          <ul className="fo-gm-list">
            {(memories || []).map((m) => (
              <li key={m.id} className="fo-gm-item fo-gm-item--boxed">
                <p className="fo-gm-row__title">{m.title}</p>
                <p className="whitespace-pre-wrap text-[13px] text-ink-soft">{m.body}</p>
                <p className="fo-gm-row__meta">{m.status}</p>
              </li>
            ))}
          </ul>
        </DeskSection>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={async () => {
          if (!window.confirm("Leave this group? Shared content access ends going forward.")) return;
          await leave(groupId);
          window.location.href = "/groups";
        }}
      >
        Leave group
      </Button>

      <p className="fo-gm-footer">
        Ask Ava about this group in{" "}
        <Link href="/chat" className="fo-gm-link">
          chat
        </Link>
        .
      </p>
    </div>
  );
}
