"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  Loader2Icon,
  MailPlusIcon,
  PlusIcon,
  UserRoundCheckIcon,
  UserRoundMinusIcon,
  UsersRoundIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Toast } from "@/components/shared/Toast/Toast";
import {
  approveStaff,
  changeStaffRole,
  createStaff,
  deleteAdmin,
  updateAdmin,
  updateAdminStatus,
} from "@/services/admin/admin";
import {
  getDepartments,
  type Department,
} from "@/services/administration/departments";
import { getRoles } from "@/services/administration/roles";
import type { RoleDefinition } from "@/types/administration";
import { fetchTeam, type TeamMember } from "@/services/administration/team";
import type { AccessStatus } from "@/types/administration";
import { STAFF_ROLES } from "@/types/staffRole";
import {
  GhostButton,
  PageHeader,
  PageShell,
  PrimaryButton,
  StatCard,
  StatGrid,
} from "../shared/ui";
import { BulkBar, EMPTY_FILTERS, UsersTable, type UserFilters } from "./UsersTable";
import { UserPanel, type UserPanelPayload } from "./UserPanel";

const PAGE_SIZE = 10;

/* =========================================================================
   Users & Access — the whole team on one screen.

   Staff used to be managed through four near-identical "Add <role>" pages.
   This is one roster over the same endpoints: the four role lists are
   fetched together, and every action here is a real call.
   ========================================================================= */

