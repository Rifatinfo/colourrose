"use client";

import {
  BoxIcon,
  CheckCircle2Icon,
  ClockIcon,
  UserRoundIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";

import type { ActivityEntry } from "@/types/administration";
import { Avatar, CARD } from "../shared/ui";
import { formatStamp } from "../shared/format";
import { cn } from "@/lib/utils";

/** What one entry is made of, beside the row it came from. */
export function ActivityDetailPanel({
  entry,
  onClose,
}: {
  entry: ActivityEntry;
  onClose: () => void;
}) {
  const success = entry.status === "SUCCESS";

  return (
    <aside className={cn(CARD, "flex flex-col overflow-hidden")} aria-label="Activity details">
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <h2 className="text-[17px] font-semibold text-slate-900">Activity Details</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex items-center gap-3 px-5 pb-5">
        <Avatar name={entry.actorName} src={entry.actorAvatar} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-slate-900">{entry.actorName}</p>
          <p className="truncate text-[12px] text-slate-500">{entry.actorRole}</p>
        </div>
      </div>

      <dl className="divide-y divide-slate-100 border-t border-slate-100">
        <Row icon={UserRoundIcon} label="Action" value={entry.action} />
        <Row icon={BoxIcon} label="Module" value={entry.module} />
        <Row icon={ClockIcon} label="Time" value={formatStamp(entry.at)} />
        <Row
          icon={success ? CheckCircle2Icon : XCircleIcon}
          label="Status"
          value={
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium",
                success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              )}
            >
              <span
                className={cn(
                  "h-[6px] w-[6px] rounded-full",
                  success ? "bg-emerald-500" : "bg-rose-500"
                )}
                aria-hidden="true"
              />
              {success ? "Success" : "Failed"}
            </span>
          }
        />
        <Row label="Details" value={entry.details} />
        {entry.facts?.map((fact) => (
          <Row key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </dl>

      <p className="px-5 py-4 text-[12px] text-slate-400">
        Read from the record itself. Device and IP are not kept with it.
      </p>
    </aside>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof UserRoundIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5">
      <dt className="flex items-center gap-2 text-[12px] text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-1 text-[13px] break-words text-slate-900">{value}</dd>
    </div>
  );
}
