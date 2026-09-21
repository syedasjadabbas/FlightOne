import type { ReactNode } from "react";

export function CaseFacts({
  items,
  note,
}: {
  items: Array<{ label: string; value: ReactNode; mono?: boolean }>;
  note?: { label: string; body: ReactNode } | null;
}) {
  return (
    <>
      <dl className="fo-ops-case__facts">
        {items.map((item) => (
          <div key={item.label} className="fo-ops-case__fact">
            <dt>{item.label}</dt>
            <dd className={item.mono ? "fo-ops-case__mono" : undefined}>{item.value}</dd>
          </div>
        ))}
      </dl>
      {note ? (
        <div className="fo-ops-case__note">
          <p className="fo-ops-case__note-label">{note.label}</p>
          <p className="fo-ops-case__note-body">{note.body}</p>
        </div>
      ) : null}
    </>
  );
}
