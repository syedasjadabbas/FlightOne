"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerPagination,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
  paginateItems,
} from "@/app/components/traveller";
import {
  useListMyEscalationsQuery,
  type EscalationTicket,
} from "@/lib/api/escalations.api";
import { useAuthStore } from "@/store/auth.store";

function statusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Requested — waiting for a consultant";
    case "ASSIGNED":
      return "Consultant assigned";
    case "IN_PROGRESS":
      return "Consultant working on it";
    case "RESOLVED":
      return "Resolved";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function EscalationRow({ ticket }: { ticket: EscalationTicket }) {
  return (
    <Link href={`/escalations/${ticket.id}`} className="fo-traveller__row-link">
      <div className="fo-traveller__row-top">
        <p className="fo-traveller__row-title">{ticket.trigger.replaceAll("_", " ")}</p>
        <TravellerChip tone={ticket.status === "RESOLVED" ? "muted" : "default"}>
          {ticket.status.replaceAll("_", " ")}
        </TravellerChip>
      </div>
      <p className="fo-traveller__row-body">{statusLabel(ticket.status)}</p>
      <p className="fo-traveller__row-meta">
        Case {ticket.id.slice(0, 10)}… · {new Date(ticket.createdAt).toLocaleString()}
      </p>
    </Link>
  );
}

export function EscalationsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useListMyEscalationsQuery(undefined, { skip });
  const items = data?.items ?? [];
  const pageItems = paginateItems(items, page, TRAVELLER_PAGE_SIZE);

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
        title="Escalations"
        lede="Sign in to request a human consultant or view handoff status."
        actions={
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <TravellerPageHeader
        title="Escalations"
        lede="Human handoff status for your Ava conversations. Ask Ava to connect you with a consultant, or open a case from chat."
        actions={
          <>
            <Link href="/chat">
              <Button variant="secondary" size="sm">
                Open chat
              </Button>
            </Link>
            <PermissionGate anyOf={["ops:escalations:read"]}>
              <Link href="/ops/escalations">
                <Button variant="secondary" size="sm">
                  Consultant queue
                </Button>
              </Link>
            </PermissionGate>
          </>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <TravellerState
          variant="error"
          title="Escalations unavailable"
          action={
            <Button size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load handoff cases.
        </TravellerState>
      ) : !items.length ? (
        <TravellerState title="No escalations">
          In chat, say you want a human consultant — or ask for medical, special-service, or
          refund-dispute help.
        </TravellerState>
      ) : (
        <>
          <ul className="fo-traveller__list">
            {pageItems.map((t) => (
              <li key={t.id}>
                <EscalationRow ticket={t} />
              </li>
            ))}
          </ul>
          <TravellerPagination
            page={page}
            total={items.length}
            onPageChange={setPage}
            label="Escalations pages"
          />
        </>
      )}
    </>
  );
}
