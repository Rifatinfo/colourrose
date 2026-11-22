"use client";

import {
  CheckIcon,
  PencilIcon,
  PowerIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserRoundXIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";

import { FieldSelect } from "@/components/ui/field-select";
import { ACCESS_STATUS_META, type AccessStatus } from "@/types/administration";
import { STAFF_ROLES, type StaffRoleKey } from "@/types/staffRole";
import type { TeamMember } from "@/services/administration/team";
import {
  Avatar,
  CARD,
  CheckBox,
  Chip,
  EmptyState,
  Pager,
  RowMenu,
  SearchField,
  StatusPill,
  TableSkeleton,
  Th,
} from "../shared/ui";
import { formatAgo, formatWhen } from "../shared/format";
import { cn } from "@/lib/utils";

export type UserFilters = {
  query: string;
  role: string;
  department: string;
  status: string;
};

export const EMPTY_FILTERS: UserFilters = {
  query: "",
  role: "all",
  department: "all",
  status: "all",
};

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  ...(Object.keys(STAFF_ROLES) as StaffRoleKey[]).map((key) => ({
    value: key,
    label: STAFF_ROLES[key].singular,
  })),
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "PENDING", label: "Pending" },
  { value: "DELETED", label: "Deleted" },
];

export function UsersTable({
  members,
  total,
  loading,
  page,
  pageSize,
  filters,
  departments,
  selected,
  currentUserId,
  onPage,
  onFilters,
  onSelect,
  onSelectPage,
  onEdit,
  onToggleStatus,
  onApprove,
  onDecline,
  onDelete,
}: {
  /** The rows for the current page, already filtered. */
  members: TeamMember[];
  /** Everything the filters matched, which is what the pager counts. */
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  filters: UserFilters;
  departments: string[];
  selected: Set<string>;
  currentUserId?: string;
  onPage: (next: number) => void;
  onFilters: (next: UserFilters) => void;
  onSelect: (id: string, next: boolean) => void;
  onSelectPage: (next: boolean) => void;
  onEdit: (member: TeamMember) => void;
  onToggleStatus: (member: TeamMember, next: AccessStatus) => void;
  onApprove: (member: TeamMember) => void;
  onDecline: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}) {
  const departmentOptions = [
    { value: "all", label: "All Departments" },
    ...departments.map((department) => ({ value: department, label: department })),
  ];

  const pageIds = members.map((member) => member.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
        <SearchField
          value={filters.query}
          onChange={(query) => onFilters({ ...filters, query })}
          placeholder="Search users by name, email or role..."
          label="Search users"
          className="min-w-[240px] flex-1"
        />
        <FieldSelect
          value={filters.role}
          onValueChange={(role) => onFilters({ ...filters, role })}
          options={ROLE_OPTIONS}
          label="Filter by role"
          className="w-[150px]"
        />
        <FieldSelect
          value={filters.department}
          onValueChange={(department) => onFilters({ ...filters, department })}
          options={departmentOptions}
          label="Filter by department"
          className="w-[180px]"
        />
        <FieldSelect
          value={filters.status}
          onValueChange={(status) => onFilters({ ...filters, status })}
          options={STATUS_OPTIONS}
          label="Filter by status"
          className="w-[140px]"
        />
        <button
          type="button"
          onClick={() => onFilters(EMPTY_FILTERS)}
          disabled={!filtered}
          aria-label="Clear filters"
          title="Clear filters"
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : members.length === 0 ? (
        <EmptyState
          icon={UsersRoundIcon}
          title="No users match these filters"
          description={
            filtered
              ? "Clear the filters to see the whole team again."
              : "Add a team member to give someone access to this dashboard."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-200/80 bg-slate-50/80">
                  <Th className="w-10 pr-0">
                    <CheckBox
                      checked={allOnPage}
                      indeterminate={someOnPage}
                      onChange={onSelectPage}
                      label="Select every user on this page"
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Last updated</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const meta = ACCESS_STATUS_META[member.status];
                  const isSelf = member.id === currentUserId;
                  const isDeleted = member.status === "DELETED";
                  // The owner account is what puts everything else back if a
                  // change here goes wrong, so it is never suspendable.
                  const isProtected = isSelf || isDeleted || member.isOwner;

                  return (
                    <tr
                      key={member.id}
                      className={cn(
                        "transition-colors hover:bg-slate-50/70",
                        selected.has(member.id) && "bg-slate-50"
                      )}
                    >
                      <td className="py-3.5 pl-5">
                        <CheckBox
                          checked={selected.has(member.id)}
                          onChange={(next) => onSelect(member.id, next)}
                          label={`Select ${member.name}`}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.name} src={member.avatar} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-slate-900">
                              {member.name}
                              {isSelf && (
                                <span className="ml-1.5 text-[12px] font-normal text-slate-400">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[12px] text-slate-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Chip
                          className={
                            member.isOwner ? "bg-slate-900 text-white" : undefined
                          }
                        >
                          {member.roleLabel}
                        </Chip>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-slate-600">
                        {member.department}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill dot={meta.dot} label={meta.label} />
                      </td>
                      <td className="px-5 py-3.5 text-[13px] whitespace-nowrap text-slate-500">
                        {member.status === "PENDING"
                          ? `Invited ${formatAgo(member.createdAt)}`
                          : formatWhen(member.updatedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* An account that is waiting has exactly two
                              answers, so they sit on the row rather than
                              behind a menu nobody thinks to open. */}
                          {member.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() => onApprove(member)}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0b0b0b] px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#232323]"
                              >
                                <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => onDecline(member)}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                Decline
                              </button>
                            </>
                          )}
                          <RowMenu
                            label={`Actions for ${member.name}`}
                            items={[
                              {
                                label: "Edit user",
                                icon: PencilIcon,
                                onSelect: () => onEdit(member),
                                disabled: isDeleted,
                              },
                              {
                                label:
                                  member.status === "INACTIVE" ? "Activate" : "Deactivate",
                                icon: PowerIcon,
                                onSelect: () =>
                                  onToggleStatus(
                                    member,
                                    member.status === "INACTIVE" ? "ACTIVE" : "INACTIVE"
                                  ),
                                disabled: isProtected,
                              },
                              {
                                label: "Delete user",
                                icon: Trash2Icon,
                                tone: "danger" as const,
                                onSelect: () => onDelete(member),
                                disabled: isProtected,
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pager page={page} pageSize={pageSize} total={total} noun="users" onPage={onPage} />
        </>
      )}
    </section>
  );
}

/** The bar that appears once rows are ticked. */
export function BulkBar({
  count,
  onActivate,
  onDeactivate,
  onDelete,
  onClear,
}: {
  count: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-900/10 bg-[#0b0b0b] px-4 py-2.5 text-white">
      <p className="text-[13px] font-medium">
        {count} {count === 1 ? "user" : "users"} selected
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onActivate}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Activate
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Deactivate
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200"
        >
          <UserRoundXIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
