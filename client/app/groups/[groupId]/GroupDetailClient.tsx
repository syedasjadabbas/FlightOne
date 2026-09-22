"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookMarked,
  FileText,
  Images,
  LogOut,
  MapPinned,
  Megaphone,
  MessageCircle,
  Plane,
  Radio,
  Users,
  Vote,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
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
import { GroupEmpty } from "./_components/GroupEmpty";
import { GroupInviteCode } from "./_components/GroupInviteCode";
import { GroupSection } from "./_components/GroupSection";
import {
  GroupChip,
  GroupLoadError,
  GroupLoading,
  GroupSignInPrompt,
} from "./_components/GroupStatusShell";
import "../groups.css";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function GroupDetailClient({ groupId }: { groupId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data: group, isLoading, isError, error, refetch } = useGetGroupQuery(groupId, { skip });
  const { data: members, isLoading: membersLoading } = useListMembersQuery(groupId, { skip });
  const { data: announcements, isLoading: announcementsLoading } = useListAnnouncementsQuery(groupId, { skip });
  const { data: polls, isLoading: pollsLoading } = useListPollsQuery(groupId, { skip });
  const { data: itinerary, isLoading: itineraryLoading } = useGetItineraryQuery(groupId, { skip });
  const { data: flightStatus, isLoading: flightStatusLoading } = useGetFlightStatusQuery(groupId, { skip });
  const { data: liveUpdates } = useGetLiveUpdatesQuery(groupId, { skip });
  const { data: documents, isLoading: documentsLoading } = useListGroupDocumentsQuery(groupId, { skip });
  const { data: attendance, isLoading: attendanceLoading } = useListAttendanceQuery(groupId, { skip });
  const { data: photos, isLoading: photosLoading } = useListPhotosQuery(groupId, { skip });
  const { data: memories, isLoading: memoriesLoading } = useListMemoriesQuery(groupId, { skip });

  const [inviteEmail, setInviteEmail] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [emBody, setEmBody] = useState("");
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState("Yes, No");
  const [bookingId, setBookingId] = useState("");
  const [vaultDocId, setVaultDocId] = useState("");
  const [waypointLabel, setWaypointLabel] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

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

  if (!hasHydrated) return <GroupLoading />;
  if (!accessToken) return <GroupSignInPrompt redirectPath={`/groups/${groupId}`} />;
  if (isLoading) return <GroupLoading />;
  if (isError || !group) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : null;
    return (
      <GroupLoadError forbidden={status === 403} onRetry={() => void refetch()} />
    );
  }

  const memberCount = (members || []).length;
  const typeLabel = group.type.replace(/_/g, " ");

  return (
    <div className="fo-gm-page">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <Link href="/groups" className="fo-gm-back fo-gm-back--icon">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Groups
          </Link>
          <p className="fo-gm-kicker">Trip group</p>
          <h1 className="fo-gm-title">{group.name}</h1>
          <div className="fo-gm-meta fo-gm-meta--chips">
            <GroupChip>{typeLabel}</GroupChip>
            {memberCount > 0 ? (
              <GroupChip>
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </GroupChip>
            ) : null}
            {isOrganizer ? <GroupChip tone="accent">Organizer</GroupChip> : null}
          </div>
          <GroupInviteCode code={group.inviteCode} />
          {localMsg ? (
            <p className="fo-gm-msg" role="status">
              {localMsg}
            </p>
          ) : null}
        </div>
      </header>

      <div className="fo-gm-ledger">
        <GroupSection icon={Users} title="Members" loading={membersLoading}>
          {(members || []).length === 0 ? (
            <GroupEmpty
              icon={Users}
              title="No members listed"
              body="Invite travelers by email when you’re ready."
            />
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
        </GroupSection>

        <GroupSection
          icon={Plane}
          title="Shared itinerary"
          hint="Share a ticketed booking you own so the group sees the same flight plan."
          loading={itineraryLoading}
        >
          {(itinerary?.items || []).length === 0 ? (
            <GroupEmpty
              icon={Plane}
              title="No shared bookings yet"
              body="Paste a booking ID you own to add it to the group itinerary."
            />
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
                        .join(" · ") || "Booking linked"}
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
        </GroupSection>

        <GroupSection icon={Radio} title="Flight status" loading={flightStatusLoading}>
          {!flightStatus?.capability?.canPollLive ? (
            <p className="fo-gm-section__hint">
              Live status unavailable:{" "}
              {flightStatus?.capability?.reasons?.[0] || "provider unconfigured"}. Nothing is
              invented.
            </p>
          ) : null}
          {(flightStatus?.updates || []).length === 0 &&
          (liveUpdates?.items || []).length === 0 ? (
            <GroupEmpty
              icon={Radio}
              title="No status updates"
              body="Verified changes from linked bookings will appear here."
            />
          ) : (
            <>
              <ul className="fo-gm-list">
                {(flightStatus?.updates || []).map((u, i) => (
                  <li key={i} className="fo-gm-item">
                    <p className="fo-gm-row__title">{String(u.dataStatus || u.status)}</p>
                    {u.reason ? <p className="fo-gm-row__meta">{String(u.reason)}</p> : null}
                  </li>
                ))}
              </ul>
              {(liveUpdates?.items || []).length > 0 ? (
                <div className="fo-gm-stack">
                  <p className="fo-gm-subhead">Verified booking changes</p>
                  <ul className="fo-gm-list">
                    {liveUpdates!.items.slice(0, 8).map((t) => (
                      <li key={String(t.id)} className="fo-gm-item">
                        <p className="fo-gm-row__meta">
                          {String(t.fromStatus || "—")} → {String(t.toStatus)}
                          {t.createdAt
                            ? ` · ${new Date(String(t.createdAt)).toLocaleString()}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </GroupSection>

        <GroupSection
          icon={FileText}
          title="Shared documents"
          hint="Vault files stay private until you share them with this group."
          loading={documentsLoading}
        >
          {(documents?.items || []).length === 0 ? (
            <GroupEmpty
              icon={FileText}
              title="No documents shared"
              body="Share a vault document ID, or open Vault to manage files first."
            />
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
          <Link href="/vault" className="fo-gm-link fo-gm-link--action">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Open Vault
          </Link>
        </GroupSection>

        <GroupSection icon={Megaphone} title="Announcements" loading={announcementsLoading}>
          {(announcements || []).length === 0 ? (
            <GroupEmpty
              icon={Megaphone}
              title="No announcements yet"
              body="Organizers can post updates and emergency broadcasts here."
            />
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
              <Input
                label="Announcement"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    await announce({ groupId, body: annBody }).unwrap();
                    setAnnBody("");
                    setLocalMsg("Announcement posted.");
                  } catch {
                    setLocalMsg("Could not post announcement.");
                  }
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
                  try {
                    await emergency({ groupId, body: emBody }).unwrap();
                    setEmBody("");
                    setLocalMsg("Emergency broadcast sent.");
                  } catch {
                    setLocalMsg("Could not send emergency broadcast.");
                  }
                }}
              >
                Send emergency
              </Button>
            </div>
          ) : null}
        </GroupSection>

        <GroupSection icon={Vote} title="Polls" loading={pollsLoading}>
          {(polls || []).length === 0 ? (
            <GroupEmpty
              icon={Vote}
              title="No polls yet"
              body="Use a poll when the group needs a quick decision."
            />
          ) : (
            (polls || []).map((p) => (
              <div key={p.id} className="fo-gm-item">
                <p className="fo-gm-row__title">{p.question}</p>
                <div className="fo-gm-poll-options">
                  {(p.options || []).map((opt, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      size="sm"
                      variant={p.myOptionIndex === idx ? "primary" : "secondary"}
                      onClick={async () => {
                        try {
                          await vote({ groupId, pollId: p.id, optionIndex: idx }).unwrap();
                          setLocalMsg("Vote recorded.");
                        } catch {
                          setLocalMsg("Could not record vote.");
                        }
                      }}
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
                  try {
                    await createPoll({ groupId, question: pollQ, options }).unwrap();
                    setPollQ("");
                    setLocalMsg("Poll created.");
                  } catch {
                    setLocalMsg("Could not create poll.");
                  }
                }}
              >
                Create poll
              </Button>
            </div>
          ) : null}
        </GroupSection>

        <GroupSection icon={MapPinned} title="Attendance" loading={attendanceLoading}>
          {(attendance?.waypoints || []).length === 0 ? (
            <GroupEmpty
              icon={MapPinned}
              title="No waypoints yet"
              body="Organizers add meeting points so travelers can check in on site."
            />
          ) : (
            <ul className="fo-gm-list">
              {attendance!.waypoints.map((w) => (
                <li key={w.id} className="fo-gm-inline">
                  <span>{w.label}</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      try {
                        await markAtt({ groupId, waypointId: w.id, status: "PRESENT" }).unwrap();
                        setLocalMsg(`Checked in at ${w.label}.`);
                      } catch {
                        setLocalMsg("Could not check in.");
                      }
                    }}
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
                  try {
                    await createWp({ groupId, label: waypointLabel }).unwrap();
                    setWaypointLabel("");
                    setLocalMsg("Waypoint added.");
                  } catch {
                    setLocalMsg("Could not add waypoint.");
                  }
                }}
              >
                Add waypoint
              </Button>
            </div>
          ) : null}
          <p className="fo-gm-section__hint">Scope: {attendance?.scope || "—"}</p>
        </GroupSection>

        <GroupSection icon={Images} title="Photo gallery">
          {!photos?.storage?.canUpload ? (
            <p className="fo-gm-section__hint">
              Photo storage is not configured on the server (Vault local storage required).
            </p>
          ) : null}
          {(photos?.items || []).length === 0 ? (
            <GroupEmpty
              icon={Images}
              title="No photos yet"
              body="Upload a JPEG, PNG, or WebP when storage is ready."
            />
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
          <label className="fo-gm-file-label">
            <span className="fo-gm-file-label__text">
              {photoBusy ? "Uploading…" : "Choose photo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="fo-gm-file"
              disabled={photoBusy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setPhotoBusy(true);
                try {
                  const contentBase64 = await fileToBase64(file);
                  await uploadPhoto({
                    groupId,
                    contentBase64,
                    contentType: file.type,
                    caption: file.name,
                  }).unwrap();
                  setLocalMsg("Photo uploaded.");
                } catch {
                  setLocalMsg("Photo upload failed.");
                } finally {
                  setPhotoBusy(false);
                }
              }}
            />
          </label>
        </GroupSection>

        <GroupSection icon={BookMarked} title="Trip memories">
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
          {(memories || []).length === 0 ? (
            <GroupEmpty
              icon={BookMarked}
              title="No memories yet"
              body="Generate a summary when the group has enough attributed activity."
            />
          ) : (
            <ul className="fo-gm-list">
              {(memories || []).map((m) => (
                <li key={m.id} className="fo-gm-item fo-gm-item--boxed">
                  <p className="fo-gm-row__title">{m.title}</p>
                  <p className="fo-gm-memory-body">{m.body}</p>
                  <p className="fo-gm-row__meta">{m.status}</p>
                </li>
              ))}
            </ul>
          )}
        </GroupSection>
      </div>

      <div className="fo-gm-footer-bar">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<LogOut className="h-3.5 w-3.5" aria-hidden />}
          onClick={async () => {
            if (!window.confirm("Leave this group? Shared content access ends going forward.")) {
              return;
            }
            try {
              await leave(groupId).unwrap();
              window.location.href = "/groups";
            } catch {
              setLocalMsg("Could not leave the group. Try again.");
            }
          }}
        >
          Leave group
        </Button>
        <p className="fo-gm-footer">
          Ask Ava about this group in{" "}
          <Link href="/chat" className="fo-gm-link fo-gm-link--inline">
            <MessageCircle className="h-3 w-3" aria-hidden />
            chat
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
