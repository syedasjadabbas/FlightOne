"use client";

import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import { useGetMyEscalationQuery } from "@/lib/api/escalations.api";
import { customerRoutingStatusMessage } from "@/lib/escalations/routingDisplay";
import { useAuthStore } from "@/store/auth.store";

export function EscalationDetailClient({ id }: { id: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading, isError, refetch, error } = useGetMyEscalationQuery(id, { skip });

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <TravellerPageHeader
        title="Escalation"
        lede="Sign in to view this escalation."
        actions={
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        }
      />
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
    const status = (error as { status?: number } | undefined)?.status;
    return (
      <TravellerState
        variant="error"
        title={status === 404 ? "Escalation not found" : "Escalation unavailable"}
        action={
          <>
            <Button size="sm" onClick={() => refetch()}>
              Retry
            </Button>
            <Link href="/escalations" className="text-[13px] text-[var(--sky)] underline-offset-2 hover:underline">
              Back to list
            </Link>
          </>
        }
      >
        {status === 404
          ? "This case does not exist or belongs to another account."
          : "Could not load this escalation."}
      </TravellerState>
    );
  }

  return (
    <>
      <TravellerPageHeader
        backHref="/escalations"
        backLabel="Escalations"
        title="Handoff status"
        lede={`Case ${data.id}`}
        meta={
          <TravellerChip tone={data.status === "RESOLVED" ? "muted" : "default"}>
            {data.status.replaceAll("_", " ")}
          </TravellerChip>
        }
      />

      <TravellerSection title="Status">
        <dl className="fo-traveller__facts">
          <div className="fo-traveller__fact">
            <dt>Reason</dt>
            <dd>{data.trigger.replaceAll("_", " ")}</dd>
          </div>
          <div className="fo-traveller__fact">
            <dt>Status</dt>
            <dd>{data.status}</dd>
          </div>
        </dl>
        {data.assignedToUserId ? (
          <p className="fo-traveller__row-body">A consultant has been assigned to this case.</p>
        ) : (
          <p className="fo-traveller__row-body">
            {customerRoutingStatusMessage({
              status: data.status,
              assignedToUserId: data.assignedToUserId,
              routing: data.routing,
            })}
          </p>
        )}
        {data.routing?.pool ? (
          <p className="fo-traveller__row-meta">
            Queue: {data.routing.pool}
            {data.routing.status === "UNROUTED_NO_ELIGIBLE"
              ? " · awaiting Ops manual handling"
              : data.routing.status === "POOL_ROUTED"
                ? " · specialist pool"
                : ""}
          </p>
        ) : null}
        {data.resolutionNote ? (
          <div>
            <p className="fo-traveller__section-title">Resolution note</p>
            <p className="fo-traveller__row-body mt-1">{data.resolutionNote}</p>
          </div>
        ) : null}
        {data.bookingId ? (
          <p className="fo-traveller__row-meta">Linked booking: {data.bookingId}</p>
        ) : null}
      </TravellerSection>

      <TravellerSection title="Conversation at handoff">
        {Array.isArray(data.contextSnapshot?.messages) && data.contextSnapshot!.messages!.length ? (
          <ul className="fo-traveller__list max-h-80 overflow-auto">
            {data.contextSnapshot!.messages!.map((m) => (
              <li key={m.id} className="fo-traveller__row">
                <p className="fo-traveller__row-meta">
                  {m.role} · {new Date(m.createdAt).toLocaleString()}
                </p>
                <p className="fo-traveller__row-body whitespace-pre-wrap">{m.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <TravellerState title="No handoff messages">
            No messages were captured in the snapshot for this case.
          </TravellerState>
        )}
      </TravellerSection>
    </>
  );
}
