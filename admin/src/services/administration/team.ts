import { getAllAdmins } from "@/services/admin/admin";
import type { Admin } from "@/types/admin";
import { type AccessStatus } from "@/types/administration";
import { STAFF_ROLES, type StaffRoleKey } from "@/types/staffRole";

/* =========================================================================
   The team, as one list.

   The API lists staff one role at a time, which is what the four "Add <role>"
   screens used to be. Users & Access is a single roster, so the four calls
   are made together and merged here — the screen never has to know that the
   roster arrives in pieces.
   ========================================================================= */

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  roleKey: StaffRoleKey;
  roleLabel: string;
  /**
   * The account the store was seeded with: the oldest admin, which is the one
   * `DEFAULT_ADMIN_EMAIL` creates on first run. It is the Super Admin, and
   * nothing in the dashboard may suspend or delete it.
   */
  isOwner: boolean;
  /** The role row the account holds, when it has one. */
  roleId: string | null;
  /** The team's name, or "—" when the account is in none. */
  department: string;
  departmentId: string | null;
  status: AccessStatus;
  /** True while the account still has the password it was created with. */
  pendingInvite: boolean;
  createdAt: string;
  updatedAt: string;
};

export const STAFF_ROLE_KEYS: StaffRoleKey[] = [
  "ADMIN",
  "SHOP_MANAGER",
  "MEDIA_MANAGER",
  "CUSTOMER_SUPPORT",
];

function toMember(admin: Admin, roleKey: StaffRoleKey): TeamMember {
  /*
    Waiting for approval, which the server makes real rather than cosmetic: a
    staff account is created INACTIVE with no `approvedAt`, so it cannot sign
    in until an admin approves it. That is the difference between this and a
    suspension — a suspended account was approved once and had it taken away.
  */
  const pendingInvite = !admin.isDeleted && !admin.approvedAt;

  const status: AccessStatus = admin.isDeleted
    ? "DELETED"
    : pendingInvite
      ? "PENDING"
      : (admin.status as AccessStatus);

  return {
    id: admin.id,
    name: admin.name?.trim() || admin.email?.split("@")[0] || "Unnamed",
    email: admin.email ?? "",
    avatar: admin.avatar ?? null,
    roleKey,
    roleLabel: admin.roleRef?.name ?? STAFF_ROLES[roleKey].singular,
    roleId: admin.roleRef?.id ?? null,
    isOwner: false,
    // The department is assigned per account now, not inferred from the role.
    // Roles created before departments existed simply have none.
    department: admin.department?.name ?? "—",
    departmentId: admin.departmentId ?? null,
    status,
    pendingInvite,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

/**
 * Every staff account, newest first. A role that fails to load is reported
 * rather than silently dropped: a roster missing a whole role would look like
 * a team that has nobody in it.
 */
export async function fetchTeam(): Promise<{ members: TeamMember[]; failed: StaffRoleKey[] }> {
  const results = await Promise.allSettled(
    STAFF_ROLE_KEYS.map((roleKey) =>
      getAllAdmins({ role: roleKey, limit: 1000, sortBy: "createdAt", sortOrder: "desc" })
    )
  );

  const members: TeamMember[] = [];
  const failed: StaffRoleKey[] = [];

  results.forEach((result, index) => {
    const roleKey = STAFF_ROLE_KEYS[index];
    if (result.status === "rejected") {
      failed.push(roleKey);
      return;
    }
    for (const admin of result.value.data ?? []) {
      // The endpoint takes a role filter, but a stray row would land in the
      // wrong bucket and be labelled with the role that was asked for.
      if (admin.role && admin.role !== roleKey) continue;
      members.push(toMember(admin, roleKey));
    }
  });

  members.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  markOwner(members);
  return { members, failed };
}

export const SUPER_ADMIN_LABEL = "Super Admin";

/**
 * Promotes the oldest admin account to Super Admin, in place.
 *
 * There is no flag on the record for it: the seeded owner is simply the first
 * admin the database ever had, so the earliest `createdAt` among admins is the
 * account `DEFAULT_ADMIN_EMAIL` created. Deleted accounts are skipped — an
 * owner that was removed should not go on holding the title.
 *
 * It is never "Pending". That badge means an invitation nobody has accepted,
 * and it is read off `needPasswordChange` — which on the seeded owner means
 * something else entirely: the operator set that password in `.env` and the
 * server is asking for it to be replaced. The account is ACTIVE and holds the
 * full ADMIN role either way, so reporting it as a half-finished invite was
 * wrong about the one account that can never be locked out.
 */
function markOwner(members: TeamMember[]): void {
  const admins = members.filter(
    (member) => member.roleKey === "ADMIN" && member.status !== "DELETED"
  );
  if (!admins.length) return;

  const owner = admins.reduce((oldest, member) =>
    member.createdAt < oldest.createdAt ? member : oldest
  );

  owner.isOwner = true;
  owner.roleLabel = SUPER_ADMIN_LABEL;
  owner.pendingInvite = false;
  // Only the derived badge is corrected. A genuinely suspended owner still
  // reads as suspended here, because that is what the server says.
  if (owner.status === "PENDING") owner.status = "ACTIVE";
}

/** A password that satisfies the store's own policy, for a new account. */
export function generatePassword(length = 14): string {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%^&*",
  ];
  const all = groups.join("");
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);

  // One character from each group first, so the result always clears the
  // uppercase / lowercase / number / symbol requirements.
  const chars = groups.map((group, index) => group[bytes[index] % group.length]);
  for (let index = groups.length; index < length; index += 1) {
    chars.push(all[bytes[index] % all.length]);
  }

  // Shuffle, or the first four characters would always follow the group order.
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = order[index] % (index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}
