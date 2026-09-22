"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Hash,
  MessageSquareText,
  ScrollText,
  Shield,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Button, SearchableSelect } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useApplyConsultantActionMutation,
  useCancelEscalationMutation,
  useClaimEscalationMutation,
  useGetOpsEscalationQuery,
  useResolveEscalationMutation,
  useStartEscalationMutation,
  type EscalationResolutionOutcome,
} from "@/lib/api/escalations.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { OpsField, OpsStatusPill } from "../../_components";
import {
  CaseFacts,
  CaseLoadError,
  CaseLoading,
  CasePermissionGate,
  CaseSection,
  CaseSignInGate,
  CaseStatusStrip,
  CaseThread,
} from "./_components";

const OUTCOMES: EscalationResolutionOutcome[] = [
  "RESOLVED_NO_CHANGE",
  "BOOKING_CANCELLED",
  "REFUND_PROCESSED",
  "REFUND_REJECTED",
  "REBOOK_HANDED_OFF",
  "INFORMATION_PROVIDED",
  "OTHER",
];

const OUTCOME_OPTIONS = OUTCOMES.map((o) => ({
  value: o,
  label: o.replaceAll("_", " "),
}));

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function caseStatusClass(status: string): string {
  if (status === "RESOLVED" || status === "IN_PROGRESS" || status === "ASSIGNED") {
    return "fo-desk__status fo-desk__status--ok";
  }
  if (status === "OPEN" || status === "CANCELLED") {
    return "fo-desk__status fo-desk__status--warn";
  }
  return "fo-desk__status";
}

