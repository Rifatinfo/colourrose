"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseIcon,
  CoinsIcon,
  CrownIcon,
  HeadsetIcon,
  ImageIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { FieldSelect } from "@/components/ui/field-select";
import { STAFF_ROLES, type StaffRoleKey } from "@/types/staffRole";
import type { RoleDefinition, RoleIconKey } from "@/types/administration";
import { GhostButton, PrimaryButton } from "../shared/ui";
import { cn } from "@/lib/utils";

export const ROLE_ICONS: Record<RoleIconKey, LucideIcon> = {
  crown: CrownIcon,
  settings: SettingsIcon,
  briefcase: BriefcaseIcon,
  coin: CoinsIcon,
  image: ImageIcon,
  headset: HeadsetIcon,
  box: PackageIcon,
  shield: ShieldIcon,
};

const ICON_KEYS = Object.keys(ROLE_ICONS) as RoleIconKey[];

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

export type RoleDraft = {
  name: string;
  description: string;
  icon: RoleIconKey;
  /** What the server itself lets accounts with this role do. */
  baseRole: StaffRoleKey;
};

const ACCESS_LEVELS = (Object.keys(STAFF_ROLES) as StaffRoleKey[]).map((key) => ({
  value: key,
  label: STAFF_ROLES[key].singular,
}));

export function RoleDialog({
  role,
  onClose,
  onSubmit,
}: {
  /** null creates a new role. */
  role: RoleDefinition | null;
  onClose: () => void;
  onSubmit: (draft: RoleDraft) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [icon, setIcon] = useState<RoleIconKey>(role?.icon ?? "shield");
  const [baseRole, setBaseRole] = useState<StaffRoleKey>(role?.roleKey ?? "SHOP_MANAGER");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give the role a name of at least 2 characters.");
      return;
    }
    onSubmit({ name: trimmed, description: description.trim(), icon, baseRole });
  };

  return (
    <div className="fixed inset-0 z-60 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/20 backdrop-blur-[1px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-dialog-title"
        className="relative w-full max-w-[440px] rounded-xl bg-white shadow-[0_24px_60px_-15px_rgb(16_24_40/0.35)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 id="role-dialog-title" className="text-[19px] font-semibold text-slate-900">
              {role ? "Edit Role" : "Create Role"}
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              {role
                ? "Rename the role or change how it is described."
                : "Name the role, then tick what it can reach."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-6 pb-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Role name<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Inventory Executive"
              className={FIELD}
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this role is responsible for"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Access level<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <FieldSelect
              value={baseRole}
              onValueChange={(next) => setBaseRole(next as StaffRoleKey)}
              options={ACCESS_LEVELS}
              label="Access level"
            />
            <p className="mt-1.5 text-[12px] text-slate-400">
              What the server allows accounts with this role. The tick boxes below decide what
              they see in the dashboard.
            </p>
          </div>

          <div>
            <span className="mb-2 block text-[13px] font-medium text-slate-700">Icon</span>
            <div className="flex flex-wrap gap-2">
              {ICON_KEYS.map((key) => {
                const Icon = ROLE_ICONS[key];
                const active = icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    aria-label={`Use the ${key} icon`}
                    aria-pressed={active}
                    className={cn(
                      "grid h-10 w-10 cursor-pointer place-items-center rounded-lg border transition-colors",
                      active
                        ? "border-[#0b0b0b] bg-[#0b0b0b] text-white"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <GhostButton onClick={onClose} className="flex-1 justify-center">
            Cancel
          </GhostButton>
          <PrimaryButton onClick={submit} className="flex-1 justify-center">
            {role ? "Save changes" : "Create Role"}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
}
