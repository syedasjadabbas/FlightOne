"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BookMarked,
  CheckCircle2,
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
  X,
} from "lucide-react";
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
import { apiErrorMessage } from "@/lib/api/apiErrorMessage";
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

type GroupToastMsg = {
  text: string;
  error?: boolean;
};

function GroupToast({
  msg,
  onClose,
}: {
  msg: GroupToastMsg | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(t);
  }, [msg, onClose]);

  if (!msg) return null;

  return (
    <div className="fo-gm-toast-container" role="status" aria-live="polite">
      <div
        className={`fo-gm-toast ${
          msg.error ? "fo-gm-toast--error" : "fo-gm-toast--ok"
        }`}
      >
        <div className="fo-gm-toast-icon" aria-hidden>
          {msg.error ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
        <div className="fo-gm-toast-content">
          <p className="fo-gm-toast-title">
            {msg.error ? "Action Failed" : "Action Completed"}
          </p>
          <p className="fo-gm-toast-text">{msg.text}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="fo-gm-toast-close"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function GroupDetailClient({ groupId }: { groupId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data: group, isLoading, isError, error, refetch } = useGetGroupQuery(groupId, { skip });
  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = useListMembersQuery(groupId, { skip });
  const { data: announcements, isLoading: announcementsLoading, refetch: refetchAnnouncements } = useListAnnouncementsQuery(groupId, { skip });
  const { data: polls, isLoading: pollsLoading, refetch: refetchPolls } = useListPollsQuery(groupId, { skip });
  const { data: itinerary, isLoading: itineraryLoading, refetch: refetchItinerary } = useGetItineraryQuery(groupId, { skip });
  const { data: flightStatus, isLoading: flightStatusLoading, refetch: refetchFlightStatus } = useGetFlightStatusQuery(groupId, { skip });
  const { data: liveUpdates, refetch: refetchLiveUpdates } = useGetLiveUpdatesQuery(groupId, { skip });
  const { data: documents, isLoading: documentsLoading, refetch: refetchDocuments } = useListGroupDocumentsQuery(groupId, { skip });
  const { data: attendance, isLoading: attendanceLoading, refetch: refetchAttendance } = useListAttendanceQuery(groupId, { skip });
  const { data: photos, isLoading: photosLoading, refetch: refetchPhotos } = useListPhotosQuery(groupId, { skip });
  const { data: memories, isLoading: memoriesLoading, refetch: refetchMemories } = useListMemoriesQuery(groupId, { skip });

  const [inviteEmail, setInviteEmail] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [emBody, setEmBody] = useState("");
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState("Yes, No");
  const [bookingId, setBookingId] = useState("");
  const [vaultDocId, setVaultDocId] = useState("");
  const [waypointLabel, setWaypointLabel] = useState("");
  const [localMsg, setLocalMsg] = useState<GroupToastMsg | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [votingKey, setVotingKey] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [sectionAlerts, setSectionAlerts] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

  function setSectionFeedback(sectionKey: string, text: string, type: "success" | "error" = "success") {
    setSectionAlerts((prev) => ({ ...prev, [sectionKey]: { type, text } }));
    setLocalMsg({ text, error: type === "error" });
  }

  const [invite, { isLoading: isInviting }] = useInviteMemberMutation();
  const [announce, { isLoading: isAnnouncing }] = useCreateAnnouncementMutation();
  const [emergency, { isLoading: isSendingEmergency }] = useCreateEmergencyMutation();
  const [createPoll, { isLoading: isCreatingPoll }] = useCreatePollMutation();
  const [vote] = useVotePollMutation();
  const [shareBooking, { isLoading: isSharingBooking }] = useShareBookingMutation();
  const [shareDoc, { isLoading: isSharingDoc }] = useShareDocumentMutation();
  const [createWp, { isLoading: isCreatingWp }] = useCreateWaypointMutation();
  const [markAtt] = useMarkAttendanceMutation();
  const [uploadPhoto] = useUploadPhotoMutation();
  const [genMemory, { isLoading: isGeneratingMemory }] = useGenerateMemoryMutation();
  const [leave, { isLoading: isLeaving }] = useLeaveGroupMutation();

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
      <GroupToast msg={localMsg} onClose={() => setLocalMsg(null)} />

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
            <p
              className={`fo-gm-msg ${localMsg.error ? "fo-gm-msg--danger" : ""}`}
              role="status"
            >
              {localMsg.text}
            </p>
          ) : null}
        </div>
      </header>

      <div className="fo-gm-ledger">
        {/* MEMBERS SECTION */}
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
                  <span>{m.displayName || m.email || m.userId.slice(0, 8)}</span>
                  <span className="fo-gm-inline__muted">
                    {m.role} · {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {isOrganizer ? (
            <div className="fo-gm-form">
              <div className="fo-gm-form--row">
                <Input
                  label="Invite by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  disabled={isInviting}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isInviting || !inviteEmail.trim()}
                  icon={isInviting ? <Spinner size="sm" /> : undefined}
                  onClick={async () => {
                    if (!inviteEmail.trim()) {
                      setSectionFeedback("members", "Please enter an email address.", "error");
                      return;
                    }
                    try {
                      await invite({ groupId, email: inviteEmail.trim() }).unwrap();
                      const sentEmail = inviteEmail.trim();
                      setInviteEmail("");
                      await refetchMembers();
                      setSectionFeedback("members", `Invitation successfully sent to ${sentEmail}.`);
                    } catch (err) {
                      setSectionFeedback("members", apiErrorMessage(err, "Invite failed."), "error");
                    }
                  }}
                >
                  {isInviting ? "Inviting…" : "Invite"}
                </Button>
              </div>
              {sectionAlerts["members"] ? (
                <div
                  className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["members"].type}`}
                  role="status"
                >
                  {sectionAlerts["members"].type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{sectionAlerts["members"].text}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </GroupSection>

        {/* SHARED ITINERARY SECTION */}
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
          <div className="fo-gm-form">
            <div className="fo-gm-form--row">
              <Input
                label="Your booking ID"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="e.g. bk_9214a7ff"
                disabled={isSharingBooking}
              />
              <Button
                type="button"
                size="sm"
                disabled={isSharingBooking || !bookingId.trim()}
                icon={isSharingBooking ? <Spinner size="sm" /> : undefined}
                onClick={async () => {
                  if (!bookingId.trim()) {
                    setSectionFeedback("itinerary", "Please enter your booking ID.", "error");
                    return;
                  }
                  try {
                    await shareBooking({ groupId, bookingId: bookingId.trim() }).unwrap();
                    setBookingId("");
                    await refetchItinerary();
                    setSectionFeedback("itinerary", "Booking successfully shared with group itinerary.");
                  } catch (err) {
                    setSectionFeedback(
                      "itinerary",
                      apiErrorMessage(err, "Could not share booking (must be owned by you)."),
                      "error",
                    );
                  }
                }}
              >
                {isSharingBooking ? "Sharing…" : "Share"}
              </Button>
            </div>
            {sectionAlerts["itinerary"] ? (
              <div
                className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["itinerary"].type}`}
                role="status"
              >
                {sectionAlerts["itinerary"].type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{sectionAlerts["itinerary"].text}</span>
              </div>
            ) : null}
          </div>
        </GroupSection>

        {/* FLIGHT STATUS SECTION */}
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

        {/* SHARED DOCUMENTS SECTION */}
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
          <div className="fo-gm-form">
            <div className="fo-gm-form--row">
              <Input
                label="Vault document ID"
                value={vaultDocId}
                onChange={(e) => setVaultDocId(e.target.value)}
                placeholder="e.g. doc_1849f2b"
                disabled={isSharingDoc}
              />
              <Button
                type="button"
                size="sm"
                disabled={isSharingDoc || !vaultDocId.trim()}
                icon={isSharingDoc ? <Spinner size="sm" /> : undefined}
                onClick={async () => {
                  if (!vaultDocId.trim()) {
                    setSectionFeedback("documents", "Please enter a Vault document ID.", "error");
                    return;
                  }
                  try {
                    await shareDoc({ groupId, vaultDocumentId: vaultDocId.trim() }).unwrap();
                    setVaultDocId("");
                    await refetchDocuments();
                    setSectionFeedback("documents", "Document successfully shared with group.");
                  } catch (err) {
                    setSectionFeedback(
                      "documents",
                      apiErrorMessage(err, "Share failed — you must own the vault document."),
                      "error",
                    );
                  }
                }}
              >
                {isSharingDoc ? "Sharing…" : "Share from Vault"}
              </Button>
            </div>
            {sectionAlerts["documents"] ? (
              <div
                className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["documents"].type}`}
                role="status"
              >
                {sectionAlerts["documents"].type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{sectionAlerts["documents"].text}</span>
              </div>
            ) : null}
          </div>
          <Link href="/vault" className="fo-gm-link fo-gm-link--action mt-3">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Open Vault
          </Link>
        </GroupSection>

        {/* ANNOUNCEMENTS SECTION */}
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
            <div className="fo-gm-form space-y-4">
              <div className="space-y-2">
                <Input
                  label="Announcement"
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Team briefing at 09:00 in lobby"
                  disabled={isAnnouncing}
                />
                <div className="pt-1.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isAnnouncing || !annBody.trim()}
                    icon={isAnnouncing ? <Spinner size="sm" /> : undefined}
                    onClick={async () => {
                      if (!annBody.trim()) {
                        setSectionFeedback("announcements", "Please enter announcement text.", "error");
                        return;
                      }
                      try {
                        await announce({ groupId, body: annBody.trim() }).unwrap();
                        setAnnBody("");
                        await refetchAnnouncements();
                        setSectionFeedback("announcements", "Announcement posted successfully.");
                      } catch (err) {
                        setSectionFeedback(
                          "announcements",
                          apiErrorMessage(err, "Could not post announcement."),
                          "error",
                        );
                      }
                    }}
                  >
                    {isAnnouncing ? "Posting…" : "Post"}
                  </Button>
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-black/5">
                <Input
                  label="Emergency broadcast"
                  value={emBody}
                  onChange={(e) => setEmBody(e.target.value)}
                  placeholder="Urgent flight/gate relocation notice"
                  disabled={isSendingEmergency}
                />
                <div className="pt-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isSendingEmergency || !emBody.trim()}
                    icon={isSendingEmergency ? <Spinner size="sm" /> : undefined}
                    onClick={async () => {
                      if (!emBody.trim()) {
                        setSectionFeedback("announcements", "Please enter emergency broadcast text.", "error");
                        return;
                      }
                      if (
                        !window.confirm(
                          "Send emergency broadcast to all members on APP/EMAIL/WhatsApp?",
                        )
                      ) {
                        return;
                      }
                      try {
                        await emergency({ groupId, body: emBody.trim() }).unwrap();
                        setEmBody("");
                        await refetchAnnouncements();
                        setSectionFeedback(
                          "announcements",
                          "Emergency broadcast dispatched to all member channels.",
                        );
                      } catch (err) {
                        setSectionFeedback(
                          "announcements",
                          apiErrorMessage(err, "Could not send emergency broadcast."),
                          "error",
                        );
                      }
                    }}
                  >
                    {isSendingEmergency ? "Sending broadcast…" : "Send emergency"}
                  </Button>
                </div>
              </div>

              {sectionAlerts["announcements"] ? (
                <div
                  className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["announcements"].type}`}
                  role="status"
                >
                  {sectionAlerts["announcements"].type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{sectionAlerts["announcements"].text}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </GroupSection>

        {/* POLLS SECTION */}
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
                  {(p.options || []).map((opt, idx) => {
                    const voteKey = `${p.id}-${idx}`;
                    const isVotingThis = votingKey === voteKey;
                    return (
                      <Button
                        key={idx}
                        type="button"
                        size="sm"
                        variant={p.myOptionIndex === idx ? "primary" : "secondary"}
                        disabled={isVotingThis}
                        icon={isVotingThis ? <Spinner size="sm" /> : undefined}
                        onClick={async () => {
                          setVotingKey(voteKey);
                          try {
                            await vote({ groupId, pollId: p.id, optionIndex: idx }).unwrap();
                            await refetchPolls();
                            setSectionFeedback("polls", `Vote recorded for “${opt}”.`);
                          } catch (err) {
                            setSectionFeedback(
                              "polls",
                              apiErrorMessage(err, "Could not record vote."),
                              "error",
                            );
                          } finally {
                            setVotingKey(null);
                          }
                        }}
                      >
                        {isVotingThis
                          ? "Recording…"
                          : `${opt} (${p.voteCounts?.[String(idx)] || 0})`}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          {isOrganizer ? (
            <div className="fo-gm-form space-y-2.5">
              <Input
                label="Question"
                value={pollQ}
                onChange={(e) => setPollQ(e.target.value)}
                placeholder="e.g. Which dinner slot works best?"
                disabled={isCreatingPoll}
              />
              <Input
                label="Options (comma-separated)"
                value={pollOpts}
                onChange={(e) => setPollOpts(e.target.value)}
                placeholder="19:00, 20:30, 21:00"
                disabled={isCreatingPoll}
              />
              <div className="pt-1.5">
                <Button
                  type="button"
                  size="sm"
                  disabled={isCreatingPoll || !pollQ.trim()}
                  icon={isCreatingPoll ? <Spinner size="sm" /> : undefined}
                  onClick={async () => {
                    if (!pollQ.trim()) {
                      setSectionFeedback("polls", "Please enter a poll question.", "error");
                      return;
                    }
                    const options = pollOpts
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (options.length < 2) {
                      setSectionFeedback(
                        "polls",
                        "Please provide at least 2 comma-separated options.",
                        "error",
                      );
                      return;
                    }
                    try {
                      await createPoll({ groupId, question: pollQ.trim(), options }).unwrap();
                      setPollQ("");
                      setPollOpts("Yes, No");
                      await refetchPolls();
                      setSectionFeedback("polls", "Poll created successfully.");
                    } catch (err) {
                      setSectionFeedback(
                        "polls",
                        apiErrorMessage(err, "Could not create poll."),
                        "error",
                      );
                    }
                  }}
                >
                  {isCreatingPoll ? "Creating poll…" : "Create poll"}
                </Button>
              </div>
              {sectionAlerts["polls"] ? (
                <div
                  className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["polls"].type}`}
                  role="status"
                >
                  {sectionAlerts["polls"].type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{sectionAlerts["polls"].text}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </GroupSection>

        {/* ATTENDANCE SECTION */}
        <GroupSection icon={MapPinned} title="Attendance" loading={attendanceLoading}>
          {(attendance?.waypoints || []).length === 0 ? (
            <GroupEmpty
              icon={MapPinned}
              title="No waypoints yet"
              body="Organizers add meeting points so travelers can check in on site."
            />
          ) : (
            <ul className="fo-gm-list">
              {attendance!.waypoints.map((w) => {
                const isCheckingInThis = checkingInId === w.id;
                return (
                  <li key={w.id} className="fo-gm-inline">
                    <span>{w.label}</span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isCheckingInThis}
                      icon={isCheckingInThis ? <Spinner size="sm" /> : undefined}
                      onClick={async () => {
                        setCheckingInId(w.id);
                        try {
                          await markAtt({ groupId, waypointId: w.id, status: "PRESENT" }).unwrap();
                          await refetchAttendance();
                          setSectionFeedback("attendance", `Checked in at “${w.label}”.`);
                        } catch (err) {
                          setSectionFeedback(
                            "attendance",
                            apiErrorMessage(err, "Could not check in."),
                            "error",
                          );
                        } finally {
                          setCheckingInId(null);
                        }
                      }}
                    >
                      {isCheckingInThis ? "Checking in…" : "Check in"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {isOrganizer ? (
            <div className="fo-gm-form">
              <div className="fo-gm-form--row">
                <Input
                  label="Waypoint label"
                  value={waypointLabel}
                  onChange={(e) => setWaypointLabel(e.target.value)}
                  placeholder="Gate A4 Gathering Point"
                  disabled={isCreatingWp}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isCreatingWp || !waypointLabel.trim()}
                  icon={isCreatingWp ? <Spinner size="sm" /> : undefined}
                  onClick={async () => {
                    if (!waypointLabel.trim()) {
                      setSectionFeedback("attendance", "Please enter a waypoint label.", "error");
                      return;
                    }
                    try {
                      await createWp({ groupId, label: waypointLabel.trim() }).unwrap();
                      const label = waypointLabel.trim();
                      setWaypointLabel("");
                      await refetchAttendance();
                      setSectionFeedback("attendance", `Waypoint “${label}” added.`);
                    } catch (err) {
                      setSectionFeedback(
                        "attendance",
                        apiErrorMessage(err, "Could not add waypoint."),
                        "error",
                      );
                    }
                  }}
                >
                  {isCreatingWp ? "Adding…" : "Add waypoint"}
                </Button>
              </div>
              {sectionAlerts["attendance"] ? (
                <div
                  className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["attendance"].type}`}
                  role="status"
                >
                  {sectionAlerts["attendance"].type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{sectionAlerts["attendance"].text}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="fo-gm-section__hint">Scope: {attendance?.scope || "—"}</p>
        </GroupSection>

        {/* PHOTO GALLERY SECTION */}
        <GroupSection icon={Images} title="Photo gallery" loading={photosLoading}>
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
          <div className="fo-gm-form">
            <label className="fo-gm-file-label">
              <span className="fo-gm-file-label__text">
                {photoBusy ? "Uploading photo…" : "Choose photo"}
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
                    await refetchPhotos();
                    setSectionFeedback("photos", `Photo “${file.name}” uploaded to gallery.`);
                  } catch (err) {
                    setSectionFeedback(
                      "photos",
                      apiErrorMessage(err, "Photo upload failed."),
                      "error",
                    );
                  } finally {
                    setPhotoBusy(false);
                  }
                }}
              />
            </label>
            {sectionAlerts["photos"] ? (
              <div
                className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["photos"].type}`}
                role="status"
              >
                {sectionAlerts["photos"].type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{sectionAlerts["photos"].text}</span>
              </div>
            ) : null}
          </div>
        </GroupSection>

        {/* TRIP MEMORIES SECTION */}
        <GroupSection icon={BookMarked} title="Trip memories" loading={memoriesLoading}>
          <div className="fo-gm-form">
            <Button
              type="button"
              size="sm"
              disabled={isGeneratingMemory}
              icon={isGeneratingMemory ? <Spinner size="sm" /> : undefined}
              onClick={async () => {
                try {
                  const m = await genMemory(groupId).unwrap();
                  await refetchMemories();
                  setSectionFeedback(
                    "memories",
                    m.status === "INSUFFICIENT_DATA"
                      ? "Not enough group activity for a memory summary yet."
                      : "Memory generated successfully from group events.",
                  );
                } catch (err) {
                  setSectionFeedback(
                    "memories",
                    apiErrorMessage(err, "Could not generate memory."),
                    "error",
                  );
                }
              }}
            >
              {isGeneratingMemory ? "Generating memory…" : "Generate trip memory"}
            </Button>
            {sectionAlerts["memories"] ? (
              <div
                className={`fo-gm-inline-alert fo-gm-inline-alert--${sectionAlerts["memories"].type}`}
                role="status"
              >
                {sectionAlerts["memories"].type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{sectionAlerts["memories"].text}</span>
              </div>
            ) : null}
          </div>
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
          disabled={isLeaving}
          icon={isLeaving ? <Spinner size="sm" /> : <LogOut className="h-3.5 w-3.5" aria-hidden />}
          onClick={async () => {
            if (!window.confirm("Leave this group? Shared content access ends going forward.")) {
              return;
            }
            try {
              await leave(groupId).unwrap();
              setLocalMsg({ text: "Left group successfully.", error: false });
              window.location.href = "/groups";
            } catch (err) {
              setLocalMsg({
                text: apiErrorMessage(err, "Could not leave the group. Try again."),
                error: true,
              });
            }
          }}
        >
          {isLeaving ? "Leaving group…" : "Leave group"}
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
