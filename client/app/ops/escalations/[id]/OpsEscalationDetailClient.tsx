"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
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
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-desk__panel">
        <p className="fo-desk__empty">Sign in required.</p>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="fo-desk__panel">
        <p className="fo-desk__empty">Not authorized to view this escalation.</p>
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

  if (isError || !data) {
    return (
      <div className="fo-desk__panel fo-desk__stack">
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          {(error as { status?: number })?.status === 404
            ? "Escalation not found."
            : "Could not load escalation."}
        </p>
        <Button size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const messages = Array.isArray(data.contextSnapshot?.messages)
    ? data.contextSnapshot!.messages!
    : [];
  const writeBackActions = Array.isArray(data.writeBackActions) ? data.writeBackActions : [];
  const canService = ["ASSIGNED", "IN_PROGRESS"].includes(data.status);

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
        setLocalMsg(
          `Write-back recorded as EXTERNAL_DEPENDENCY — provider/credentials incomplete (${result.action?.error || "see action log"}). Booking/service state only advanced where the underlying op succeeded.`,
        );
      } else {
        setLocalMsg(`Write-back ${st}: ${actionType}`);
      }
      await refetch();
    } catch {
      setLocalMsg("Consultant action failed (permissions, assignment, or underlying service).");
    }
  }

  return (
    <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
      <div className="fo-desk__links">
        <Link href="/ops/escalations">← Queue</Link>
      </div>

      <header className="fo-desk__header">
        <h1 className="fo-desk__title">{data.trigger.replaceAll("_", " ")}</h1>
        <p className="fo-desk__meta">
          {data.status} · priority {data.priority} · case {data.id}
          {data.routingPool ? ` · pool ${data.routingPool}` : ""}
          {data.routingStatus ? ` · ${data.routingStatus}` : ""}
        </p>
      </header>

      <section className="fo-desk__panel fo-desk__stack text-[14px]">
        <p>
          Customer userId: <span className="fo-desk__mono">{data.userId}</span>
        </p>
        <p>
          Conversation: <span className="fo-desk__mono">{data.conversationId}</span>
        </p>
        {data.bookingId ? (
          <p>
            Booking: <span className="fo-desk__mono">{data.bookingId}</span>
          </p>
        ) : null}
        {data.routing ? (
          <p>
            Routing:{" "}
            <span className="font-medium">
              {data.routing.pool} · {data.routing.status}
            </span>
            {typeof data.routing.eligibleConsultantCount === "number"
              ? ` · eligible consultants (entitled): ${data.routing.eligibleConsultantCount}`
              : ""}
            <br />
            <span className="text-[12px] text-ink-faint">
              {data.routing.reason || "Pool routing from trigger/permissions"}
              {" · "}
              availability not claimed · auto-assign off
            </span>
          </p>
        ) : null}
        {data.routingStatus === "UNROUTED_NO_ELIGIBLE" ? (
          <p className="text-[13px] text-[var(--danger)]">
            No eligible consultant in this pool — keep visible for manual Ops claim
            (`ops:escalations:write`).
          </p>
        ) : null}
        {data.assignedToUserId ? (
          <p>
            Assigned to: <span className="fo-desk__mono">{data.assignedToUserId}</span>
          </p>
        ) : (
          <p className="text-ink-soft">Unassigned</p>
        )}
        <p>
          Handoff:{" "}
          <span className="font-medium">{data.handoff?.mode || data.handoffMode || "COLD"}</span>
          {" · warm "}
          <span className="fo-desk__mono">
            {data.handoff?.warmStatus || "PRODUCT_DECISION_DEFERRED"}
          </span>
          <br />
          <span className="text-[12px] text-ink-faint">
            {data.handoff?.note ||
              "PRD Module 13 requires full conversation transfer only; warm co-presence is not specified."}
          </span>
        </p>
        {data.lastWriteBackAction ? (
          <p>
            Last write-back:{" "}
            <span className="font-medium">
              {data.lastWriteBackAction} · {data.lastWriteBackStatus}
            </span>
            {data.lastWriteBackAt
              ? ` · ${new Date(data.lastWriteBackAt).toLocaleString()}`
              : ""}
          </p>
        ) : (
          <p className="text-ink-soft">No booking/service write-back yet</p>
        )}
        {data.resolutionOutcome ? (
          <p>
            Resolution outcome: <span className="font-medium">{data.resolutionOutcome}</span>
          </p>
        ) : null}
        {typeof data.contextSnapshot?.reasonDetail === "string" &&
        data.contextSnapshot.reasonDetail ? (
          <p>
            <span className="text-ink-faint">Reason detail</span>
            <br />
            {data.contextSnapshot.reasonDetail}
          </p>
        ) : null}
      </section>

      <PermissionGate anyOf={["ops:escalations:write"]}>
        {!["RESOLVED", "CANCELLED"].includes(data.status) ? (
          <section className="fo-desk__panel fo-desk__stack">
            <p className="fo-desk__section-label">Queue actions</p>
            <div className="flex flex-wrap gap-2">
              {data.status === "OPEN" ? (
                <Button
                  size="sm"
                  disabled={claimState.isLoading}
                  onClick={async () => {
                    setLocalMsg(null);
                    try {
                      await claim(id).unwrap();
                      setLocalMsg("Claimed.");
                    } catch {
                      setLocalMsg("Claim failed.");
                    }
                  }}
                >
                  Claim
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
                      setLocalMsg("Marked in progress.");
                    } catch {
                      setLocalMsg("Start failed.");
                    }
                  }}
                >
                  Start work
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
                    setLocalMsg("Cancelled.");
                  } catch {
                    setLocalMsg("Cancel failed.");
                  }
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Resolution note (required to resolve)"
              />
              <SearchableSelect
                label="Resolution outcome"
                options={OUTCOME_OPTIONS}
                value={outcome}
                onChange={(v) => setOutcome(v as EscalationResolutionOutcome)}
                searchable={false}
              />
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
                    setLocalMsg("Resolved.");
                  } catch {
                    setLocalMsg("Resolve failed.");
                  }
                }}
              >
                Resolve
              </Button>
            </div>
            {localMsg ? <p className="text-[13px] text-ink-soft">{localMsg}</p> : null}
          </section>
        ) : null}

        {canService ? (
          <section className="fo-desk__panel fo-desk__stack">
            <p className="fo-desk__section-label">Booking / service write-back</p>
            <p className="text-[12px] text-ink-faint">
              Uses Module 03 / 09 / 14 state machines. Assigned consultant only. Provider steps
              report EXTERNAL_DEPENDENCY when credentials are absent — never invents success.
            </p>
            <Input
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Reason (optional)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={actionState.isLoading || !data.bookingId}
                onClick={() => runAction("CANCEL_BOOKING")}
              >
                Cancel booking
              </Button>
            </div>
            <Input
              value={refundCaseId}
              onChange={(e) => setRefundCaseId(e.target.value)}
              placeholder="Refund case id (or REQUIRES_HUMAN case on booking)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={actionState.isLoading || !canRefund}
                onClick={() => runAction("REFUND_PROCESS")}
              >
                Process refund
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={actionState.isLoading || !canRefund}
                onClick={() => runAction("REFUND_REJECT")}
              >
                Reject refund
              </Button>
            </div>
            {!canRefund ? (
              <p className="text-[12px] text-ink-faint">
                Refund write-back needs `refunds:write` in addition to escalation write.
              </p>
            ) : null}
            <Input
              value={watchId}
              onChange={(e) => setWatchId(e.target.value)}
              placeholder="Journey watch id"
            />
            <Input
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              placeholder="Supplier offer snapshot id"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={actionState.isLoading || !watchId.trim() || !snapshotId.trim()}
              onClick={() => runAction("JOURNEY_REBOOK_HANDOFF")}
            >
              Journey rebook handoff
            </Button>
          </section>
        ) : null}
      </PermissionGate>

      {writeBackActions.length ? (
        <section className="fo-desk__panel fo-desk__panel--flush">
          <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
            <h2 className="fo-desk__section-label">
              Write-back log ({writeBackActions.length})
            </h2>
          </div>
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
                        <p className="mt-1 text-[12px] text-[var(--danger)]">{a.error}</p>
                      ) : null}
                    </td>
                    <td>{a.status}</td>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="fo-desk__panel fo-desk__panel--flush">
        <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
          <h2 className="fo-desk__section-label">
            Conversation ({messages.length} messages)
          </h2>
        </div>
        {!messages.length ? (
          <p className="fo-desk__empty">
            No messages were present at handoff time (empty conversation snapshot).
          </p>
        ) : (
          <ul>
            {messages.map((m) => (
              <li key={m.id} className="fo-desk__queue-link" style={{ cursor: "default" }}>
                <div className="flex justify-between gap-2 text-[11px] text-ink-faint">
                  <span>
                    {m.role}
                    {m.provider ? ` · ${m.provider}` : ""}
                  </span>
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


