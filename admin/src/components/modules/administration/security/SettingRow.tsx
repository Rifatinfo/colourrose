"use client";

import type { LucideIcon } from "lucide-react";

import { FieldSelect } from "@/components/ui/field-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

/* =========================================================================
   One security setting: an icon, what it does, and the control that changes
   it. Every row on the Security screen is one of these three, which is what
   keeps three cards of unrelated policy reading as one list.
   ========================================================================= */

function Row({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Row
      icon={icon}
      title={title}
      description={description}
      control={<ToggleSwitch checked={checked} onChange={onChange} label={title} tone="good" />}
    />
  );
}

export function SelectRow({
  icon,
  title,
  description,
  value,
  options,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <Row
      icon={icon}
      title={title}
      description={description}
      control={
        <FieldSelect
          value={value}
          onValueChange={onChange}
          options={options}
          label={title}
          className="w-[150px]"
        />
      }
    />
  );
}

export function NumberRow({
  icon,
  title,
  description,
  value,
  min,
  max,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <Row
      icon={icon}
      title={title}
      description={description}
      control={
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          aria-label={title}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next)) return;
            onChange(Math.min(max, Math.max(min, next)));
          }}
          className="h-10 w-[88px] rounded-lg border border-slate-200 bg-white px-3 text-[13px] tabular-nums text-slate-900 outline-none transition-colors focus:border-slate-400"
        />
      }
    />
  );
}
