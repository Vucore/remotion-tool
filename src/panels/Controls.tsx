import { useEffect, useState } from "react";
import { Icon } from "../icons";
export const Action = ({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className="button icon-button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name={icon} size={15} />
  </button>
);
export const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);
export function NumberInput({
  value,
  onChange,
  min = -100000,
  max = 100000,
  step = 0.1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() === "" || !Number.isFinite(Number(draft))) {
          setDraft(String(value));
          return;
        }
        let n = Math.max(min, Math.min(max, Number(draft)));
        if (step === 1) n = Math.round(n);
        if (n !== value) onChange(n);
        setDraft(String(n));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
export const Numeric = ({
  label,
  ...props
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) => (
  <Field label={label}>
    <NumberInput label={label} {...props} />
  </Field>
);
export const Slider = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) => (
  <label className="range-field">
    <span>
      {label}
      <output>{Number(value.toFixed(2))}</output>
    </span>
    <input
      aria-label={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </label>
);
export const Select = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Readonly<Record<string, string>>;
  onChange: (v: string) => void;
}) => (
  <Field label={label}>
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(options).map(([value, name]) => (
        <option value={value} key={value}>
          {name}
        </option>
      ))}
    </select>
  </Field>
);
export const Check = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="checkbox-field">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);
export const Color = ({
  label,
  value,
  onChange,
  transparent = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  transparent?: boolean;
}) => (
  <Field label={label}>
    <div className="color-control">
      <input
        aria-label={label}
        type="color"
        value={/^#[a-f0-9]{6}$/i.test(value) ? value : "#153d35"}
        onChange={(e) => onChange(e.target.value)}
      />
      {transparent && (
        <button
          type="button"
          className="button"
          aria-pressed={value === "transparent"}
          onClick={() =>
            onChange(value === "transparent" ? "#153d35" : "transparent")
          }
        >
          {value === "transparent" ? "Trong" : "Bỏ nền"}
        </button>
      )}
    </div>
  </Field>
);
export const Group = ({
  title,
  children,
  open = false,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) => (
  <details className="property-group" open={open}>
    <summary>{title}</summary>
    <div className="property-group-content">{children}</div>
  </details>
);
