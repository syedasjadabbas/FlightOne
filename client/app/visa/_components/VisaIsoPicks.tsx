type PickItem = { code: string; label: string };

export function VisaIsoPicks({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly PickItem[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="fo-visa__picks" role="group" aria-label={label}>
      <span className="fo-visa__picks-label">{label}</span>
      {items.map((item) => {
        const on = value === item.code;
        return (
          <button
            key={item.code}
            type="button"
            title={item.label}
            aria-pressed={on}
            className={`fo-visa__pick${on ? " fo-visa__pick--on" : ""}`}
            onClick={() => onChange(item.code)}
          >
            {item.code}
          </button>
        );
      })}
    </div>
  );
}
