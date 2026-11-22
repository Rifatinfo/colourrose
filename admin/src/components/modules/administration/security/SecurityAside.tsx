"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  InfoIcon,
  ShieldAlertIcon,
} from "lucide-react";

import type { ActivityEntry, SecuritySettings } from "@/types/administration";
import { CARD } from "../shared/ui";
import { formatStamp } from "../shared/format";
import { cn } from "@/lib/utils";

/* ----------------------------- Security log ------------------------------ */

/**
 * The account-level slice of the activity feed: who was added, who was
 * suspended, who changed. It is the same data as the Activity Log, narrowed
 * to the things a security review looks for.
 */
export function SecurityLogCard({ entries }: { entries: ActivityEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries.slice(0, 20) : entries.slice(0, 5);

  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Security Log</h2>
          <p className="mt-1 text-[13px] text-slate-500">Recent account and access changes.</p>
        </div>
        <Link
          href="/admin/activity-log"
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-200 px-3 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-300"
        >
          View All
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-slate-500">
          No account changes recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {shown.map((item) => {
            const failed = item.status === "FAILED";
            return (
              <li key={item.id} className="flex gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                    failed ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {failed ? (
                    <ShieldAlertIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">{item.action}</p>
                  <p className="truncate text-[12px] text-slate-500">{item.actorName}</p>
                  <p className="mt-0.5 text-[12px] text-slate-400">{formatStamp(item.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full cursor-pointer items-center justify-center gap-1 border-t border-slate-100 py-3 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronRightIcon
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "-rotate-90")}
            aria-hidden="true"
          />
        </button>
      )}
    </section>
  );
}

/* --------------------------- Recommendations ----------------------------- */

type Recommendation = {
  tone: "good" | "warn" | "info";
  text: string;
};

/** Read off the policy as it stands, so the list changes as settings change. */
export function recommendationsFor(
  settings: SecuritySettings,
  context: { pendingInvites: number; inactiveUsers: number }
): Recommendation[] {
  const list: Recommendation[] = [];

  list.push(
    settings.twoFactor
      ? { tone: "good", text: "Two-factor sign-in is required for staff accounts." }
      : { tone: "warn", text: "Turn on two-factor sign-in for staff accounts." }
  );

  const strong =
    settings.minLength >= 8 &&
    settings.requireUppercase &&
    settings.requireLowercase &&
    settings.requireNumber &&
    settings.requireSpecial;
  list.push(
    strong
      ? { tone: "good", text: "Password policy requires a strong password." }
      : { tone: "warn", text: "Strengthen the password policy — it accepts weak passwords." }
  );

  if (!settings.blockSuspicious) {
    list.push({ tone: "warn", text: "Repeated failed sign-ins are not being blocked." });
  }

  if (!settings.restrictByIp) {
    list.push({
      tone: "info",
      text: "Consider restricting sign-in by IP for tighter control.",
    });
  } else if (settings.allowedIps.length === 0) {
    list.push({
      tone: "warn",
      text: "IP restriction is on with no addresses allowed — nobody can sign in.",
    });
  }

  if (settings.passwordExpiry === 0) {
    list.push({ tone: "info", text: "Passwords never expire. Set an expiry if policy needs one." });
  }

  if (context.pendingInvites > 0) {
    list.push({
      tone: "info",
      text: `${context.pendingInvites} ${
        context.pendingInvites === 1 ? "account has" : "accounts have"
      } never set their own password.`,
    });
  }

  if (context.inactiveUsers > 0) {
    list.push({
      tone: "info",
      text: `${context.inactiveUsers} suspended ${
        context.inactiveUsers === 1 ? "account is" : "accounts are"
      } still on the roster. Delete what is no longer needed.`,
    });
  }

  return list;
}

const TONE = {
  good: { icon: CheckCircle2Icon, className: "text-emerald-600" },
  warn: { icon: AlertTriangleIcon, className: "text-amber-600" },
  info: { icon: InfoIcon, className: "text-slate-400" },
};

export function RecommendationsCard({ items }: { items: Recommendation[] }) {
  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[17px] font-semibold text-slate-900">Security Recommendations</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Read from the policy above and the current roster.
        </p>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {items.map((item) => {
          const tone = TONE[item.tone];
          return (
            <li key={item.text} className="flex gap-3 px-5 py-3.5">
              <tone.icon
                className={cn("mt-0.5 h-4 w-4 shrink-0", tone.className)}
                aria-hidden="true"
              />
              <p className="text-[13px] text-slate-700">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