export function UsersAccess() {
  const { user } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    try {
      // The roster and the teams together: the Add User form needs the teams
      // before it opens, and the table labels rows with them.
      const [roster, teams, roleList] = await Promise.allSettled([
        fetchTeam(),
        getDepartments(),
        getRoles(),
      ]);

      const problems: string[] = [];

      if (roster.status === "fulfilled") {
        setMembers(roster.value.members);
        if (roster.value.failed.length) {
          const missing = roster.value.failed
            .map((role) => STAFF_ROLES[role].plural)
            .join(", ");
          problems.push(`Could not load ${missing}`);
        }
      } else {
        problems.push("Could not load the team");
      }

      // A failed department fetch used to be swallowed, which looked exactly
      // like having no departments — the confusion the Add User form showed.
      if (teams.status === "fulfilled") setDepartments(teams.value);
      else problems.push("Could not load departments, so the list will be empty");

      if (roleList.status === "fulfilled") setRoles(roleList.value);
      else problems.push("Could not load roles, so the Role list will be empty");

      setError(problems.length ? `${problems.join(". ")}.` : "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load the team");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  /* ------------------------------- Derived ------------------------------- */

  const live = useMemo(() => members.filter((m) => m.status !== "DELETED"), [members]);

  const counts = useMemo(
    () => ({
      total: live.length,
      active: live.filter((m) => m.status === "ACTIVE").length,
      inactive: live.filter((m) => m.status === "INACTIVE").length,
      pending: live.filter((m) => m.status === "PENDING").length,
    }),
    [live]
  );

  /**
   * The filter offers the teams that exist plus any name already on a row, so
   * a member of a team that was removed can still be found by the label the
   * table is showing.
   */
  const departmentNames = useMemo(
    () =>
      [
        ...new Set([
          ...departments.map((department) => department.name),
          ...members.map((member) => member.department),
        ]),
      ]
        .filter((name) => name !== "—")
        .sort(),
    [departments, members]
  );

  const filtered = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return members.filter((member) => {
      // Deleted accounts are out of the way unless they are asked for.
      if (filters.status === "all" ? member.status === "DELETED" : member.status !== filters.status) {
        return false;
      }
      if (filters.role !== "all" && member.roleKey !== filters.role) return false;
      if (filters.department !== "all" && member.department !== filters.department) return false;
      if (!needle) return true;
      return (
        member.name.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle) ||
        member.roleLabel.toLowerCase().includes(needle) ||
        member.department.toLowerCase().includes(needle)
      );
    });
  }, [members, filters]);

  // A filter that shortens the list can strand the pager past the last page.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeFilters = (next: UserFilters) => {
    setFilters(next);
    setPage(1);
  };

  /* ------------------------------ Selection ------------------------------ */

  const selectOne = (id: string, next: boolean) => {
    setSelected((current) => {
      const copy = new Set(current);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const selectPage = (next: boolean) => {
    setSelected((current) => {
      const copy = new Set(current);
      for (const member of pageRows) {
        if (next) copy.add(member.id);
        else copy.delete(member.id);
      }
      return copy;
    });
  };

  const selectedMembers = useMemo(
    // Never act on yourself or on the owner account in bulk: locking the
    // dashboard's way back in is not something a tick box should be able to do.
    () =>
      members.filter(
        (member) => selected.has(member.id) && member.id !== user?.id && !member.isOwner
      ),
    [members, selected, user?.id]
  );

  /* ------------------------------- Actions ------------------------------- */

  /**
   * Departments are created on another screen, so the copy this page loaded
   * with can already be out of date by the time the panel opens. Re-reading
   * them here is what keeps the dropdown current without a page reload.
   */
  const refreshOptions = () => {
    getDepartments().then(setDepartments).catch(() => undefined);
    getRoles().then(setRoles).catch(() => undefined);
  };

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    refreshOptions();
    setPanelOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditing(member);
    setFormError("");
    refreshOptions();
    setPanelOpen(true);
  };

  const submit = async (payload: UserPanelPayload) => {
    setSubmitting(true);
    setFormError("");
    try {
      if (editing) {
        /*
          The role moves the account's profile row between tables, so it is a
          separate call and only made when it actually changed. It runs first:
          if the move fails there is nothing to undo, whereas saving the
          details first would leave a half-applied edit on screen.
        */
        if (payload.roleId && payload.roleId !== editing.roleId) {
          await changeStaffRole(editing.id, payload.roleId);
        }
        await updateAdmin(
          editing.id,
          {
            name: payload.name,
            email: payload.email,
            // Always sent: an empty string is how the form clears it.
            departmentId: payload.departmentId,
          },
          payload.file
        );
        Toast.fire({ icon: "success", title: "User updated." });
      } else {
        await createStaff(
          payload.roleId,
          {
            name: payload.name,
            email: payload.email,
            password: payload.password,
            ...(payload.phone ? { phone: payload.phone } : {}),
            ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
          },
          payload.file
        );
        Toast.fire({ icon: "success", title: `${payload.name} can now sign in.` });
      }
      setPanelOpen(false);
      refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = (member: TeamMember, next: AccessStatus) => {
    const activating = next === "ACTIVE";
    Swal.fire({
      icon: "question",
      title: activating ? "Activate this user?" : "Deactivate this user?",
      text: activating
        ? `${member.name} will be able to sign in again.`
        : `${member.name} will not be able to sign in until reactivated.`,
      showCancelButton: true,
      confirmButtonText: activating ? "Activate" : "Deactivate",
      cancelButtonText: "Cancel",
      confirmButtonColor: activating ? "#10b981" : "#f59e0b",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await updateAdminStatus(member.id, activating ? "ACTIVE" : "INACTIVE");
        Toast.fire({
          icon: "success",
          title: activating ? "User activated." : "User deactivated.",
        });
        refresh();
      } catch (err: unknown) {
        Toast.fire({
          icon: "error",
          title: err instanceof Error ? err.message : "Failed to update status",
        });
      }
    });
  };

  /**
   * Lets a waiting account in. Until this runs the credentials open nothing,
   * so it is the moment the account starts existing as far as sign-in cares.
   */
  const approve = (member: TeamMember) => {
    Swal.fire({
      icon: "question",
      title: `Approve ${member.name}?`,
      text: `They will be able to sign in as ${member.roleLabel} straight away.`,
      showCancelButton: true,
      confirmButtonText: "Approve",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#10b981",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await approveStaff(member.id);
        Toast.fire({ icon: "success", title: `${member.name} can now sign in.` });
        refresh();
      } catch (err: unknown) {
        Toast.fire({
          icon: "error",
          title: err instanceof Error ? err.message : "Could not approve the account",
        });
      }
    });
  };

  /** Turning an account away removes it — there is nothing else it could be. */
  const decline = (member: TeamMember) => {
    Swal.fire({
      icon: "warning",
      title: `Decline ${member.name}?`,
      text: "The account is removed and they never gain access. This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Decline",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await deleteAdmin(member.id);
        Toast.fire({ icon: "success", title: `${member.name} was declined.` });
        selectOne(member.id, false);
        refresh();
      } catch (err: unknown) {
        Toast.fire({
          icon: "error",
          title: err instanceof Error ? err.message : "Could not decline the account",
        });
      }
    });
  };

  const removeUser = (member: TeamMember) => {
    Swal.fire({
      icon: "warning",
      title: "Delete this user?",
      text: `${member.name} will lose access immediately. This cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await deleteAdmin(member.id);
        Toast.fire({ icon: "success", title: "User deleted." });
        selectOne(member.id, false);
        refresh();
      } catch (err: unknown) {
        Toast.fire({
          icon: "error",
          title: err instanceof Error ? err.message : "Failed to delete user",
        });
      }
    });
  };

  /**
   * Bulk work runs one account at a time and reports what actually happened:
   * a run that half succeeds is the case worth being clear about.
   */
  const runBulk = async (
    verb: string,
    confirmText: string,
    confirmColor: string,
    action: (member: TeamMember) => Promise<unknown>
  ) => {
    const targets = selectedMembers;
    if (!targets.length) return;

    const result = await Swal.fire({
      icon: verb === "Delete" ? "warning" : "question",
      title: `${verb} ${targets.length} ${targets.length === 1 ? "user" : "users"}?`,
      text: confirmText,
      showCancelButton: true,
      confirmButtonText: verb,
      cancelButtonText: "Cancel",
      confirmButtonColor: confirmColor,
    });
    if (!result.isConfirmed) return;

    setRefreshing(true);
    const outcomes = await Promise.allSettled(targets.map(action));
    const failures = outcomes.filter((outcome) => outcome.status === "rejected").length;

    Toast.fire({
      icon: failures ? "warning" : "success",
      title: failures
        ? `${targets.length - failures} updated, ${failures} failed.`
        : `${targets.length} ${targets.length === 1 ? "user" : "users"} updated.`,
    });
    setSelected(new Set());
    load();
  };

  /* -------------------------------- Render ------------------------------- */

  return (
    <PageShell>
      <PageHeader
        crumb="Users & Access"
        title="Users & Access"
        description="Manage team members, their roles and system access."
      >
        <GhostButton onClick={refresh} disabled={loading || refreshing}>
          <Loader2Icon
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </GhostButton>
        <PrimaryButton onClick={openCreate}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add New User
        </PrimaryButton>
      </PageHeader>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
        >
          {error}
        </p>
      )}

      <StatGrid>
        <StatCard icon={UsersRoundIcon} label="Total Users" value={counts.total} />
        <StatCard
          icon={UserRoundCheckIcon}
          label="Active Users"
          value={counts.active}
          caption="Signed in and working"
        />
        <StatCard
          icon={UserRoundMinusIcon}
          label="Inactive Users"
          value={counts.inactive}
          caption="Access suspended"
        />
        <StatCard
          icon={MailPlusIcon}
          label="Pending Invite"
          value={counts.pending}
          caption="Has not set their own password"
        />
      </StatGrid>

      {selectedMembers.length > 0 && (
        <BulkBar
          count={selectedMembers.length}
          onClear={() => setSelected(new Set())}
          onActivate={() =>
            runBulk("Activate", "They will be able to sign in again.", "#10b981", (member) =>
              updateAdminStatus(member.id, "ACTIVE")
            )
          }
          onDeactivate={() =>
            runBulk(
              "Deactivate",
              "They will not be able to sign in until reactivated.",
              "#f59e0b",
              (member) => updateAdminStatus(member.id, "INACTIVE")
            )
          }
          onDelete={() =>
            runBulk("Delete", "This cannot be undone.", "#ef4444", (member) =>
              deleteAdmin(member.id)
            )
          }
        />
      )}

      <UsersTable
        members={pageRows}
        total={filtered.length}
        loading={loading}
        page={currentPage}
        pageSize={PAGE_SIZE}
        filters={filters}
        departments={departmentNames}
        selected={selected}
        currentUserId={user?.id}
        onPage={setPage}
        onFilters={changeFilters}
        onSelect={selectOne}
        onSelectPage={selectPage}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        onApprove={approve}
        onDecline={decline}
        onDelete={removeUser}
      />

      {panelOpen && (
        <UserPanel
          member={editing}
          roles={roles}
          departments={departments}
          submitting={submitting}
          error={formError}
          onClose={() => setPanelOpen(false)}
          onSubmit={submit}
        />
      )}
    </PageShell>
  );
}

export default UsersAccess;
