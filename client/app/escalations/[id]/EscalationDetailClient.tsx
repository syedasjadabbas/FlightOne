"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Headphones,
  Info,
  LogIn,
  MessageSquareText,
  RefreshCw,
  Ticket,
  User,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import {
  useGetMyEscalationQuery,
  type EscalationStatus,
  type EscalationTicket,
} from "@/lib/api/escalations.api";
import { customerRoutingStatusMessage } from "@/lib/escalations/routingDisplay";
import { useAuthStore } from "@/store/auth.store";
import "./escalation-detail.css";

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function statusTone(status: EscalationStatus): "default" | "warn" | "muted" {
  if (status === "OPEN") return "warn";
  if (status === "RESOLVED" || status === "CANCELLED") return "muted";
  return "default";
}

function statusHeadline(data: EscalationTicket): string {
  switch (data.status) {
    case "RESOLVED":
      return "Resolved";
    case "CANCELLED":
      return "Cancelled";
    case "IN_PROGRESS":
      return "In progress";
    case "ASSIGNED":
      return "Consultant assigned";
    default:
      return "Awaiting assignment";
  }
}

function StatusIcon({ data }: { data: EscalationTicket }) {
  const common = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };
  if (data.status === "RESOLVED") {
    return (
      <span className="fo-esc-detail__status-icon fo-esc-detail__status-icon--ok">
        <CheckCircle2 {...common} />
      </span>
    );
  }
  if (data.status === "CANCELLED") {
    return (
      <span className="fo-esc-detail__status-icon fo-esc-detail__status-icon--warn">
        <CircleAlert {...common} />
      </span>
    );
  }
  if (data.assignedToUserId || data.status === "ASSIGNED" || data.status === "IN_PROGRESS") {
    return (
      <span className="fo-esc-detail__status-icon fo-esc-detail__status-icon--ok">
        <Headphones {...common} />
      </span>
    );
  }
  if (data.routing?.status === "UNROUTED_NO_ELIGIBLE") {
    return (
      <span className="fo-esc-detail__status-icon fo-esc-detail__status-icon--warn">
        <CircleAlert {...common} />
      </span>
    );
  }
  return (
    <span className="fo-esc-detail__status-icon fo-esc-detail__status-icon--wait">
      <Clock3 {...common} />
    </span>
  );
}

function MessageRoleIcon({ role }: { role: string }) {
  const r = role.toLowerCase();
  const common = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };
  if (r === "user" || r === "customer" || r === "traveller") {
    return <User className="fo-esc-detail__msg-icon fo-esc-detail__msg-icon--user" {...common} />;
  }
  if (r === "assistant" || r === "ai" || r === "ava") {
    return <Bot className="fo-esc-detail__msg-icon fo-esc-detail__msg-icon--assistant" {...common} />;
  }
  return <Info className="fo-esc-detail__msg-icon" {...common} />;
}

function queueMeta(data: EscalationTicket): string | null {
  const pool = data.routing?.pool;
  if (!pool) return null;
  const parts = [`Queue ${pool}`];
  if (data.routing?.status === "UNROUTED_NO_ELIGIBLE") {
    parts.push("awaiting Ops");
  } else if (data.routing?.status === "POOL_ROUTED") {
    parts.push("specialist pool");
  }
  return parts.join(" · ");
}

