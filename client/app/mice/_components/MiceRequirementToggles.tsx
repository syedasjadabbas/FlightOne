"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bus,
  Hotel,
  Plane,
  Presentation,
  Stamp,
  UtensilsCrossed,
} from "lucide-react";

type ReqItem = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  Icon: LucideIcon;
};

export function MiceRequirementToggles({
  flights,
  hotels,
  transfers,
  meetingSpace,
  catering,
  visas,
  onFlights,
  onHotels,
  onTransfers,
  onMeetingSpace,
  onCatering,
  onVisas,
}: {
  flights: boolean;
  hotels: boolean;
  transfers: boolean;
  meetingSpace: boolean;
  catering: boolean;
  visas: boolean;
  onFlights: (v: boolean) => void;
  onHotels: (v: boolean) => void;
  onTransfers: (v: boolean) => void;
  onMeetingSpace: (v: boolean) => void;
  onCatering: (v: boolean) => void;
  onVisas: (v: boolean) => void;
}) {
  const items: ReqItem[] = [
    { id: "flights", label: "Flights", checked: flights, onChange: onFlights, Icon: Plane },
    { id: "hotels", label: "Accommodation", checked: hotels, onChange: onHotels, Icon: Hotel },
    { id: "transfers", label: "Transfers", checked: transfers, onChange: onTransfers, Icon: Bus },
    {
      id: "space",
      label: "Meeting space",
      checked: meetingSpace,
      onChange: onMeetingSpace,
      Icon: Presentation,
    },
    { id: "catering", label: "Catering", checked: catering, onChange: onCatering, Icon: UtensilsCrossed },
    { id: "visas", label: "Visa assistance", checked: visas, onChange: onVisas, Icon: Stamp },
  ];

  return (
    <div>
      <p className="fo-gm-field-label" id="mice-reqs-label">
        Requirements (optional — requests only)
      </p>
      <div className="fo-gm-reqs mt-2" role="group" aria-labelledby="mice-reqs-label">
        {items.map(({ id, label, checked, onChange, Icon }) => (
          <label key={id} className="fo-gm-req">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="fo-gm-req__icon" aria-hidden>
              <Icon size={15} strokeWidth={2} />
            </span>
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
