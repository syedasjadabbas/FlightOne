import type { InputHTMLAttributes, ReactNode } from "react";

export function OpsField({
  label,
  id,
  children,
  ...inputProps
}: {
  label: string;
  id: string;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="fo-ops__field" htmlFor={id}>
      <span className="fo-ops__field-label">{label}</span>
      {children ?? <input id={id} {...inputProps} />}
    </label>
  );
}
