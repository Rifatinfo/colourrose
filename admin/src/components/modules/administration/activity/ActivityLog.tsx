"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIcon,
  CalendarIcon,
  CheckCircle2Icon,
  DownloadIcon,
  Loader2Icon,
  UsersRoundIcon,
  XCircleIcon,
} from "lucide-react";

import { FieldSelect } from "@/components/ui/field-select";
import type { ActivityEntry } from "@/types/administration";
import { fetchActivity, modulesIn, toCsv } from "@/services/administration/activity";
import {
  Avatar,
  CARD,
  EmptyState,
  GhostButton,
  PageHeader,
  PageShell,
  Pager,
  SearchField,
  StatCard,
  StatGrid,
  TableSkeleton,
  Th,
} from "../shared/ui";
import { formatWhen, toDateInput } from "../shared/format";
import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

/* =========================================================================
   Activity Log — what has happened across the dashboard, newest first.

   Every row is read back off a real record (see services/administration/
   activity.ts). Nothing is generated to fill the table, so an empty range
   means nothing happened in it.
   ========================================================================= */

type Filters = {
  query: string;
  user: string;
  action: string;
  module: string;
  status: string;
};

const EMPTY: Filters = { query: "", user: "all", action: "all", module: "all", status: "all" };

export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A month back through today, which is the window an admin is usually
  // asking about when they open this screen.
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return toDateInput(start);
  });
  const [to, setTo] = useState(() => toDateInput(new Date()));

  useEffect(() => {
    fetchActivity()
      .then(({ entries: list, failed }) => {
        setEntries(list);
        setError(failed.length ? `Could not read: ${failed.join(", ")}.` : "");
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load activity")
      )
      .finally(() => setLoading(false));
  }, []);

  /* ------------------------------- Filtering ----------------------------- */

  const inRange = useMemo(() => {
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T23:59:59.999`).getTime();
    return entries.filter((item) => {
      const at = new Date(item.at).getTime();
      return at >= start && at <= end;
    });
  }, [entries, from, to]);

  const userOptions = useMemo(
    () => [
      { value: "all", label: "All Users" },
      ...[...new Set(inRange.map((item) => item.actorName))]
        .sort()
        .map((name) => ({ value: name, label: name })),
    ],
    [inRange]
  );

  const actionOptions = useMemo(
    () => [
      { value: "all", label: "All Actions" },
      ...[...new Set(inRange.map((item) => item.action))]
        .sort()
        .map((action) => ({ value: action, label: action })),
    ],
    [inRange]
  );

  const moduleOptions = useMemo(
    () => [
      { value: "all", label: "All Modules" },
      ...modulesIn(inRange).map((module) => ({ value: module, label: module })),
    ],
    [inRange]
  );

  const filtered = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return inRange.filter((item) => {
      if (filters.user !== "all" && item.actorName !== filters.user) return false;
      if (filters.action !== "all" && item.action !== filters.action) return false;
      if (filters.module !== "all" && item.module !== filters.module) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (!needle) return true;
      return (
        item.actorName.toLowerCase().includes(needle) ||
        item.action.toLowerCase().includes(needle) ||
        item.module.toLowerCase().includes(needle) ||
        item.details.toLowerCase().includes(needle)
      );
    });
  }, [inRange, filters]);

  const stats = useMemo(
    () => ({
      total: inRange.length,
      success: inRange.filter((item) => item.status === "SUCCESS").length,
      failed: inRange.filter((item) => item.status === "FAILED").length,
      users: new Set(inRange.map((item) => item.actorName)).size,
    }),
    [inRange]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = filtered.find((item) => item.id === selectedId) ?? null;
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  const change = (next: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `windrise-activity-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* -------------------------------- Render ------------------------------- */

  return (
    <PageShell>
      <PageHeader
        crumb="Activity Log"
        title="Activity Log"
        description="Track important actions and changes across your Windrise dashboard."
      >
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            aria-label="From date"
            className="w-[116px] bg-transparent text-[13px] text-slate-700 outline-none"
          />
          <span className="text-slate-300">&ndash;</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toDateInput(today)}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            aria-label="To date"
            className="w-[116px] bg-transparent text-[13px] text-slate-700 outline-none"
          />
        </div>
        <GhostButton onClick={exportCsv} disabled={filtered.length === 0}>
          <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          Export
        </GhostButton>
      </PageHeader>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
        >
          {error}
        </p>
      )}

      <StatGrid>
        <StatCard icon={ActivityIcon} label="Total Activities" value={stats.total} />
        <StatCard icon={CheckCircle2Icon} label="Successful Actions" value={stats.success} />
        <StatCard icon={XCircleIcon} label="Did Not Complete" value={stats.failed} />
        <StatCard icon={UsersRoundIcon} label="Active People" value={stats.users} />
      </StatGrid>

      <div
        className={cn(
          "grid grid-cols-1 items-start gap-5",
          selected && "xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
            <SearchField
              value={filters.query}
              onChange={(query) => change({ query })}
              placeholder="Search by user, action, module or details..."
              label="Search activity"
              className="min-w-[220px] flex-1"
            />
            <FieldSelect
              value={filters.user}
              onValueChange={(user) => change({ user })}
              options={userOptions}
              label="Filter by user"
              className="w-[150px]"
            />
            <FieldSelect
              value={filters.action}
              onValueChange={(action) => change({ action })}
              options={actionOptions}
              label="Filter by action"
              className="w-[170px]"
            />
            <FieldSelect
              value={filters.module}
              onValueChange={(module) => change({ module })}
              options={moduleOptions}
              label="Filter by module"
              className="w-[150px]"
            />
            <FieldSelect
              value={filters.status}
              onValueChange={(status) => change({ status })}
              options={[
                { value: "all", label: "All Status" },
                { value: "SUCCESS", label: "Success" },
                { value: "FAILED", label: "Failed" },
              ]}
              label="Filter by status"
              className="w-[130px]"
            />
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              disabled={!dirty}
              className="cursor-pointer px-1 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear Filters
            </button>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="Nothing in this range"
              description="Widen the dates or clear the filters to see more activity."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-slate-200/80 bg-slate-50/80">
                      <Th>Time</Th>
                      <Th>User</Th>
                      <Th>Action</Th>
                      <Th>Module</Th>
                      <Th>Details</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((item) => {
                      const success = item.status === "SUCCESS";
                      const active = item.id === selectedId;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedId(active ? null : item.id)}
                          aria-selected={active}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-slate-50/70",
                            active && "bg-slate-50"
                          )}
                        >
                          <td className="px-5 py-3.5 text-[13px] whitespace-nowrap text-slate-500">
                            {formatWhen(item.at)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={item.actorName} src={item.actorAvatar} size={30} />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-slate-900">
                                  {item.actorName}
                                </p>
                                <p className="truncate text-[12px] text-slate-500">
                                  {item.actorRole}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[13px] text-slate-700">
                            {item.action}
                          </td>
                          <td className="px-5 py-3.5 text-[13px] text-slate-600">
                            {item.module}
                          </td>
                          <td className="max-w-[280px] px-5 py-3.5 text-[13px] text-slate-600">
                            <span className="line-clamp-2">{item.details}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
                                success
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pager
                page={currentPage}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                noun="activities"
                onPage={setPage}
              />
            </>
          )}
        </section>

        {selected && (
          <ActivityDetailPanel entry={selected} onClose={() => setSelectedId(null)} />
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-[13px] text-slate-400">
          <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Reading orders, accounts and posts&hellip;
        </p>
      )}
    </PageShell>
  );
}

export default ActivityLog;