export function EscalationDetailClient({ id }: { id: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading, isError, refetch, error } = useGetMyEscalationQuery(id, { skip });

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <TravellerPageHeader
        title="Support case"
        lede="Sign in to view this case."
        actions={
          <Link href="/login">
            <Button size="sm">
              <LogIn size={14} strokeWidth={1.75} aria-hidden />
              Sign in
            </Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading case">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    const status = (error as { status?: number } | undefined)?.status;
    return (
      <TravellerState
        variant="error"
        title={status === 404 ? "Case not found" : "Case unavailable"}
        action={
          <div className="fo-esc-detail__actions">
            <Button size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
              Retry
            </Button>
            <Link href="/escalations" className="fo-esc-detail__link">
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
              Back to cases
            </Link>
          </div>
        }
      >
        {status === 404
          ? "This case does not exist or belongs to another account."
          : "Could not load this support case."}
      </TravellerState>
    );
  }

  const messages = Array.isArray(data.contextSnapshot?.messages)
    ? data.contextSnapshot!.messages!
    : [];
  const routingCopy = customerRoutingStatusMessage({
    status: data.status,
    assignedToUserId: data.assignedToUserId,
    routing: data.routing,
  });
  const queue = queueMeta(data);

  return (
    <div className="fo-esc-detail">
      <Link href="/escalations" className="fo-esc-detail__link fo-esc-detail__back">
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Cases
      </Link>

      <TravellerPageHeader
        title={labelize(data.trigger)}
        lede={
          <span className="inline-flex items-center gap-1.5">
            <Ticket size={13} strokeWidth={1.75} aria-hidden className="text-[var(--ink-faint)]" />
            <span className="font-mono text-[12px] tracking-tight text-[var(--ink-faint)]">
              {data.id}
            </span>
          </span>
        }
        meta={
          <TravellerChip tone={statusTone(data.status)}>{labelize(data.status)}</TravellerChip>
        }
        actions={
          <Link href="/chat">
            <Button size="sm" variant="secondary">
              <MessageSquareText size={14} strokeWidth={1.75} aria-hidden />
              Open chat
            </Button>
          </Link>
        }
      />

      <div className="fo-esc-detail__status" role="status">
        <StatusIcon data={data} />
        <div className="fo-esc-detail__status-body">
          <p className="fo-esc-detail__status-title">{statusHeadline(data)}</p>
          <p className="fo-esc-detail__status-copy">{routingCopy}</p>
          {queue ? <p className="fo-esc-detail__status-meta">{queue}</p> : null}
        </div>
      </div>

      <TravellerSection title="Details">
        <dl className="fo-traveller__facts">
          <div className="fo-traveller__fact">
            <dt>Opened</dt>
            <dd>{new Date(data.createdAt).toLocaleString()}</dd>
          </div>
          <div className="fo-traveller__fact">
            <dt>Updated</dt>
            <dd>{new Date(data.updatedAt).toLocaleString()}</dd>
          </div>
          {data.resolvedAt ? (
            <div className="fo-traveller__fact">
              <dt>Resolved</dt>
              <dd>{new Date(data.resolvedAt).toLocaleString()}</dd>
            </div>
          ) : null}
          {data.bookingId ? (
            <div className="fo-traveller__fact">
              <dt>Booking</dt>
              <dd className="font-mono text-[12px]">{data.bookingId}</dd>
            </div>
          ) : null}
          {data.routing?.pool ? (
            <div className="fo-traveller__fact">
              <dt>Queue</dt>
              <dd>{data.routing.pool}</dd>
            </div>
          ) : null}
        </dl>

        {data.resolutionNote ? (
          <div className="mt-3">
            <p className="fo-traveller__section-title">Resolution note</p>
            <p className="fo-traveller__row-body mt-1">{data.resolutionNote}</p>
          </div>
        ) : null}
      </TravellerSection>

      <TravellerSection
        title="Conversation at handoff"
        note={
          messages.length
            ? `${messages.length} message${messages.length === 1 ? "" : "s"} captured`
            : undefined
        }
      >
        {messages.length ? (
          <ul className="fo-esc-detail__thread">
            {messages.map((m) => (
              <li key={m.id} className="fo-esc-detail__msg">
                <MessageRoleIcon role={m.role} />
                <div className="fo-esc-detail__msg-head">
                  <span className="fo-esc-detail__msg-role">{labelize(m.role)}</span>
                  <time dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="fo-esc-detail__msg-body">{m.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <TravellerState title="No messages captured">
            Nothing was stored in the handoff snapshot for this case.
          </TravellerState>
        )}
      </TravellerSection>
    </div>
  );
}
