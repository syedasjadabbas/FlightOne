"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import {
  useCreateVisaApplicationMutation,
  useListVisaApplicationsQuery,
  useUpdateVisaApplicationMutation,
  type VisaCategory,
} from "@/lib/api/visa.api";
import { useAuthStore } from "@/store/auth.store";

export function VisaApplicationsSection({
  nationality,
  destination,
  category,
}: {
  nationality?: string | null;
  destination: string;
  category?: VisaCategory;
}) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = Boolean(accessToken);
  const { data, isLoading, isError, refetch } = useListVisaApplicationsQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });
  const [createApp, createState] = useCreateVisaApplicationMutation();
  const [updateApp, updateState] = useUpdateVisaApplicationMutation();
  const [apptAt, setApptAt] = useState("");
  const [apptLoc, setApptLoc] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  if (hasHydrated && !isAuthenticated) {
    return (
      <TravellerSection
        title="Application tracking"
        note="Track embassy appointments and document submissions."
        panel
      >
        <p className="fo-visa__desk-copy">
          Sign in to open tracked visa cases, record VAC biometrics appointments, and store
          application reference IDs.
        </p>
        <div className="fo-visa__desk-actions">
          <Link href="/login?redirect=%2Fvisa">
            <Button size="sm" variant="secondary">
              Sign in to track applications
            </Button>
          </Link>
        </div>
      </TravellerSection>
    );
  }

  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown } | undefined)?.items)
      ? (data as { items: Array<Record<string, unknown>> }).items
      : [];

  return (
    <TravellerSection
      title="Application tracking"
      note="Track embassy appointments for this destination. Reminders go to verified notifications."
      panel
    >
      <div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={createState.isLoading || !nationality || !/^[A-Z]{2}$/.test(destination)}
          onClick={async () => {
            setLocalMsg(null);
            try {
              await createApp({
                nationality: nationality!,
                destination,
                ...(category ? { category } : {}),
              }).unwrap();
              setLocalMsg("Application tracking case opened.");
              refetch();
            } catch {
              setLocalMsg("Could not create application case. Check inputs and try again.");
            }
          }}
        >
          {createState.isLoading ? "Opening…" : `Open case for ${destination}`}
        </Button>
      </div>

      {isLoading ? <Spinner /> : null}

      {isError ? (
        <TravellerState
          variant="error"
          title="Applications unavailable"
          action={
            <Button type="button" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        >
          Could not load your visa tracking cases.
        </TravellerState>
      ) : !items.length ? (
        <TravellerState title="No active applications">
          Open a tracking case above to record your VAC / consulate appointment and tracking
          number.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list mt-3">
          {items.map((raw) => {
            const a = raw as {
              id: string;
              destinationCode: string;
              nationalityCode: string;
              status: string;
              appointmentAt?: string | null;
              appointmentLocation?: string | null;
            };
            return (
              <li key={a.id} className="fo-traveller__row">
                <div className="flex items-center justify-between gap-2">
                  <p className="fo-traveller__row-title">
                    {a.nationalityCode} → {a.destinationCode} · {a.status}
                  </p>
                  <TravellerChip tone={a.appointmentAt ? "default" : "muted"}>
                    {a.appointmentAt ? "Appointment set" : "Pending booking"}
                  </TravellerChip>
                </div>
                <p className="fo-traveller__row-meta">
                  Appointment:{" "}
                  {a.appointmentAt ? new Date(a.appointmentAt).toLocaleString() : "Not scheduled"}
                  {a.appointmentLocation ? ` · ${a.appointmentLocation}` : ""}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-fit"
                  onClick={() => {
                    setSelectedId(selectedId === a.id ? null : a.id);
                    if (a.appointmentAt) {
                      try {
                        setApptAt(new Date(a.appointmentAt).toISOString().slice(0, 16));
                      } catch {
                        setApptAt("");
                      }
                    }
                    if (a.appointmentLocation) setApptLoc(a.appointmentLocation);
                  }}
                >
                  {selectedId === a.id ? "Cancel edit" : "Update appointment"}
                </Button>
                {selectedId === a.id ? (
                  <div className="fo-visa__appt-edit">
                    <Input
                      label="Appointment date & time"
                      type="datetime-local"
                      value={apptAt}
                      onChange={(e) => setApptAt(e.target.value)}
                    />
                    <Input
                      label="Embassy / VAC location"
                      value={apptLoc}
                      onChange={(e) => setApptLoc(e.target.value)}
                      placeholder="e.g. VFS Global / Embassy centre"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={updateState.isLoading}
                      onClick={async () => {
                        setLocalMsg(null);
                        try {
                          await updateApp({
                            id: a.id,
                            appointmentAt: apptAt ? new Date(apptAt).toISOString() : null,
                            appointmentLocation: apptLoc.trim() || null,
                          }).unwrap();
                          setLocalMsg("Appointment saved.");
                          setSelectedId(null);
                          refetch();
                        } catch {
                          setLocalMsg("Appointment update failed.");
                        }
                      }}
                    >
                      {updateState.isLoading ? "Saving…" : "Save appointment"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {localMsg ? (
        <p className={`fo-visa__flash${localMsg.includes("fail") || localMsg.includes("Could") ? "" : " fo-visa__flash--ok"}`}>
          {localMsg}
        </p>
      ) : null}
    </TravellerSection>
  );
}
