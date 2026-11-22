"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  CopyIcon,
  KeySquareIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SquareDashedIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import {
  ACCESS_STATUS_META,
  PERMISSION_ACTIONS,
  ROLE_STATUS_META,
  type PermissionAction,
  type RoleDefinition,
  type RolePermissions,
} from "@/types/administration";
import {
  ALL_PERMISSION_MODULES,
  TOTAL_PERMISSION_COUNT,
} from "@/services/administration/permissionCatalog";
import {
  createRole,
  deleteRole as deleteRoleRequest,
  getRoles,
  updateRole,
} from "@/services/administration/roles";
import { emptyPermissions } from "@/services/administration/roleDefaults";
import { fetchTeam, type TeamMember } from "@/services/administration/team";
import { changeStaffRole } from "@/services/admin/admin";
import { useAuth } from "@/hooks/use-auth";
import {
  Avatar,
  CARD,
  Chip,
  EmptyState,
  GhostButton,
  PageHeader,
  PageShell,
  PrimaryButton,
  RowMenu,
  SearchField,
  StatCard,
  StatGrid,
  StatusPill,
} from "../shared/ui";
import { formatDate } from "../shared/format";
import { applyAction, countGranted, PermissionMatrix } from "./PermissionMatrix";
import { DepartmentsCard } from "./DepartmentsCard";
import { RoleDialog, ROLE_ICONS, type RoleDraft } from "./RoleDialog";
import { cn } from "@/lib/utils";

/* =========================================================================
   Roles & Permissions.

   Roles are rows on the server. One created here is active straight away and
   can be handed out from its Assigned Users tab or the Add User form; its
   access level (Admin, Shop Manager…) is what the API lets its accounts do,
   and its grid is what the dashboard shows them.
   ========================================================================= */