export function OpsEscalationDetailClient({ id }: { id: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { has } = usePermissions();
  const canRead = has("ops:escalations:read");
  const canRefund = has("refunds:write");

  const { data, isLoading, isError, refetch, error } = useGetOpsEscalationQuery(id, {
    skip: skip || !canRead,
  });
  const [claim, claimState] = useClaimEscalationMutation();
  const [start, startState] = useStartEscalationMutation();
  const [resolve, resolveState] = useResolveEscalationMutation();
  const [cancel, cancelState] = useCancelEscalationMutation();
  const [applyAction, actionState] = useApplyConsultantActionMutation();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<EscalationResolutionOutcome>("INFORMATION_PROVIDED");
  const [actionReason, setActionReason] = useState("");
  const [refundCaseId, setRefundCaseId] = useState("");
  const [watchId, setWatchId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [localMsg, setLocalMsg] = useState<{ text: string; error?: boolean } | null>(null);

  if (!hasHydrated) return <CaseLoading />;
  if (!accessToken) return <CaseSignInGate />;
  if (!canRead) return <CasePermissionGate />;
  if (isLoading) return <CaseLoading label="Loading escalation" />;
  if (isError || !data) {
    return (
      <CaseLoadError
        notFound={(error as { status?: number })?.status === 404}
        onRetry={() => refetch()}
      />
    );
  }

  const messages = Array.isArray(data.contextSnapshot?.messages)
    ? data.contextSnapshot!.messages!
    : [];
  const writeBackActions = Array.isArray(data.writeBackActions) ? data.writeBackActions : [];
  const canService = ["ASSIGNED", "IN_PROGRESS"].includes(data.status);
  const queueOpen = !["RESOLVED", "CANCELLED"].includes(data.status);

  async function runAction(
    actionType:
      | "CANCEL_BOOKING"
      | "REFUND_PROCESS"
      | "REFUND_REJECT"
      | "JOURNEY_REBOOK_HANDOFF",
  ) {
    setLocalMsg(null);
    try {
      const result = await applyAction({
        id,
        actionType,
        reason: actionReason.trim() || undefined,
        refundCaseId: refundCaseId.trim() || undefined,
        watchId: watchId.trim() || undefined,
        supplierOfferSnapshotId: snapshotId.trim() || undefined,
      }).unwrap();
      const st = result.action?.status;
      if (st === "EXTERNAL_DEPENDENCY" || result.providerFailure) {
        setLocalMsg({
          text: `Write-back recorded as EXTERNAL_DEPENDENCY — provider/credentials incomplete (${result.action?.error || "see action log"}). Booking/service state only advanced where the underlying op succeeded.`,
          error: true,
        });
      } else {
        setLocalMsg({ text: `Write-back ${st}: ${actionType}` });
      }
      await refetch();
    } catch {
      setLocalMsg({
        text: "Consultant action failed (permissions, assignment, or underlying service).",
        error: true,
      });
    }
  }

  const factItems = [
    { label: "Customer", value: data.userId, mono: true },
    { label: "Conversation", value: data.conversationId, mono: true },
    ...(data.bookingId
      ? [{ label: "Booking", value: data.bookingId, mono: true as const }]
      : []),
    { label: "Priority", value: String(data.priority) },
    {
      label: "Assigned",
      value: data.assignedToUserId ? (
        <span className="fo-ops-case__mono">{data.assignedToUserId}</span>
      ) : (
        "Unassigned"
      ),
    },
    ...(data.lastWriteBackAction
      ? [
          {
            label: "Last write-back",
            value: (
              <>
                {labelize(data.lastWriteBackAction)} · {data.lastWriteBackStatus}
                {data.lastWriteBackAt
                  ? ` · ${new Date(data.lastWriteBackAt).toLocaleString()}`
                  : ""}
              </>
            ),
          },
        ]
      : [{ label: "Last write-back", value: "None yet" }]),
    ...(data.resolutionOutcome
      ? [{ label: "Outcome", value: labelize(String(data.resolutionOutcome)) }]
      : []),
  ];

  const reasonDetail =
    typeof data.contextSnapshot?.reasonDetail === "string" && data.contextSnapshot.reasonDetail
      ? { label: "Reason detail", body: data.contextSnapshot.reasonDetail }
      : null;

  const poolLabel = data.routing?.pool || data.routingPool;

  return (
    <div className="fo-ops fo-ops__master-stage fo-ops-case">
      <div className="fo-ops__nav-rail">
        <span className="fo-ops__brand-badge">
          <span className="fo-ops__brand-dot" aria-hidden />
          Case
        </span>
        <Link href="/ops/escalations" className="fo-ops-case__back">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Queue
        </Link>
      </div>

      <header className="fo-ops__hero fo-ops-case__header">
        <div className="fo-ops-case__title-row">
          <h1 className="fo-ops__title">{labelize(data.trigger)}</h1>
          <div className="fo-ops-case__pills">
            <span className={caseStatusClass(data.status)}>{labelize(data.status)}</span>
            {poolLabel ? <span className="fo-desk__status">{poolLabel}</span> : null}
          </div>
        </div>
        <p className="fo-ops-case__id">
          <Hash className="h-3 w-3" strokeWidth={2} aria-hidden />
          {data.id}
        </p>
      </header>

      <CaseStatusStrip data={data} />

      <CaseSection icon={ClipboardList} title="Case facts">
        <CaseFacts items={factItems} note={reasonDetail} />
      </CaseSection>

      <PermissionGate anyOf={["ops:escalations:write"]}>
        {queueOpen ? (
          <CaseSection icon={Shield} title="Queue actions">
            <div className="fo-ops-case__actions">
              {data.status === "OPEN" ? (
                <Button
                  size="sm"
                  disabled={claimState.isLoading}
                  onClick={async () => {
                    setLocalMsg(null);
                    try {
                      await claim(id).unwrap();
                      setLocalMsg({ text: "Claimed." });
                    } catch {
                      setLocalMsg({ text: "Claim failed.", error: true });
                    }
                  }}
                >
                  {claimState.isLoading ? "Claiming…" : "Claim"}
                </Button>
              ) : null}
              {["OPEN", "ASSIGNED"].includes(data.status) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={startState.isLoading}
                  onClick={async () => {
                    setLocalMsg(null);
                    try {
                      await start(id).unwrap();
                      setLocalMsg({ text: "Marked in progress." });
                    } catch {
                      setLocalMsg({ text: "Start failed.", error: true });
                    }
                  }}
                >
                  {startState.isLoading ? "Starting…" : "Start work"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={cancelState.isLoading}
                onClick={async () => {
                  setLocalMsg(null);
                  try {
                    await cancel({ id, note: note || "Cancelled by consultant" }).unwrap();
                    setLocalMsg({ text: "Cancelled." });
                  } catch {
                    setLocalMsg({ text: "Cancel failed.", error: true });
                  }
                }}
              >
                {cancelState.isLoading ? "Cancelling…" : "Cancel"}
              </Button>
            </div>
            <div className="fo-ops-case__fields">
              <OpsField
                label="Resolution note"
                id="ops-esc-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Required to resolve"
              />
              <SearchableSelect
                label="Resolution outcome"
                options={OUTCOME_OPTIONS}
                value={outcome}
                onChange={(v) => setOutcome(v as EscalationResolutionOutcome)}
                searchable={false}
              />
              <div className="fo-ops-case__actions">
                <Button
                  size="sm"
                  disabled={resolveState.isLoading || note.trim().length < 1}
                  onClick={async () => {
                    setLocalMsg(null);
                    try {
                      await resolve({
                        id,
                        resolutionNote: note.trim(),
                        outcome,
                      }).unwrap();
                      setLocalMsg({ text: "Resolved." });
                    } catch {
                      setLocalMsg({ text: "Resolve failed.", error: true });
                    }
                  }}
                >
                  {resolveState.isLoading ? "Resolving…" : "Resolve"}
                </Button>
              </div>
            </div>
          </CaseSection>
        ) : null}

        {canService ? (
          <CaseSection
            icon={Wrench}
            title="Booking / service write-back"
            note="Uses Module 03 / 09 / 14 state machines. Assigned consultant only. Provider steps report EXTERNAL_DEPENDENCY when credentials are absent — never invents success."
          >
            <div className="fo-ops-case__fields">
              <OpsField
                label="Reason"
                id="ops-esc-action-reason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Optional"
              />
              <div className="fo-ops-case__actions">
                <Button
                  size="sm"
                  disabled={actionState.isLoading || !data.bookingId}
                  onClick={() => runAction("CANCEL_BOOKING")}
                >
                  {actionState.isLoading ? "Working…" : "Cancel booking"}
                </Button>
              </div>
              <OpsField
                label="Refund case id"
                id="ops-esc-refund-case"
                value={refundCaseId}
                onChange={(e) => setRefundCaseId(e.target.value)}
                placeholder="Or REQUIRES_HUMAN case on booking"
              />
              <div className="fo-ops-case__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionState.isLoading || !canRefund}
                  onClick={() => runAction("REFUND_PROCESS")}
                >
                  {actionState.isLoading ? "Working…" : "Process refund"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionState.isLoading || !canRefund}
                  onClick={() => runAction("REFUND_REJECT")}
                >
                  {actionState.isLoading ? "Working…" : "Reject refund"}
                </Button>
              </div>
              {!canRefund ? (
                <p className="fo-ops-case__section-note">
                  Refund write-back needs <code>refunds:write</code> in addition to escalation
                  write.
                </p>
              ) : null}
              <OpsField
                label="Journey watch id"
                id="ops-esc-watch"
                value={watchId}
                onChange={(e) => setWatchId(e.target.value)}
              />
              <OpsField
                label="Supplier offer snapshot id"
                id="ops-esc-snapshot"
                value={snapshotId}
                onChange={(e) => setSnapshotId(e.target.value)}
              />
              <div className="fo-ops-case__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionState.isLoading || !watchId.trim() || !snapshotId.trim()}
                  onClick={() => runAction("JOURNEY_REBOOK_HANDOFF")}
                >
                  {actionState.isLoading ? "Working…" : "Journey rebook handoff"}
                </Button>
              </div>
            </div>
          </CaseSection>
        ) : null}
      </PermissionGate>

      {localMsg ? (
        <p
          className={`fo-ops-case__feedback${localMsg.error ? " fo-ops-case__feedback--warn" : ""}`}
          role="status"
        >
          {localMsg.text}
        </p>
      ) : null}

      {writeBackActions.length ? (
        <CaseSection
          icon={ScrollText}
          title={`Write-back log (${writeBackActions.length})`}
          flush
        >
          <div className="fo-desk__table-wrap">
            <table className="fo-desk__table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {writeBackActions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.actionType}
                      {a.targetType ? ` · ${a.targetType}` : ""}
                      {a.error ? (
                        <p className="mt-1 text-[12px] text-danger">{a.error}</p>
                      ) : null}
                    </td>
                    <td>
                      <OpsStatusPill state={a.status} />
                    </td>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CaseSection>
      ) : null}

      <CaseSection icon={MessageSquareText} title={`Conversation (${messages.length})`} flush>
        <CaseThread messages={messages} />
      </CaseSection>
    </div>
  );
}