/** Team members who can be moved into a role, searchable by name or email. */
function AssignPicker({
  members,
  query,
  onQuery,
  busyId,
  roleName,
  onPick,
  onClose,
}: {
  members: TeamMember[];
  query: string;
  onQuery: (value: string) => void;
  busyId: string | null;
  roleName: string;
  onPick: (member: TeamMember) => void;
  onClose: () => void;
}) {
  const needle = query.trim().toLowerCase();
  const shown = members.filter(
    (member) => !needle || member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle)
  );

  return (
    <div
      className="w-full rounded-xl border border-slate-200 bg-white p-2"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <SearchField value={query} onChange={onQuery} placeholder="Search your team…" label="Search your team" />
      <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-auto">
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-[13px] text-slate-500">
            {members.length
              ? "Nobody matches that search."
              : "Everyone else on the team already has this role. Add new people in Users & Access."}
          </li>
        )}
        {shown.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={member.name} src={member.avatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-900">{member.name}</p>
              <p className="truncate text-[12px] text-slate-500">
                {member.email} · now {member.roleLabel}
              </p>
            </div>
            <GhostButton
              onClick={() => onPick(member)}
              disabled={busyId !== null}
              aria-label={`Give ${member.name} the ${roleName} role`}
            >
              {busyId === member.id ? "Adding…" : "Add"}
            </GhostButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Tab = "permissions" | "users" | "details";

export function RolesPermissions() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loadError, setLoadError] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("permissions");

  /** The matrix being edited, held apart until it is saved. */
  const [draft, setDraft] = useState<RolePermissions | null>(null);
  const [dialogFor, setDialogFor] = useState<RoleDefinition | null | "new">(null);

  /**
   * Re-reads the list after every write, so what is on screen is what the
   * server holds — and so the Add User form, which reads the same endpoint,
   * can never disagree with this one.
   */
  const reloadRoles = async (selectId?: string) => {
    try {
      const next = await getRoles();
      setRoles(next);
      setSelectedId((current) => selectId ?? (next.some((r) => r.id === current) ? current : next[0]?.id ?? ""));
      setLoadError("");
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Could not load roles");
    }
  };

  /** Reports what the server said rather than leaving the screen stale. */
  const attempt = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (err: unknown) {
      Toast.fire({
        icon: "error",
        title: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadRoles();
    fetchTeam()
      .then(({ members }) => setTeam(members.filter((member) => member.status !== "DELETED")))
      .catch(() => setTeam([]));
  }, []);

  const selected = roles.find((role) => role.id === selectedId) ?? null;

  const usersByRole = useMemo(() => {
    const counts: Record<string, TeamMember[]> = {};
    for (const member of team) {
      /*
        By the role the account actually holds. Grouping by access level put
        everyone at that level under every role sharing it — two Shop Manager
        roles each claimed both teams. Only accounts from before roles were
        rows (no roleId) fall back to the level, and the owner to Super Admin.
      */
      const role = member.roleId
        ? roles.find((entry) => entry.id === member.roleId)
        : member.isOwner
          ? roles.find((entry) => entry.locked)
          : roles.find((entry) => !entry.locked && entry.roleKey === member.roleKey);
      if (!role) continue;
      (counts[role.id] ??= []).push(member);
    }
    return counts;
  }, [team, roles]);

  /* ------------------------------ Assigning ------------------------------ */

  const { user: me } = useAuth();
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const reloadTeam = () =>
    fetchTeam()
      .then(({ members }) => setTeam(members.filter((member) => member.status !== "DELETED")))
      .catch(() => undefined);

  /**
   * Moves a team member into the selected role. Their access level follows
   * the role, which the server applies in the same step.
   */
  const assign = (member: TeamMember) =>
    attempt(async () => {
      if (!selected) return;
      setAssigning(member.id);
      try {
        await changeStaffRole(member.id, selected.id);
        await Promise.all([reloadTeam(), reloadRoles(selected.id)]);
        Toast.fire({ icon: "success", title: `${member.name} now has the ${selected.name} role.` });
      } finally {
        setAssigning(null);
      }
    });

  const visibleRoles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return roles;
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(needle) ||
        role.description.toLowerCase().includes(needle)
    );
  }, [roles, query]);

  const stats = useMemo(
    () => ({
      total: roles.length,
      active: roles.filter((role) => role.status === "ACTIVE").length,
      draft: roles.filter((role) => role.status !== "ACTIVE").length,
    }),
    [roles]
  );

  /* -------------------------------- Writes ------------------------------- */

  const dirty = Boolean(draft && selected && !samePermissions(draft, selected.permissions));

  const changePermission = (moduleId: string, action: PermissionAction, next: boolean) => {
    if (!selected || selected.locked) return;
    const base = draft ?? selected.permissions;
    setDraft({
      ...base,
      [moduleId]: applyAction(base[moduleId] ?? [], action, next),
    });
  };

  const setEveryPermission = (grant: boolean) => {
    if (!selected || selected.locked) return;
    const next: RolePermissions = {};
    for (const entry of ALL_PERMISSION_MODULES) {
      next[entry.id] = grant ? PERMISSION_ACTIONS.map((action) => action.id) : [];
    }
    setDraft(next);
  };

  const savePermissions = () =>
    attempt(async () => {
      if (!selected || !draft) return;
      await updateRole(selected.id, { permissions: draft });
      setDraft(null);
      await reloadRoles(selected.id);
      Toast.fire({ icon: "success", title: `${selected.name} permissions saved.` });
    });

  const submitRole = (values: RoleDraft) =>
    attempt(async () => {
      if (dialogFor && dialogFor !== "new") {
        if (dialogFor.locked) return setDialogFor(null);
        await updateRole(dialogFor.id, {
          name: values.name,
          description: values.description,
          icon: values.icon,
          baseRole: values.baseRole,
        });
        setDialogFor(null);
        await reloadRoles(dialogFor.id);
        Toast.fire({ icon: "success", title: "Role updated." });
        return;
      }

      // Active straight away: a role the Super Admin saves is finished, and
      // the Add User form offers it on its next read.
      const role = await createRole({
        name: values.name,
        description: values.description,
        icon: values.icon,
        baseRole: values.baseRole,
        permissions: emptyPermissions(),
      });
      setDialogFor(null);
      setDraft(null);
      await reloadRoles(role.id);
      Toast.fire({ icon: "success", title: `${role.name} created.` });
    });

  const duplicateRole = (role: RoleDefinition) =>
    attempt(async () => {
      // A copy is its own role: it takes the grid and the access level, never
      // the lock that belongs to Super Admin alone.
      const copy = await createRole({
        name: `${role.name} (copy)`,
        description: role.description,
        icon: role.icon,
        baseRole: (role.roleKey ?? "SHOP_MANAGER") as NonNullable<RoleDefinition["roleKey"]>,
        permissions: role.permissions,
      });
      setDraft(null);
      await reloadRoles(copy.id);
      Toast.fire({ icon: "success", title: "Role duplicated." });
    });

  const toggleRoleStatus = (role: RoleDefinition) =>
    attempt(async () => {
      if (role.locked) return;
      const nextActive = role.status === "INACTIVE";
      await updateRole(role.id, { isActive: nextActive });
      await reloadRoles(role.id);
      Toast.fire({
        icon: "success",
        title: nextActive ? `${role.name} is active.` : `${role.name} marked inactive.`,
      });
    });

  const deleteRole = (role: RoleDefinition) => {
    if (role.locked) return;
    const holders = usersByRole[role.id]?.length ?? 0;

    // Deleting out from under somebody is refused by the API too; saying so
    // here means the admin finds out before the confirm, not after it.
    if (holders > 0) {
      Swal.fire({
        icon: "info",
        title: `${role.name} is in use`,
        text:
          `${holders} ${holders === 1 ? "account holds" : "accounts hold"} this role. ` +
          `Move them to another role first, then delete it.`,
        confirmButtonText: "Got it",
        confirmButtonColor: "#0b0b0b",
      });
      return;
    }

    Swal.fire({
      icon: "warning",
      title: `Delete ${role.name}?`,
      text: "The role and its permission grid are removed.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (!result.isConfirmed) return;
      attempt(async () => {
        await deleteRoleRequest(role.id);
        setDraft(null);
        await reloadRoles();
        Toast.fire({ icon: "success", title: "Role deleted." });
      });
    });
  };

  const pick = (role: RoleDefinition) => {
    setSelectedId(role.id);
    setDraft(null);
    setTab("permissions");
  };

  /* -------------------------------- Render ------------------------------- */

  const assigned = selected ? (usersByRole[selected.id] ?? []) : [];
  const shown = draft ?? selected?.permissions ?? {};
  const locked = Boolean(selected?.locked);

  return (
    <PageShell>
      <PageHeader
        crumb="Roles & Permissions"
        title="Roles & Permissions"
        description="Create and manage roles, and control what each role can access."
      >
        <PrimaryButton onClick={() => setDialogFor("new")}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Create Role
        </PrimaryButton>
      </PageHeader>

      <StatGrid>
        <StatCard icon={ShieldIcon} label="Total Roles" value={stats.total} />
        <StatCard
          icon={ShieldCheckIcon}
          label="Active Roles"
          value={stats.active}
          caption="Available when adding a user"
        />
        <StatCard
          icon={SquareDashedIcon}
          label="Inactive Roles"
          value={stats.draft}
          caption="Parked, so not offered"
        />
        <StatCard
          icon={KeySquareIcon}
          label="Total Permissions"
          value={TOTAL_PERMISSION_COUNT}
          caption={`${ALL_PERMISSION_MODULES.length} modules × ${PERMISSION_ACTIONS.length} actions`}
        />
      </StatGrid>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
        >
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* --------------------- Roles, then departments -------------------- */}
        <div className="flex flex-col gap-5">
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="px-5 pt-5 pb-4">
            <h2 className="mb-3 text-[17px] font-semibold text-slate-900">Roles</h2>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search roles..."
              label="Search roles"
            />
          </div>

          <div className="flex flex-col gap-1.5 px-3 pb-3">
            {visibleRoles.map((role) => {
              const Icon = ROLE_ICONS[role.icon];
              const active = role.id === selectedId;
              const users = usersByRole[role.id] ?? [];
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => pick(role)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    active ? "bg-[#0b0b0b] text-white" : "hover:bg-slate-50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                      active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-[14px] font-medium",
                          active ? "text-white" : "text-slate-900"
                        )}
                      >
                        {role.name}
                      </span>
                      {role.status !== "ACTIVE" && (
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                            active ? "bg-white/15 text-white/80" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {ROLE_STATUS_META[role.status].label}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[12px]",
                        active ? "text-white/60" : "text-slate-400"
                      )}
                    >
                      {users.length} {users.length === 1 ? "user" : "users"}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block truncate text-[12px]",
                        active ? "text-white/70" : "text-slate-500"
                      )}
                    >
                      {role.description || "No description yet."}
                    </span>
                  </span>
                </button>
              );
            })}

            {visibleRoles.length === 0 && (
              <p className="px-3 py-8 text-center text-[13px] text-slate-500">
                No role matches &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => setDialogFor("new")}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Create New Role
            </button>

          </div>
        </section>

          {/* Departments live beside roles, not inside them: the role decides
              what someone may do, the department says who they sit with. */}
          <DepartmentsCard />
        </div>

        {/* --------------------------- Role detail -------------------------- */}
        <section className={cn(CARD, "overflow-hidden")}>
          {!selected ? (
            <EmptyState
              icon={ShieldIcon}
              title="No role selected"
              description="Pick a role on the left, or create one to start shaping its access."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[21px] font-semibold text-slate-900">{selected.name}</h2>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium",
                        ROLE_STATUS_META[selected.status].chip
                      )}
                    >
                      <span
                        className={cn(
                          "h-[6px] w-[6px] rounded-full",
                          ROLE_STATUS_META[selected.status].dot
                        )}
                        aria-hidden="true"
                      />
                      {ROLE_STATUS_META[selected.status].label}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {selected.description || "No description yet."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <GhostButton
                    onClick={() => setDialogFor(selected)}
                    disabled={locked}
                    title={locked ? "Super Admin cannot be edited" : undefined}
                  >
                    <PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit Role
                  </GhostButton>
                  <RowMenu
                    label={`More actions for ${selected.name}`}
                    items={[
                      {
                        label: "Duplicate role",
                        icon: CopyIcon,
                        onSelect: () => duplicateRole(selected),
                      },
                      {
                        label:
                          selected.status === "INACTIVE" ? "Mark as active" : "Mark inactive",
                        icon: PowerIcon,
                        onSelect: () => toggleRoleStatus(selected),
                        disabled: locked,
                      },
                      {
                        label: "Delete role",
                        icon: Trash2Icon,
                        tone: "danger" as const,
                        onSelect: () => deleteRole(selected),
                        disabled: locked,
                      },
                    ]}
                  />
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Role sections"
                className="flex items-center gap-6 border-b border-slate-200/80 px-5"
              >
                {(
                  [
                    ["permissions", "Permissions"],
                    ["users", `Assigned Users (${assigned.length})`],
                    ["details", "Role Details"],
                  ] as [Tab, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "-mb-px cursor-pointer border-b-2 pb-3 text-[13px] font-medium transition-colors",
                      tab === id
                        ? "border-[#0b0b0b] text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "permissions" && (
                <>
                  <div className="flex flex-wrap items-center gap-2 px-5 py-3">
                    <p className="text-[13px] text-slate-500">
                      <span className="font-medium text-slate-900">
                        {countGranted(shown)}
                      </span>{" "}
                      of {TOTAL_PERMISSION_COUNT} permissions granted
                    </p>
                    {locked ? (
                      <p className="ml-auto text-[13px] text-slate-400">
                        Fixed — Super Admin always holds everything.
                      </p>
                    ) : (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEveryPermission(true)}
                          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setEveryPermission(false)}
                          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>

                  <PermissionMatrix
                    permissions={shown}
                    readOnly={locked}
                    onChange={changePermission}
                  />

                  {dirty && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 bg-slate-50/80 px-5 py-3.5">
                      <p className="text-[13px] text-slate-600">
                        Unsaved changes to {selected.name}.
                      </p>
                      <div className="ml-auto flex items-center gap-2">
                        <GhostButton onClick={() => setDraft(null)}>Discard</GhostButton>
                        <PrimaryButton onClick={savePermissions}>Save changes</PrimaryButton>
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === "users" && (
                <div>
                  {!locked && (
                    <div className="flex flex-wrap items-center gap-2 px-5 py-3">
                      <p className="text-[13px] text-slate-500">
                        {selected.status === "ACTIVE"
                          ? "Add people from your team, or create new accounts in Users & Access."
                          : "Activate this role to assign people to it."}
                      </p>
                      <div className="ml-auto">
                        <PrimaryButton
                          disabled={selected.status !== "ACTIVE"}
                          onClick={() => {
                            setAddQuery("");
                            setAdding((value) => !value);
                          }}
                        >
                          <UserPlusIcon className="h-4 w-4" aria-hidden="true" />
                          Add people
                        </PrimaryButton>
                      </div>
                      {adding && (
                        <AssignPicker
                          members={team.filter(
                            (member) =>
                              !member.isOwner &&
                              member.id !== me?.id &&
                              !assigned.some((holder) => holder.id === member.id)
                          )}
                          query={addQuery}
                          onQuery={setAddQuery}
                          busyId={assigning}
                          roleName={selected.name}
                          onPick={(member) => void assign(member)}
                          onClose={() => setAdding(false)}
                        />
                      )}
                    </div>
                  )}
                  {assigned.length === 0 ? (
                    <EmptyState
                      icon={UsersRoundIcon}
                      title="Nobody has this role"
                      description={
                        locked
                          ? "Held by the account the store was set up with."
                          : "Use Add people to move someone from your team into it."
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {assigned.map((member) => {
                        const meta = ACCESS_STATUS_META[member.status];
                        return (
                          <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                            <Avatar name={member.name} src={member.avatar} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-slate-900">
                                {member.name}
                              </p>
                              <p className="truncate text-[12px] text-slate-500">
                                {member.email}
                              </p>
                            </div>
                            <Chip>{member.department}</Chip>
                            <StatusPill dot={meta.dot} label={meta.label} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {tab === "details" && (
                <dl className="divide-y divide-slate-100">
                  {[
                    ["Role name", selected.name],
                    ["Description", selected.description || "—"],
                    ["Status", ROLE_STATUS_META[selected.status].label],
                    [
                      "Assignable",
                      locked
                        ? "Held by the seeded owner account only"
                        : selected.status === "ACTIVE"
                          ? "Yes — from Add people here, or the Add User form"
                          : "Not while it is inactive",
                    ],
                    ["Editable", locked ? "No — Super Admin is fixed" : "Yes"],
                    ["People with this role", `${assigned.length}`],
                    [
                      "Modules reachable",
                      `${Object.values(shown).filter((actions) => actions.length > 0).length} of ${ALL_PERMISSION_MODULES.length}`,
                    ],
                    ["Created", formatDate(selected.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-6 px-5 py-3.5">
                      <dt className="w-52 shrink-0 text-[13px] text-slate-500">{label}</dt>
                      <dd className="text-[13px] text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )}
        </section>
      </div>

      <p className="text-[12px] text-slate-400">
        Roles and their permission grids are saved on the server and apply to everyone who holds
        them. A role&apos;s access level decides what its accounts may do through the API.
      </p>

      {dialogFor && (
        <RoleDialog
          role={dialogFor === "new" ? null : dialogFor}
          onClose={() => setDialogFor(null)}
          onSubmit={submitRole}
        />
      )}
    </PageShell>
  );
}

/** Two grids are the same when every module grants the same actions. */
function samePermissions(a: RolePermissions, b: RolePermissions): boolean {
  return ALL_PERMISSION_MODULES.every((module) => {
    const left = a[module.id] ?? [];
    const right = b[module.id] ?? [];
    return left.length === right.length && left.every((action, index) => action === right[index]);
  });
}

export default RolesPermissions;
